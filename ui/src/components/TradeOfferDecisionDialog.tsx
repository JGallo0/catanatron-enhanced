import { useMemo, useState, useEffect } from "react";
import { Button } from "@mui/material";
import type {
  AcceptTradeAction,
  Color,
  ConfirmTradeAction,
  GameAction,
  GameState,
  RejectTradeAction,
  ResourceCard,
} from "../utils/api.types";
import { getPlayerColorMeta, getResourceMeta } from "../config/assetRegistry";
import { useLanguage } from "../i18n";
import {
  resolvePlayerDisplayName,
  resolveSeatAvatarProps,
} from "../config/botCatalog";
import { formatTradeBundlePt } from "../utils/promptUtils";
import { playerKey } from "../utils/stateUtils";
import PlayerAvatar from "./PlayerAvatar";
import { ResourceIcon } from "./icons/GameIcons";
import "./TradeOfferDecisionDialog.scss";

const RESOURCE_ORDER: ResourceCard[] = [
  "WOOD",
  "BRICK",
  "SHEEP",
  "WHEAT",
  "ORE",
];

type TradeOfferDecisionDialogProps = {
  open: boolean;
  onMinimize: () => void;
  gameState: GameState;
  humanColor: Color;
  onExecuteAction: (action: GameAction) => Promise<void> | void;
  onSendChatMessage?: (body: string) => Promise<void> | void;
};

