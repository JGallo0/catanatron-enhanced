import { useId, useMemo, useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import type {
  Color,
  ConfirmTradeAction,
  GameAction,
  GameState,
  MaritimeTradeAction,
  PlayerState,
  ResourceCard,
  TradeOfferTuple,
} from "../utils/api.types";
import { getPlayerColorMeta, getResourceMeta } from "../config/assetRegistry";
import { useLanguage } from "../i18n";
import {
  resolvePlayerDisplayName,
  resolveSeatAvatarProps,
} from "../config/botCatalog";
import { formatTradeBundlePt } from "../utils/promptUtils";
import PlayerAvatar from "./PlayerAvatar";
import { ResourceIcon } from "./icons/GameIcons";
import "./TradeModal.scss";

const RESOURCE_ORDER: ResourceCard[] = [
  "WOOD",
  "BRICK",
  "SHEEP",
  "WHEAT",
  "ORE",
];

type TradeTab = "player" | "maritime";

type TradeModalProps = {
  open: boolean;
  onClose: () => void;
  tradeActions: MaritimeTradeAction[];
  playerState: PlayerState;
  playerKey: string;
  playerColor?: Color;
  gameState?: GameState;
  canOfferDomesticTrade?: boolean;
  reviewingActiveOffer?: boolean;
  canTradeMaritime?: boolean;
  onExecuteTrade: (action: GameAction) => Promise<void> | void;
};

function getOpponentResourceCount(gameState: GameState, color: Color): number {
  const idx = gameState.colors.indexOf(color);
  if (idx < 0) return 0;
  const key = `P${idx}`;
  const summary = gameState.player_state?.[`${key}_NUM_RESOURCES_IN_HAND`];
  if (typeof summary === "number") return summary;
  return RESOURCE_ORDER.reduce(
    (sum, res) => sum + (Number(gameState.player_state?.[`${key}_${res}_IN_HAND`]) || 0),
    0
  );
}

export default function TradeModal({
  open,
  onClose,
  tradeActions,
  playerState,
  playerKey,
  playerColor,
  gameState,
  canOfferDomesticTrade = false,
  reviewingActiveOffer = false,
  canTradeMaritime = true,
  onExecuteTrade,
}: TradeModalProps) {
  const { language, t } = useLanguage();
  const resourceMeta = getResourceMeta(language);
  const colorMeta = getPlayerColorMeta(language);
  const [tab, setActiveTab] = useState<TradeTab | null>(null);
  const [offerCounts, setOfferCounts] = useState<number[]>([0, 0, 0, 0, 0]);
  const [askCounts, setAskCounts] = useState<number[]>([0, 0, 0, 0, 0]);
  const [submitting, setSubmitting] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [maritimeTradeCompleted, setMaritimeTradeCompleted] = useState(false);
  const [trackedOffer, setTrackedOffer] = useState<number | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<Color | null>(null);
  const submittingRef = useRef(false);
  const partnerGroup = useId();

  const parsedTrades = useMemo(() => {
    const byGive: Partial<
      Record<
        ResourceCard,
        {
          rate: number;
          actionsByReceive: Partial<Record<ResourceCard, MaritimeTradeAction>>;
        }
      >
    > = {};

    for (const action of tradeActions) {
      const payload = action[2];
      const offeredList = payload
        .slice(0, 4)
        .filter((r): r is ResourceCard => r !== null);
      const giveRes = offeredList[0];
      const rate = offeredList.length;
      const receiveRes = payload[4] as ResourceCard | null;
      if (!giveRes || !receiveRes) continue;

      const existing = byGive[giveRes];
      if (!existing || rate < existing.rate) {
        byGive[giveRes] = {
          rate,
          actionsByReceive: {
            ...(existing?.actionsByReceive ?? {}),
            [receiveRes]: action,
          },
        };
      } else if (rate === existing.rate) {
        existing.actionsByReceive[receiveRes] = action;
      }
    }
    return byGive;
  }, [tradeActions]);

  const availableGiveResources = useMemo(
    () => RESOURCE_ORDER.filter((r) => !!parsedTrades[r]),
    [parsedTrades]
  );

  const [givePreference, setSelectedGive] = useState<ResourceCard | null>(null);
  const [receivePreference, setSelectedReceive] = useState<ResourceCard | null>(null);
  const selectedGive = givePreference && parsedTrades[givePreference]
    ? givePreference
    : availableGiveResources[0] ?? null;
  const receiveOptions = selectedGive ? parsedTrades[selectedGive]?.actionsByReceive : undefined;
  const selectedReceive = receivePreference && receiveOptions?.[receivePreference]
    ? receivePreference
    : RESOURCE_ORDER.find((resource) => receiveOptions?.[resource]) ?? null;

  const effectiveColor: Color =
    playerColor ?? gameState?.current_color ?? "RED";

  const opponents = useMemo(() => {
    if (!gameState) return [];
    return gameState.colors
      .filter((c) => c !== effectiveColor)
      .map((color) => {
        const seatIndex = Math.max(0, gameState.colors.indexOf(color));
        const isBot = gameState.bot_colors.includes(color);
        const name = resolvePlayerDisplayName(
          gameState,
          color,
          colorMeta[color]?.label || color
        );
        return {
          color,
          name,
          cardCount: getOpponentResourceCount(gameState, color),
          avatarProps: resolveSeatAvatarProps({
            color,
            isBot,
            seatIndex,
            seatName: name,
            seatAvatar: gameState.seat_avatars?.[color],
          }),
        };
      });
  }, [gameState, effectiveColor, colorMeta]);

  const records = gameState?.action_records ?? [];
  let activeOfferIndex = -1;
  if (reviewingActiveOffer) {
    for (let i = records.length - 1; i >= 0; i--) {
      const [action] = records[i];
      if (action[1] === "OFFER_TRADE" && action[0] === effectiveColor) {
        activeOfferIndex = i;
        break;
      }
    }
  }
  const offerIndex = activeOfferIndex >= 0 ? activeOfferIndex : trackedOffer;
  const offerAction = offerIndex === null ? undefined : records[offerIndex]?.[0];
  const offerBundle = offerAction?.[1] === "OFFER_TRADE" ? offerAction[2] : gameState?.current_trade;
  const reviewingOffer = reviewingActiveOffer || offerIndex !== null;
  const activeTab = reviewingOffer ? "player" : tab ?? (canOfferDomesticTrade ? "player" : "maritime");

  useEffect(() => {
    if (open && activeOfferIndex >= 0) setTrackedOffer(activeOfferIndex);
  }, [open, activeOfferIndex]);

  const responses = new Map<Color, "accepted" | "declined">();
  let confirmedPartner: Color | undefined;
  let cancelled = false;
  if (offerIndex !== null) {
    for (const [action] of records.slice(offerIndex + 1)) {
      if (action[1] === "ACCEPT_TRADE") responses.set(action[0], "accepted");
      else if (action[1] === "REJECT_TRADE") responses.set(action[0], "declined");
      else {
        if (action[1] === "CONFIRM_TRADE") confirmedPartner = action[2][10] as Color;
        if (action[1] === "CANCEL_TRADE") cancelled = true;
        break;
      }
    }
  }

  const confirmActions = reviewingActiveOffer && gameState?.current_prompt === "DECIDE_ACCEPTEES"
    ? gameState.current_playable_actions.filter(
        (action): action is ConfirmTradeAction => action[0] === effectiveColor && action[1] === "CONFIRM_TRADE"
      )
    : [];
  const cancelAction = reviewingActiveOffer && gameState?.current_prompt === "DECIDE_ACCEPTEES"
    ? gameState.current_playable_actions.find((action) => action[0] === effectiveColor && action[1] === "CANCEL_TRADE")
    : undefined;
  const confirmAction = confirmActions.length === 1
    ? confirmActions[0]
    : confirmActions.find((action) => action[2][10] === selectedPartner);
  const confirmedName = opponents.find((opponent) => opponent.color === confirmedPartner)?.name;
  let offerStatus = t("Aguardando as respostas da mesa.", "Waiting for players to respond.");
  if (confirmedName) {
    offerStatus = t(`Troca concluída com ${confirmedName}.`, `Trade completed with ${confirmedName}.`);
  } else if (cancelled) {
    offerStatus = t("Proposta cancelada.", "Offer cancelled.");
  } else if (!reviewingActiveOffer) {
    offerStatus = responses.size > 0 && opponents.every(({ color }) => responses.get(color) === "declined")
      ? t("Todos os jogadores recusaram a proposta.", "All players declined the offer.")
      : t("Proposta encerrada.", "Offer closed.");
  } else if (gameState?.current_prompt === "DECIDE_ACCEPTEES") {
    if (confirmActions.length > 1) {
      offerStatus = t("Escolha com quem deseja trocar.", "Choose who to trade with.");
    } else if (confirmActions.length === 1) {
      offerStatus = t("Um jogador aceitou. Você já pode confirmar.", "One player accepted. You can now confirm.");
    } else {
      offerStatus = t("Nenhum jogador disponível para concluir a troca.", "No player available to complete the trade.");
    }
  }

  const handleClose = () => {
    setActiveTab(null);
    setOfferCounts([0, 0, 0, 0, 0]);
    setAskCounts([0, 0, 0, 0, 0]);
    setSelectedGive(null);
    setSelectedReceive(null);
    setSelectedPartner(null);
    setTrackedOffer(null);
    setTradeError(null);
    setMaritimeTradeCompleted(false);
    onClose();
  };

  const activeTradeOption =
    selectedGive && selectedReceive
      ? parsedTrades[selectedGive]?.actionsByReceive[selectedReceive]
      : undefined;

  const activeRate = selectedGive ? parsedTrades[selectedGive]?.rate : undefined;

  const totalOffer = offerCounts.reduce((a, b) => a + b, 0);
  const totalAsk = askCounts.reduce((a, b) => a + b, 0);
  const hasOverlap = offerCounts.some(
    (qty, idx) => qty > 0 && askCounts[idx] > 0
  );
  const handValid = RESOURCE_ORDER.every(
    (res, idx) =>
      offerCounts[idx] <= (Number(playerState?.[`${playerKey}_${res}_IN_HAND`]) || 0)
  );
  const canSubmitDomestic =
    canOfferDomesticTrade &&
    totalOffer > 0 &&
    totalAsk > 0 &&
    !hasOverlap &&
    handValid;

  const adjustOffer = (idx: number, delta: number) => {
    const res = RESOURCE_ORDER[idx];
    const inHand = Number(playerState?.[`${playerKey}_${res}_IN_HAND`]) || 0;
    setTradeError(null);
    setOfferCounts((prev) => {
      const next = [...prev];
      next[idx] = Math.max(0, Math.min(inHand, prev[idx] + delta));
      return next;
    });
    if (delta > 0) {
      setAskCounts((prev) => {
        if (prev[idx] === 0) return prev;
        const next = [...prev];
        next[idx] = 0;
        return next;
      });
    }
  };

  const adjustAsk = (idx: number, delta: number) => {
    setTradeError(null);
    setAskCounts((prev) => {
      const next = [...prev];
      next[idx] = Math.max(0, Math.min(9, prev[idx] + delta));
      return next;
    });
    if (delta > 0) {
      setOfferCounts((prev) => {
        if (prev[idx] === 0) return prev;
        const next = [...prev];
        next[idx] = 0;
        return next;
      });
    }
  };

  const submitTrade = async (action: GameAction) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setTradeError(null);
    setMaritimeTradeCompleted(false);
    try {
      await onExecuteTrade(action);
      if (action[1] === "MARITIME_TRADE") setMaritimeTradeCompleted(true);
    } catch {
      setTradeError(t(
        "Não foi possível enviar a jogada de troca. Tente novamente.",
        "Could not submit the trade action. Try again."
      ));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleConfirm = () => {
    if (activeTab === "maritime") {
      if (canTradeMaritime && activeTradeOption) void submitTrade(activeTradeOption);
    } else if (canSubmitDomestic) {
      const payload = [...offerCounts, ...askCounts] as TradeOfferTuple;
      void submitTrade([effectiveColor, "OFFER_TRADE", payload]);
    }
  };

  const anyOpponentHasCards = opponents.some((opp) => opp.cardCount > 0);

  return (
    <Dialog
      open={open}
      onClose={(_, reason) => {
        if (!submitting && reason !== "backdropClick") handleClose();
      }}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        className: "catan-modal-paper trade-modal-paper",
      }}
    >
      <DialogTitle className="catan-modal-title">
        <span>⚖️ {t("Central de Negociação", "Trade Center")}</span>
        {!reviewingOffer && <small className="catan-modal-subtitle">
          {t(
            "Proponha trocas diretas com jogadores ou negocie com o Banco & Portos",
            "Propose direct trades with players or trade with the Bank & Ports"
          )}
        </small>}
      </DialogTitle>

      <DialogContent className="catan-modal-content">
        {!reviewingOffer && <div
          className="trade-tabs"
          role="tablist"
          aria-label={t("Tipo de negociação", "Trade type")}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "player"}
            className={`trade-tab-btn ${activeTab === "player" ? "is-active" : ""}`}
            onClick={() => {
              setTradeError(null);
              setMaritimeTradeCompleted(false);
              setActiveTab("player");
            }}
          >
            🤝 {t("Entre Jogadores", "Offer to Players")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "maritime"}
            className={`trade-tab-btn ${activeTab === "maritime" ? "is-active" : ""}`}
            onClick={() => {
              setTradeError(null);
              setActiveTab("maritime");
            }}
          >
            ⚓ {t("Porto & Banco", "Bank / Port")}
          </button>
        </div>}

        {tradeError && (
          <div className="trade-p2p-warning" role="alert">
            ⚠️ {tradeError}
          </div>
        )}
        {activeTab === "maritime" && maritimeTradeCompleted && (
          <p className="trade-offer-status" role="status">
            {t("Troca com Porto ou Banco concluída.", "Bank or port trade completed.")}
          </p>
        )}

        {reviewingOffer ? (
          <div className="trade-workbench">
            {offerBundle && (
              <div className="trade-summary-pill">
                <span>{t("Você oferece", "You offer")} <strong>{formatTradeBundlePt(offerBundle.slice(0, 5), language)}</strong></span>
                <span aria-hidden="true">⇄</span>
                <span>{t("Você pede", "You request")} <strong>{formatTradeBundlePt(offerBundle.slice(5, 10), language)}</strong></span>
              </div>
            )}
            <p className="trade-offer-status" role="status">{offerStatus}</p>
            <div className="trade-response-list" role="group" aria-label={t("Respostas à proposta", "Offer responses")}>
              {opponents.map(({ color, name, avatarProps }) => {
                const canSelect = confirmActions.some((action) => action[2][10] === color);
                const accepted = responses.get(color) === "accepted" || canSelect ||
                  Boolean(reviewingActiveOffer && gameState?.acceptees?.[gameState.colors.indexOf(color)]);
                const declined = responses.get(color) === "declined";
                const status = accepted ? t("aceitou", "accepted") : declined ? t("recusou", "declined") : t("aguardando", "waiting");
                return (
                  <label className="trade-response-row" key={color}>
                    <PlayerAvatar config={avatarProps.config} username={avatarProps.username} size={30} />
                    <span>{name} · {status}</span>
                    {confirmActions.length > 1 && canSelect && (
                      <input
                        type="radio"
                        name={partnerGroup}
                        checked={selectedPartner === color}
                        disabled={submitting}
                        onChange={() => setSelectedPartner(color)}
                      />
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        ) : activeTab === "player" ? (
          <div className="trade-workbench">
            {opponents.length > 0 && (
              <div
                className="trade-partners-strip"
                aria-label={t("Adversários na mesa", "Opponents at the table")}
              >
                {opponents.map((opp) => (
                  <div
                    key={opp.color}
                    className={`trade-partner-chip ${opp.cardCount === 0 ? "is-empty" : ""}`}
                  >
                    <PlayerAvatar
                      config={opp.avatarProps.config}
                      username={opp.avatarProps.username}
                      size={24}
                    />
                    <strong>{opp.name}</strong>
                    <span>
                      ({opp.cardCount}{" "}
                      {opp.cardCount === 1
                        ? t("carta", "card")
                        : t("cartas", "cards")}
                      )
                    </span>
                  </div>
                ))}
              </div>
            )}

            {opponents.length > 0 && !anyOpponentHasCards && (
              <div className="trade-p2p-warning">
                {t(
                  "Nenhum adversário tem cartas na mão agora. Você ainda pode enviar a proposta ou usar a aba",
                  "No opponent has cards in hand right now. You can still send an offer or use the"
                )}{" "}
                <strong>{t("Porto & Banco", "Bank / Port")}</strong>
                {t("!", " tab!")}
              </div>
            )}

            {/* Step 1: Offer from Hand */}
            <div className="trade-section">
              <div className="trade-section__header">
                <span>
                  {t(
                    "1. Você Oferece da sua Mão",
                    "1. You Offer from Your Hand"
                  )}
                </span>
                {(totalOffer > 0 || totalAsk > 0) && (
                  <button
                    type="button"
                    className="trade-clear-link"
                    onClick={() => {
                      setOfferCounts([0, 0, 0, 0, 0]);
                      setAskCounts([0, 0, 0, 0, 0]);
                    }}
                  >
                    {t("Limpar proposta", "Clear offer")}
                  </button>
                )}
              </div>
              <div className="trade-resource-grid">
                {RESOURCE_ORDER.map((res, idx) => {
                  const meta = resourceMeta[res];
                  const inHand =
                    Number(playerState?.[`${playerKey}_${res}_IN_HAND`]) || 0;
                  const qty = offerCounts[idx];

                  return (
                    <div
                      key={res}
                      className={`trade-res-card trade-res-card--p2p ${qty > 0 ? "selected" : ""}`}
                      style={{
                        borderColor: qty > 0 ? meta.accentColor : undefined,
                      }}
                    >
                      <ResourceIcon resource={res} size={28} />
                      <span className="trade-res-card__name">{meta.label}</span>
                      <span className="trade-res-card__hand">
                        {t("Na mão:", "In hand:")} <strong>{inHand}</strong>
                      </span>
                      <div className="trade-stepper">
                        <button
                          type="button"
                          className="trade-stepper__btn"
                          aria-label={t(
                            `Remover oferta de ${meta.label}`,
                            `Decrease ${meta.label} offer`
                          )}
                          disabled={qty <= 0 || submitting}
                          onClick={() => adjustOffer(idx, -1)}
                        >
                          −
                        </button>
                        <span
                          className="trade-stepper__qty"
                          data-testid={`offer-qty-${res}`}
                        >
                          {qty}
                        </span>
                        <button
                          type="button"
                          className="trade-stepper__btn"
                          aria-label={t(
                            `Adicionar oferta de ${meta.label}`,
                            `Increase ${meta.label} offer`
                          )}
                          disabled={qty >= inHand || submitting}
                          onClick={() => adjustOffer(idx, 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* P2P Summary */}
            <div className="trade-exchange-divider">
              {totalOffer > 0 && totalAsk > 0 ? (
                <div className="trade-summary-pill">
                  <span>
                    {t("Oferece:", "You offer:")}{" "}
                    <strong>{formatTradeBundlePt(offerCounts, language)}</strong>
                  </span>
                  <span className="trade-summary-pill__arrow">➔</span>
                  <span>
                    {t("Pede:", "You receive:")}{" "}
                    <strong>{formatTradeBundlePt(askCounts, language)}</strong>
                  </span>
                </div>
              ) : (
                <span>
                  {t(
                    "Escolha ao menos 1 recurso para oferecer e 1 para pedir",
                    "Choose at least 1 resource to offer and 1 to receive"
                  )}
                </span>
              )}
            </div>

            {/* Step 2: Ask from Table */}
            <div className="trade-section">
              <div className="trade-section__header">
                <span>
                  {t("2. Você Pede em Troca", "2. You Request in Return")}
                </span>
              </div>
              <div className="trade-resource-grid">
                {RESOURCE_ORDER.map((res, idx) => {
                  const meta = resourceMeta[res];
                  const qty = askCounts[idx];

                  return (
                    <div
                      key={res}
                      className={`trade-res-card trade-res-card--p2p ${qty > 0 ? "selected" : ""}`}
                      style={{
                        borderColor: qty > 0 ? meta.accentColor : undefined,
                      }}
                    >
                      <ResourceIcon resource={res} size={28} />
                      <span className="trade-res-card__name">{meta.label}</span>
                      <span className="trade-res-card__hand">
                        {offerCounts[idx] > 0
                          ? t("Em oferta", "Offering")
                          : t("Pedir", "Request")}
                      </span>
                      <div className="trade-stepper">
                        <button
                          type="button"
                          className="trade-stepper__btn"
                          aria-label={t(
                            `Remover pedido de ${meta.label}`,
                            `Decrease ${meta.label} request`
                          )}
                          disabled={qty <= 0 || submitting}
                          onClick={() => adjustAsk(idx, -1)}
                        >
                          −
                        </button>
                        <span
                          className="trade-stepper__qty"
                          data-testid={`ask-qty-${res}`}
                        >
                          {qty}
                        </span>
                        <button
                          type="button"
                          className="trade-stepper__btn"
                          aria-label={t(
                            `Adicionar pedido de ${meta.label}`,
                            `Increase ${meta.label} request`
                          )}
                          disabled={qty >= 9 || submitting}
                          onClick={() => adjustAsk(idx, 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : availableGiveResources.length === 0 ? (
          <div className="trade-maritime-empty">
            {t(
              "Você ainda não possui cartas suficientes para trocar com o banco (4:1) ou com seus portos. Tente enviar uma proposta na aba",
              "You don't have enough cards yet to trade with the bank (4:1) or your ports. Try sending an offer on the"
            )}{" "}
            <strong>{t("Entre Jogadores", "Offer to Players")}</strong>
            {t("!", " tab!")}
          </div>
        ) : (
          <div className="trade-workbench">
            {/* Step 1: Resource to Give */}
            <div className="trade-section">
              <div className="trade-section__header">
                <span>{t("1. Você Entrega", "1. You Give")}</span>
                {selectedGive && activeRate && (
                  <span className="trade-rate-badge">
                    {t("Taxa ativa:", "Active rate:")}{" "}
                    <strong>{activeRate}:1</strong>{" "}
                    {activeRate === 2
                      ? t("(Porto Especializado)", "(Specialized Port)")
                      : activeRate === 3
                        ? t("(Porto 3:1)", "(3:1 Port)")
                        : t("(Banco)", "(Bank)")}
                  </span>
                )}
              </div>
              <div className="trade-resource-grid">
                {RESOURCE_ORDER.map((res) => {
                  const meta = resourceMeta[res];
                  const inHand = playerState[`${playerKey}_${res}_IN_HAND`] ?? 0;
                  const option = parsedTrades[res];
                  const disabled = !option;
                  const isSelected = selectedGive === res;

                  return (
                    <button
                      key={res}
                      type="button"
                      disabled={disabled}
                      className={`trade-res-card ${isSelected ? "selected" : ""}`}
                      style={{
                        borderColor: isSelected ? meta.accentColor : undefined,
                      }}
                      onClick={() => {
                        setSelectedGive(res);
                        if (
                          selectedReceive === res ||
                          !option?.actionsByReceive[selectedReceive!]
                        ) {
                          const nextRec =
                            RESOURCE_ORDER.find(
                              (r) => r !== res && option?.actionsByReceive[r]
                            ) ?? null;
                          setSelectedReceive(nextRec);
                        }
                      }}
                    >
                      <div className="trade-res-card__rate">
                        {option ? `${option.rate}:1` : "—"}
                      </div>
                      <ResourceIcon resource={res} size={32} />
                      <span className="trade-res-card__name">{meta.label}</span>
                      <span className="trade-res-card__hand">
                        {t("Na mão:", "In hand:")} <strong>{inHand}</strong>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Exchange Summary Arrow */}
            <div className="trade-exchange-divider">
              {selectedGive && selectedReceive && activeRate ? (
                <div className="trade-summary-pill">
                  <span>
                    {t("Entregar", "Give")} <strong>{activeRate}x</strong>{" "}
                    {resourceMeta[selectedGive].label}
                  </span>
                  <span className="trade-summary-pill__arrow">➔</span>
                  <span>
                    {t("Receber", "Receive")} <strong>1x</strong>{" "}
                    {resourceMeta[selectedReceive].label}
                  </span>
                </div>
              ) : (
                <span>
                  {t(
                    "Selecione os recursos da troca",
                    "Select resources to trade"
                  )}
                </span>
              )}
            </div>

            {/* Step 2: Resource to Receive */}
            <div className="trade-section">
              <div className="trade-section__header">
                <span>
                  {t("2. Você Recebe (1 Carta)", "2. You Receive (1 Card)")}
                </span>
              </div>
              <div className="trade-resource-grid">
                {RESOURCE_ORDER.map((res) => {
                  const meta = resourceMeta[res];
                  const inHand = playerState[`${playerKey}_${res}_IN_HAND`] ?? 0;
                  const canReceive =
                    !!selectedGive &&
                    res !== selectedGive &&
                    !!parsedTrades[selectedGive]?.actionsByReceive[res];
                  const isSelected = selectedReceive === res;

                  return (
                    <button
                      key={res}
                      type="button"
                      disabled={!canReceive}
                      className={`trade-res-card ${isSelected ? "selected" : ""}`}
                      style={{
                        borderColor: isSelected ? meta.accentColor : undefined,
                      }}
                      onClick={() => setSelectedReceive(res)}
                    >
                      <div className="trade-res-card__rate">+1</div>
                      <ResourceIcon resource={res} size={32} />
                      <span className="trade-res-card__name">{meta.label}</span>
                      <span className="trade-res-card__hand">
                        {t("Na mão:", "In hand:")} <strong>{inHand}</strong>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </DialogContent>

      <DialogActions className="catan-modal-actions">
        <Button
          onClick={handleClose}
          disabled={submitting}
          className="catan-btn-secondary"
        >
          {t("Fechar", "Close")}
        </Button>
        {reviewingOffer ? (
          <>
            {cancelAction && (
              <Button color="error" disabled={submitting} onClick={() => submitTrade(cancelAction)}>
                {t("Cancelar proposta", "Cancel offer")}
              </Button>
            )}
            {confirmActions.length > 0 && (
              <Button
                variant="contained"
                disabled={submitting || !confirmAction}
                onClick={() => confirmAction && submitTrade(confirmAction)}
                className="catan-btn-primary"
              >
                {t("Confirmar troca", "Confirm trade")}
              </Button>
            )}
          </>
        ) : (
          <Button
            variant="contained"
            disabled={submitting || (activeTab === "maritime" ? !canTradeMaritime || !activeTradeOption : !canSubmitDomestic)}
            onClick={handleConfirm}
            className="catan-btn-primary"
          >
            {activeTab === "player"
              ? t("Enviar Proposta à Mesa", "Send Offer")
              : t("Confirmar Troca", "Confirm Trade")}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
