import { useMemo, useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import type {
  Color,
  GameAction,
  GameState,
  MaritimeTradeAction,
  PlayerState,
  ResourceCard,
  TradeOfferTuple,
} from "../utils/api.types";
import { PLAYER_COLOR_META, RESOURCE_META } from "../config/assetRegistry";
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
  onExecuteTrade,
}: TradeModalProps) {
  const [activeTab, setActiveTab] = useState<TradeTab>("player");
  const [offerCounts, setOfferCounts] = useState<number[]>([0, 0, 0, 0, 0]);
  const [askCounts, setAskCounts] = useState<number[]>([0, 0, 0, 0, 0]);
  const [submitting, setSubmitting] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);

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

  const [selectedGive, setSelectedGive] = useState<ResourceCard | null>(null);
  const [selectedReceive, setSelectedReceive] = useState<ResourceCard | null>(
    null
  );

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
          PLAYER_COLOR_META[color]?.label || color
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
  }, [gameState, effectiveColor]);

  useEffect(() => {
    if (open) {
      setSubmitting(false);
      setTradeError(null);
      setOfferCounts([0, 0, 0, 0, 0]);
      setAskCounts([0, 0, 0, 0, 0]);
      setActiveTab(canOfferDomesticTrade ? "player" : "maritime");

      const firstGive = availableGiveResources[0] ?? null;
      setSelectedGive(firstGive);
      if (firstGive) {
        const firstReceive =
          RESOURCE_ORDER.find(
            (r) =>
              r !== firstGive && parsedTrades[firstGive]?.actionsByReceive[r]
          ) ?? null;
        setSelectedReceive(firstReceive);
      } else {
        setSelectedReceive(null);
      }
    }
  }, [open, availableGiveResources, parsedTrades, canOfferDomesticTrade]);

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

  const handleConfirm = async () => {
    if (submitting) return;
    setTradeError(null);
    if (activeTab === "maritime") {
      if (!activeTradeOption) return;
      try {
        setSubmitting(true);
        await onExecuteTrade(activeTradeOption);
        onClose();
      } catch (err) {
        setTradeError(
          err instanceof Error ? err.message : "Não foi possível concluir a troca."
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!canSubmitDomestic) return;
    const payload = [...offerCounts, ...askCounts] as TradeOfferTuple;
    try {
      setSubmitting(true);
      await onExecuteTrade([effectiveColor, "OFFER_TRADE", payload]);
      onClose();
    } catch (err) {
      setTradeError(
        err instanceof Error ? err.message : "Não foi possível enviar a proposta."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const anyOpponentHasCards = opponents.some((opp) => opp.cardCount > 0);

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        className: "catan-modal-paper trade-modal-paper",
      }}
    >
      <DialogTitle className="catan-modal-title">
        <span>⚖️ Central de Negociação</span>
        <small className="catan-modal-subtitle">
          Proponha trocas diretas com jogadores ou negocie com o Banco & Portos
        </small>
      </DialogTitle>

      <DialogContent className="catan-modal-content">
        <div className="trade-tabs" role="tablist" aria-label="Tipo de negociação">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "player"}
            className={`trade-tab-btn ${activeTab === "player" ? "is-active" : ""}`}
            onClick={() => {
              setTradeError(null);
              setActiveTab("player");
            }}
          >
            🤝 Entre Jogadores
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
            ⚓ Porto & Banco
          </button>
        </div>

        {tradeError && (
          <div className="trade-p2p-warning" role="alert">
            ⚠️ {tradeError}
          </div>
        )}

        {activeTab === "player" ? (
          <div className="trade-workbench">
            {opponents.length > 0 && (
              <div className="trade-partners-strip" aria-label="Adversários na mesa">
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
                      ({opp.cardCount} {opp.cardCount === 1 ? "carta" : "cartas"})
                    </span>
                  </div>
                ))}
              </div>
            )}

            {opponents.length > 0 && !anyOpponentHasCards && (
              <div className="trade-p2p-warning">
                Nenhum adversário tem cartas na mão agora. Você ainda pode enviar a
                proposta ou usar a aba <strong>Porto &amp; Banco</strong>.
              </div>
            )}

            {/* Step 1: Offer from Hand */}
            <div className="trade-section">
              <div className="trade-section__header">
                <span>1. Você Oferece da sua Mão</span>
                {(totalOffer > 0 || totalAsk > 0) && (
                  <button
                    type="button"
                    className="trade-clear-link"
                    onClick={() => {
                      setOfferCounts([0, 0, 0, 0, 0]);
                      setAskCounts([0, 0, 0, 0, 0]);
                    }}
                  >
                    Limpar proposta
                  </button>
                )}
              </div>
              <div className="trade-resource-grid">
                {RESOURCE_ORDER.map((res, idx) => {
                  const meta = RESOURCE_META[res];
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
                        Na mão: <strong>{inHand}</strong>
                      </span>
                      <div className="trade-stepper">
                        <button
                          type="button"
                          className="trade-stepper__btn"
                          aria-label={`Remover oferta de ${meta.label}`}
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
                          aria-label={`Adicionar oferta de ${meta.label}`}
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
                    Oferece: <strong>{formatTradeBundlePt(offerCounts)}</strong>
                  </span>
                  <span className="trade-summary-pill__arrow">➔</span>
                  <span>
                    Pede: <strong>{formatTradeBundlePt(askCounts)}</strong>
                  </span>
                </div>
              ) : (
                <span>
                  Escolha ao menos 1 recurso para oferecer e 1 para pedir
                </span>
              )}
            </div>

            {/* Step 2: Ask from Table */}
            <div className="trade-section">
              <div className="trade-section__header">
                <span>2. Você Pede em Troca</span>
              </div>
              <div className="trade-resource-grid">
                {RESOURCE_ORDER.map((res, idx) => {
                  const meta = RESOURCE_META[res];
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
                        {offerCounts[idx] > 0 ? "Em oferta" : "Pedir"}
                      </span>
                      <div className="trade-stepper">
                        <button
                          type="button"
                          className="trade-stepper__btn"
                          aria-label={`Remover pedido de ${meta.label}`}
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
                          aria-label={`Adicionar pedido de ${meta.label}`}
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
            Você ainda não possui cartas suficientes para trocar com o banco (4:1) ou
            com seus portos. Tente enviar uma proposta na aba{" "}
            <strong>Entre Jogadores</strong>!
          </div>
        ) : (
          <div className="trade-workbench">
            {/* Step 1: Resource to Give */}
            <div className="trade-section">
              <div className="trade-section__header">
                <span>1. Você Entrega</span>
                {selectedGive && activeRate && (
                  <span className="trade-rate-badge">
                    Taxa ativa: <strong>{activeRate}:1</strong>{" "}
                    {activeRate === 2
                      ? "(Porto Especializado)"
                      : activeRate === 3
                        ? "(Porto 3:1)"
                        : "(Banco)"}
                  </span>
                )}
              </div>
              <div className="trade-resource-grid">
                {RESOURCE_ORDER.map((res) => {
                  const meta = RESOURCE_META[res];
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
                        Na mão: <strong>{inHand}</strong>
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
                    Entregar <strong>{activeRate}x</strong>{" "}
                    {RESOURCE_META[selectedGive].label}
                  </span>
                  <span className="trade-summary-pill__arrow">➔</span>
                  <span>
                    Receber <strong>1x</strong>{" "}
                    {RESOURCE_META[selectedReceive].label}
                  </span>
                </div>
              ) : (
                <span>Selecione os recursos da troca</span>
              )}
            </div>

            {/* Step 2: Resource to Receive */}
            <div className="trade-section">
              <div className="trade-section__header">
                <span>2. Você Recebe (1 Carta)</span>
              </div>
              <div className="trade-resource-grid">
                {RESOURCE_ORDER.map((res) => {
                  const meta = RESOURCE_META[res];
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
                        Na mão: <strong>{inHand}</strong>
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
          onClick={onClose}
          disabled={submitting}
          className="catan-btn-secondary"
        >
          Cancelar
        </Button>
        <Button
          variant="contained"
          disabled={
            submitting ||
            (activeTab === "maritime" ? !activeTradeOption : !canSubmitDomestic)
          }
          onClick={handleConfirm}
          className="catan-btn-primary"
        >
          {activeTab === "player"
            ? "Enviar Proposta à Mesa"
            : "Confirmar Troca"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