export default function TradeOfferDecisionDialog({
  open,
  onMinimize,
  gameState,
  humanColor,
  onExecuteAction,
  onSendChatMessage,
}: TradeOfferDecisionDialogProps) {
  const { language, t } = useLanguage();
  const resourceMeta = getResourceMeta(language);
  const colorMeta = getPlayerColorMeta(language);
  const [submitting, setSubmitting] = useState(false);
  const [counterOpen, setCounterOpen] = useState(false);
  const [counterOffer, setCounterOffer] = useState<number[]>([0, 0, 0, 0, 0]);
  const [counterAsk, setCounterAsk] = useState<number[]>([0, 0, 0, 0, 0]);

  useEffect(() => {
    setSubmitting(false);
    setCounterOpen(false);
  }, [gameState.state_index, gameState.current_prompt, open]);

  const prompt = gameState.current_prompt;
  const isDecideTrade = prompt === "DECIDE_TRADE";
  const isDecideAcceptees = prompt === "DECIDE_ACCEPTEES";

  const acceptAction = useMemo(
    () =>
      gameState.current_playable_actions.find(
        (a): a is AcceptTradeAction => a[1] === "ACCEPT_TRADE"
      ),
    [gameState.current_playable_actions]
  );

  const rejectAction = useMemo(
    () =>
      gameState.current_playable_actions.find(
        (a): a is RejectTradeAction => a[1] === "REJECT_TRADE"
      ),
    [gameState.current_playable_actions]
  );

  const confirmActions = useMemo(
    () =>
      gameState.current_playable_actions.filter(
        (a): a is ConfirmTradeAction => a[1] === "CONFIRM_TRADE"
      ),
    [gameState.current_playable_actions]
  );

  const cancelAction = useMemo(
    () =>
      gameState.current_playable_actions.find(
        (a) => a[1] === "CANCEL_TRADE"
      ),
    [gameState.current_playable_actions]
  );

  const rawTrade = useMemo(() => {
    if (isDecideTrade) {
      return (
        acceptAction?.[2] ??
        rejectAction?.[2] ??
        gameState.current_trade ??
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, gameState.current_turn_index]
      );
    }
    return (
      confirmActions[0]?.[2] ??
      gameState.current_trade ??
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, gameState.current_turn_index]
    );
  }, [
    isDecideTrade,
    acceptAction,
    rejectAction,
    confirmActions,
    gameState.current_trade,
    gameState.current_turn_index,
  ]);

  const offering = rawTrade.slice(0, 5) as number[];
  const asking = rawTrade.slice(5, 10) as number[];
  const proposerIdx =
    isDecideTrade && rawTrade.length > 10 && typeof rawTrade[10] === "number"
      ? rawTrade[10]
      : gameState.current_turn_index;
  const proposerColor: Color =
    gameState.colors[proposerIdx] ?? gameState.colors[0];
  const proposerName = resolvePlayerDisplayName(
    gameState,
    proposerColor,
    colorMeta[proposerColor]?.label || proposerColor
  );
  const proposerAvatar = resolveSeatAvatarProps({
    color: proposerColor,
    isBot: gameState.bot_colors.includes(proposerColor),
    seatIndex: Math.max(0, gameState.colors.indexOf(proposerColor)),
    seatName: proposerName,
    seatAvatar: gameState.seat_avatars?.[proposerColor],
  });

  const myKey = playerKey(gameState, humanColor);

  const runAction = async (action: GameAction) => {
    if (submitting) return;
    try {
      setSubmitting(true);
      await onExecuteAction(action);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || (!isDecideTrade && !isDecideAcceptees)) {
    return null;
  }

  const accepteeColors = new Set(confirmActions.map((a) => a[2][10] as Color));
  const declinedOpponents = isDecideAcceptees
    ? gameState.colors.filter(
        (c) => c !== humanColor && !accepteeColors.has(c)
      )
    : [];

  const openCounterEditor = () => {
    const initialOffer = RESOURCE_ORDER.map((res, idx) => {
      const held = Number(gameState.player_state?.[`${myKey}_${res}_IN_HAND`] || 0);
      return Math.min(held, Math.max(0, Number(asking[idx] || 0)));
    });
    const initialAsk = RESOURCE_ORDER.map((_, idx) =>
      Math.max(0, Number(offering[idx] || 0))
    );
    setCounterOffer(initialOffer);
    setCounterAsk(initialAsk);
    setCounterOpen(true);
  };

  const adjustCounterOffer = (idx: number, delta: number) => {
    const res = RESOURCE_ORDER[idx];
    const held = Number(gameState.player_state?.[`${myKey}_${res}_IN_HAND`] || 0);
    setCounterOffer((prev) => {
      const next = [...prev];
      next[idx] = Math.max(0, Math.min(held, prev[idx] + delta));
      return next;
    });
    if (delta > 0) {
      setCounterAsk((prev) => {
        if (prev[idx] === 0) return prev;
        const next = [...prev];
        next[idx] = 0;
        return next;
      });
    }
  };

  const adjustCounterAsk = (idx: number, delta: number) => {
    setCounterAsk((prev) => {
      const next = [...prev];
      next[idx] = Math.max(0, Math.min(9, prev[idx] + delta));
      return next;
    });
    if (delta > 0) {
      setCounterOffer((prev) => {
        if (prev[idx] === 0) return prev;
        const next = [...prev];
        next[idx] = 0;
        return next;
      });
    }
  };

  const totalCounterOffer = counterOffer.reduce((a, b) => a + b, 0);
  const totalCounterAsk = counterAsk.reduce((a, b) => a + b, 0);
  const counterOverlap = counterOffer.some(
    (qty, idx) => qty > 0 && counterAsk[idx] > 0
  );
  const canSendCounter =
    totalCounterOffer > 0 && totalCounterAsk > 0 && !counterOverlap;

  const handleConfirmCounter = async () => {
    if (submitting || !canSendCounter) return;
    setSubmitting(true);
    try {
      const offerText = formatTradeBundlePt(counterOffer, language);
      const askText = formatTradeBundlePt(counterAsk, language);
      const chatText = t(
        `⚖️ Contraproposta para ${proposerName}: ofereço ${offerText} em troca de ${askText}.`,
        `⚖️ Counter-offer to ${proposerName}: I offer ${offerText} in exchange for ${askText}.`
      );
      try {
        await onSendChatMessage?.(chatText);
      } catch {
        // Non-fatal if chat fails; rejection still unlocks the turn
      }
      await onExecuteAction(
        rejectAction ?? [
          humanColor,
          "REJECT_TRADE",
          rawTrade as RejectTradeAction[2],
        ]
      );
      setCounterOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <aside
      className="trade-decision-panel"
      role="dialog"
      aria-label={
        isDecideTrade
          ? t("Proposta de Troca Recebida", "Incoming Trade Offer")
          : t("Respostas à sua Proposta", "Responses to Your Offer")
      }
    >
      <header className="trade-decision-panel__header">
        <div className="trade-decision-panel__title">
          {isDecideTrade
            ? t("🤝 Proposta de Troca Recebida", "🤝 Incoming Trade Offer")
            : t("⚖️ Respostas à sua Proposta", "⚖️ Responses to Your Offer")}
        </div>
        <small className="trade-decision-panel__subtitle">
          {isDecideTrade
            ? t(
                `${proposerName} propôs uma negociação com você`,
                `${proposerName} proposed a trade with you`
              )
            : t(
                "Escolha com qual jogador deseja concluir a troca",
                "Choose which player to complete the trade with"
              )}
        </small>
      </header>

      <div className="trade-decision-panel__body">
        {isDecideTrade ? (
          <>
            <div className="trade-decision-proposer">
              <PlayerAvatar
                config={proposerAvatar.config}
                username={proposerAvatar.username}
                size={40}
              />
              <div className="trade-decision-proposer__info">
                <strong>{proposerName}</strong>
                <span>
                  {t(
                    "Deseja trocar cartas com você agora",
                    "Wants to trade cards with you now"
                  )}
                </span>
              </div>
            </div>

            <div className="trade-decision-sides">
              <div className="trade-decision-box trade-decision-box--gain">
                <span className="trade-decision-box__title">
                  {t("Você Recebe", "You Receive")}
                </span>
                <div className="trade-decision-chips">
                  {RESOURCE_ORDER.map((res, idx) => {
                    const qty = Number(offering[idx] || 0);
                    if (qty <= 0) return null;
                    return (
                      <span key={res} className="trade-decision-chip">
                        <ResourceIcon resource={res} size={18} />
                        <strong>+{qty}</strong> {resourceMeta[res].label}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="trade-decision-arrow" aria-hidden="true">
                ⇄
              </div>

              <div className="trade-decision-box trade-decision-box--give">
                <span className="trade-decision-box__title">
                  {t("Você Entrega", "You Give")}
                </span>
                <div className="trade-decision-chips">
                  {RESOURCE_ORDER.map((res, idx) => {
                    const qty = Number(asking[idx] || 0);
                    if (qty <= 0) return null;
                    const held = Number(
                      gameState.player_state?.[`${myKey}_${res}_IN_HAND`] || 0
                    );
                    const lacking = held < qty;
                    return (
                      <span
                        key={res}
                        className={`trade-decision-chip ${lacking ? "is-short" : ""}`}
                      >
                        <ResourceIcon resource={res} size={18} />
                        <strong>−{qty}</strong> {resourceMeta[res].label} (
                        {t("tem", "have")} {held})
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {!acceptAction && (
              <div className="trade-decision-shortage" role="status">
                {t(
                  "Você não possui todas as cartas pedidas nesta proposta.",
                  "You don't have all the cards requested in this offer."
                )}
              </div>
            )}

            {counterOpen && (
              <div
                className="trade-counter-box"
                role="region"
                aria-label={t("Editar contraproposta", "Edit counter-offer")}
              >
                <div className="trade-counter-box__head">
                  <strong>
                    ⚖️ {t("Sugerir Contraproposta", "Suggest Counter-offer")}
                  </strong>
                  <span>
                    {t(
                      "Envia no chat e recusa a atual",
                      "Sends in chat and declines current offer"
                    )}
                  </span>
                </div>

                <div className="trade-counter-section">
                  <span className="trade-counter-section__label">
                    {t("Você oferece:", "You offer:")}
                  </span>
                  <div className="trade-counter-row">
                    {RESOURCE_ORDER.map((res, idx) => {
                      const held = Number(
                        gameState.player_state?.[`${myKey}_${res}_IN_HAND`] || 0
                      );
                      const qty = counterOffer[idx];
                      return (
                        <div key={`co-${res}`} className="trade-counter-cell">
                          <ResourceIcon resource={res} size={16} />
                          <div className="trade-counter-cell__stepper">
                            <button
                              type="button"
                              aria-label={t(
                                `Diminuir oferta de ${resourceMeta[res].label}`,
                                `Decrease ${resourceMeta[res].label} offer`
                              )}
                              disabled={qty <= 0 || submitting}
                              onClick={() => adjustCounterOffer(idx, -1)}
                            >
                              −
                            </button>
                            <span>{qty}</span>
                            <button
                              type="button"
                              aria-label={t(
                                `Aumentar oferta de ${resourceMeta[res].label}`,
                                `Increase ${resourceMeta[res].label} offer`
                              )}
                              disabled={qty >= held || submitting}
                              onClick={() => adjustCounterOffer(idx, 1)}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="trade-counter-section">
                  <span className="trade-counter-section__label">
                    {t("Você pede:", "You request:")}
                  </span>
                  <div className="trade-counter-row">
                    {RESOURCE_ORDER.map((res, idx) => {
                      const qty = counterAsk[idx];
                      return (
                        <div key={`ca-${res}`} className="trade-counter-cell">
                          <ResourceIcon resource={res} size={16} />
                          <div className="trade-counter-cell__stepper">
                            <button
                              type="button"
                              aria-label={t(
                                `Diminuir pedido de ${resourceMeta[res].label}`,
                                `Decrease ${resourceMeta[res].label} request`
                              )}
                              disabled={qty <= 0 || submitting}
                              onClick={() => adjustCounterAsk(idx, -1)}
                            >
                              −
                            </button>
                            <span>{qty}</span>
                            <button
                              type="button"
                              aria-label={t(
                                `Aumentar pedido de ${resourceMeta[res].label}`,
                                `Increase ${resourceMeta[res].label} request`
                              )}
                              disabled={qty >= 9 || submitting}
                              onClick={() => adjustCounterAsk(idx, 1)}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="trade-counter-box__footer">
                  <Button
                    size="small"
                    disabled={submitting}
                    onClick={() => setCounterOpen(false)}
                    className="catan-btn-secondary"
                  >
                    {t("Voltar", "Back")}
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    disabled={submitting || !canSendCounter}
                    onClick={handleConfirmCounter}
                    className="catan-btn-primary"
                  >
                    {t("Enviar Contraproposta", "Send Counter-offer")}
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="trade-decision-sides">
              <div className="trade-decision-box trade-decision-box--give">
                <span className="trade-decision-box__title">
                  {t("Você Entrega", "You Give")}
                </span>
                <div className="trade-decision-chips">
                  {RESOURCE_ORDER.map((res, idx) => {
                    const qty = Number(offering[idx] || 0);
                    if (qty <= 0) return null;
                    return (
                      <span key={res} className="trade-decision-chip">
                        <ResourceIcon resource={res} size={18} />
                        <strong>−{qty}</strong> {resourceMeta[res].label}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="trade-decision-arrow" aria-hidden="true">
                ⇄
              </div>

              <div className="trade-decision-box trade-decision-box--gain">
                <span className="trade-decision-box__title">
                  {t("Você Recebe", "You Receive")}
                </span>
                <div className="trade-decision-chips">
                  {RESOURCE_ORDER.map((res, idx) => {
                    const qty = Number(asking[idx] || 0);
                    if (qty <= 0) return null;
                    return (
                      <span key={res} className="trade-decision-chip">
                        <ResourceIcon resource={res} size={18} />
                        <strong>+{qty}</strong> {resourceMeta[res].label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="trade-acceptees-list">
              {confirmActions.map((confirmAct) => {
                const partnerColor = confirmAct[2][10] as Color;
                const partnerName = resolvePlayerDisplayName(
                  gameState,
                  partnerColor,
                  colorMeta[partnerColor]?.label || partnerColor
                );
                const avatar = resolveSeatAvatarProps({
                  color: partnerColor,
                  isBot: gameState.bot_colors.includes(partnerColor),
                  seatIndex: Math.max(0, gameState.colors.indexOf(partnerColor)),
                  seatName: partnerName,
                  seatAvatar: gameState.seat_avatars?.[partnerColor],
                });

                return (
                  <button
                    key={partnerColor}
                    type="button"
                    className="trade-acceptee-btn"
                    disabled={submitting}
                    onClick={() => runAction(confirmAct)}
                  >
                    <span className="trade-acceptee-btn__left">
                      <PlayerAvatar
                        config={avatar.config}
                        username={avatar.username}
                        size={34}
                      />
                      <strong>
                        {partnerName} {t("aceitou", "accepted")}
                      </strong>
                    </span>
                    <span className="trade-acceptee-btn__cta">
                      {t("Trocar com", "Trade with")} {partnerName}
                    </span>
                  </button>
                );
              })}
            </div>

            {declinedOpponents.length > 0 && (
              <div className="trade-decliners-strip">
                {declinedOpponents.map((decliner) => {
                  const name = resolvePlayerDisplayName(
                    gameState,
                    decliner,
                    colorMeta[decliner]?.label || decliner
                  );
                  return (
                    <span key={decliner} className="trade-decliner-tag">
                      ❌ {name} {t("recusou", "declined")}
                    </span>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <footer className="trade-decision-panel__actions trade-decision-actions">
        <Button
          size="small"
          onClick={onMinimize}
          disabled={submitting}
          className="catan-btn-secondary"
        >
          {t("Ver Tabuleiro", "View Board")}
        </Button>

        {isDecideTrade ? (
          <>
            {!counterOpen && (
              <Button
                size="small"
                variant="outlined"
                color="warning"
                disabled={submitting}
                onClick={openCounterEditor}
              >
                ⚖️ {t("Contrapropor", "Counter-offer")}
              </Button>
            )}
            <Button
              size="small"
              variant="outlined"
              color="error"
              disabled={submitting}
              onClick={() =>
                runAction(
                  rejectAction ?? [
                    humanColor,
                    "REJECT_TRADE",
                    rawTrade as RejectTradeAction[2],
                  ]
                )
              }
            >
              ❌ {t("Recusar", "Decline")}
            </Button>
            <Button
              size="small"
              variant="contained"
              disabled={submitting || !acceptAction}
              onClick={() => acceptAction && runAction(acceptAction)}
              className="catan-btn-primary"
            >
              ✅ {t("Aceitar Troca", "Accept")}
            </Button>
          </>
        ) : (
          <Button
            size="small"
            variant="outlined"
            color="error"
            disabled={submitting}
            onClick={() =>
              runAction(cancelAction ?? [humanColor, "CANCEL_TRADE", null])
            }
          >
            🚫 {t("Cancelar Troca", "Cancel Trade")}
          </Button>
        )}
      </footer>
    </aside>
  );
}
