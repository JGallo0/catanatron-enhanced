import { useMemo, useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import type {
  AcceptTradeAction,
  Color,
  ConfirmTradeAction,
  GameAction,
  GameState,
  RejectTradeAction,
  ResourceCard,
} from "../utils/api.types";
import { PLAYER_COLOR_META, RESOURCE_META } from "../config/assetRegistry";
import {
  resolvePlayerDisplayName,
  resolveSeatAvatarProps,
} from "../config/botCatalog";
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
};

export default function TradeOfferDecisionDialog({
  open,
  onMinimize,
  gameState,
  humanColor,
  onExecuteAction,
}: TradeOfferDecisionDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setSubmitting(false);
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
    PLAYER_COLOR_META[proposerColor]?.label || proposerColor
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

  if (!isDecideTrade && !isDecideAcceptees) {
    return null;
  }

  const accepteeColors = new Set(confirmActions.map((a) => a[2][10] as Color));
  const declinedOpponents = isDecideAcceptees
    ? gameState.colors.filter(
        (c) => c !== humanColor && !accepteeColors.has(c)
      )
    : [];

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onMinimize}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        className: "catan-modal-paper trade-decision-paper",
      }}
    >
      <DialogTitle className="catan-modal-title">
        <span>
          {isDecideTrade
            ? "🤝 Proposta de Troca Recebida"
            : "⚖️ Respostas à sua Proposta"}
        </span>
        <small className="catan-modal-subtitle">
          {isDecideTrade
            ? `${proposerName} propôs uma negociação com você`
            : "Escolha com qual jogador deseja concluir a troca"}
        </small>
      </DialogTitle>

      <DialogContent className="catan-modal-content">
        {isDecideTrade ? (
          <>
            <div className="trade-decision-proposer">
              <PlayerAvatar
                config={proposerAvatar.config}
                username={proposerAvatar.username}
                size={42}
              />
              <div className="trade-decision-proposer__info">
                <strong>{proposerName}</strong>
                <span>Deseja trocar cartas com você agora</span>
              </div>
            </div>

            <div className="trade-decision-sides">
              <div className="trade-decision-box trade-decision-box--gain">
                <span className="trade-decision-box__title">Você Recebe</span>
                <div className="trade-decision-chips">
                  {RESOURCE_ORDER.map((res, idx) => {
                    const qty = Number(offering[idx] || 0);
                    if (qty <= 0) return null;
                    return (
                      <span key={res} className="trade-decision-chip">
                        <ResourceIcon resource={res} size={18} />
                        <strong>+{qty}</strong> {RESOURCE_META[res].label}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="trade-decision-arrow" aria-hidden="true">
                ⇄
              </div>

              <div className="trade-decision-box trade-decision-box--give">
                <span className="trade-decision-box__title">Você Entrega</span>
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
                        <strong>−{qty}</strong> {RESOURCE_META[res].label} (tem{" "}
                        {held})
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {!acceptAction && (
              <div className="trade-decision-shortage" role="status">
                Você não possui todas as cartas pedidas nesta proposta.
              </div>
            )}
          </>
        ) : (
          <>
            <div className="trade-decision-sides">
              <div className="trade-decision-box trade-decision-box--give">
                <span className="trade-decision-box__title">Você Entrega</span>
                <div className="trade-decision-chips">
                  {RESOURCE_ORDER.map((res, idx) => {
                    const qty = Number(offering[idx] || 0);
                    if (qty <= 0) return null;
                    return (
                      <span key={res} className="trade-decision-chip">
                        <ResourceIcon resource={res} size={18} />
                        <strong>−{qty}</strong> {RESOURCE_META[res].label}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="trade-decision-arrow" aria-hidden="true">
                ⇄
              </div>

              <div className="trade-decision-box trade-decision-box--gain">
                <span className="trade-decision-box__title">Você Recebe</span>
                <div className="trade-decision-chips">
                  {RESOURCE_ORDER.map((res, idx) => {
                    const qty = Number(asking[idx] || 0);
                    if (qty <= 0) return null;
                    return (
                      <span key={res} className="trade-decision-chip">
                        <ResourceIcon resource={res} size={18} />
                        <strong>+{qty}</strong> {RESOURCE_META[res].label}
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
                  PLAYER_COLOR_META[partnerColor]?.label || partnerColor
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
                      <strong>{partnerName} aceitou</strong>
                    </span>
                    <span className="trade-acceptee-btn__cta">
                      Trocar com {partnerName}
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
                    PLAYER_COLOR_META[decliner]?.label || decliner
                  );
                  return (
                    <span key={decliner} className="trade-decliner-tag">
                      ❌ {name} recusou
                    </span>
                  );
                })}
              </div>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions className="catan-modal-actions trade-decision-actions">
        <Button
          onClick={onMinimize}
          disabled={submitting}
          className="catan-btn-secondary"
        >
          Ver Tabuleiro
        </Button>

        {isDecideTrade ? (
          <>
            <Button
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
              ❌ Recusar
            </Button>
            <Button
              variant="contained"
              disabled={submitting || !acceptAction}
              onClick={() => acceptAction && runAction(acceptAction)}
              className="catan-btn-primary"
            >
              ✅ Aceitar Troca
            </Button>
          </>
        ) : (
          <Button
            variant="outlined"
            color="error"
            disabled={submitting}
            onClick={() =>
              runAction(cancelAction ?? [humanColor, "CANCEL_TRADE", null])
            }
          >
            🚫 Cancelar Troca
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
