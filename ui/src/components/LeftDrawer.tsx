import { useCallback, useContext, useMemo } from "react";
import cn from "classnames";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import Button from "@mui/material/Button";

import { buildDetailedActionLogEntries } from "../utils/promptUtils";
import { store } from "../store";
import ACTIONS from "../actions";
import { getHumanColor } from "../utils/stateUtils";
import { type GameActionRecord, type GameState } from "../utils/api.types";
import { isTabOrShift, type InteractionEvent } from "../utils/events";
import { getPlayerColorMeta } from "../config/assetRegistry";
import { useLanguage } from "../i18n";

import "./LeftDrawer.scss";

function actionIcon(record: GameActionRecord): string {
  switch (record[0][1]) {
    case "ROLL":
      return "🎲";
    case "BUILD_SETTLEMENT":
      return "🏠";
    case "BUILD_CITY":
      return "🏰";
    case "BUILD_ROAD":
      return "🛤️";
    case "BUY_DEVELOPMENT_CARD":
      return "🃏";
    case "PLAY_KNIGHT_CARD":
      return "⚔️";
    case "PLAY_MONOPOLY":
      return "👑";
    case "PLAY_YEAR_OF_PLENTY":
      return "🌾";
    case "PLAY_ROAD_BUILDING":
      return "🔨";
    case "MOVE_ROBBER":
      return "🥷";
    case "MARITIME_TRADE":
      return "⚓";
    case "OFFER_TRADE":
      return "🤝";
    case "ACCEPT_TRADE":
      return "✅";
    case "REJECT_TRADE":
      return "❌";
    case "CONFIRM_TRADE":
      return "⚖️";
    case "CANCEL_TRADE":
      return "🚫";
    case "DISCARD_RESOURCE":
      return "🗑️";
    case "END_TURN":
      return "⏭️";
    default:
      return "•";
  }
}

function PerspectiveToggle({ gameState }: { gameState: GameState }) {
  const { state, dispatch } = useContext(store);
  const { language, t } = useLanguage();
  const humanColor = getHumanColor(gameState);
  if (!humanColor) {
    return null;
  }
  const colorMeta = getPlayerColorMeta(language);
  const colorLabel = colorMeta[humanColor]?.label || humanColor;
  const seated = state.perspective !== null;
  return (
    <Button
      className="perspective-toggle"
      size="small"
      onClick={() =>
        dispatch({
          type: ACTIONS.SET_PERSPECTIVE,
          data: seated ? null : humanColor,
        })
      }
      title={
        seated
          ? t(
              "Mostrando apenas o que seu assento pode ver",
              "Showing only what your seat can see"
            )
          : t(
              "Mostrando todas as mãos, como espectador",
              "Showing every hand, as a spectator"
            )
      }
    >
      {seated
        ? t(`👁️ Visão: ${colorLabel}`, `👁️ View: ${colorLabel}`)
        : t("👁️ Espectador (Mãos Abertas)", "👁️ Spectator (Open Hands)")}
    </Button>
  );
}

function DrawerContent({ gameState }: { gameState: GameState }) {
  const { language, t } = useLanguage();
  const colorMeta = getPlayerColorMeta(language);
  const actionCount = gameState.action_records.length;
  const detailedEntries = useMemo(
    () => buildDetailedActionLogEntries(gameState, language),
    [gameState, language]
  );

  return (
    <div className="left-drawer__container">
      <div className="left-drawer__top-bar">
        <div className="left-drawer__game-meta">
          <span className="left-drawer__meta-pill">
            🏆 {t("Meta:", "Goal:")}{" "}
            <strong>
              {gameState.game?.vps_to_win ?? 10} {t("PV", "VP")}
            </strong>
          </span>
          <span className="left-drawer__meta-pill">
            🔄 {t("Turno:", "Turn:")} <strong>{gameState.num_turns ?? 0}</strong>
          </span>
        </div>
        <PerspectiveToggle gameState={gameState} />
      </div>

      <div className="left-drawer__log-header">
        <span>📜 {t("Histórico de Jogadas", "Action Log")}</span>
        <small>
          {actionCount}{" "}
          {actionCount === 1 ? t("ação", "action") : t("ações", "actions")}
        </small>
      </div>

      <div className="log">
        {actionCount === 0 ? (
          <div className="action" style={{ opacity: 0.72 }}>
            <span className="action__text">
              {t("Nenhuma jogada registrada ainda.", "No actions recorded yet.")}
            </span>
          </div>
        ) : (
          detailedEntries
            .slice()
            .reverse()
            .map((entry, i) => {
              const { record: actionRecord, color, text, details } = entry;
              const palette = colorMeta[color];
              return (
                <div
                  key={i}
                  className={cn("action foreground", color, {
                    "action--roll": actionRecord[0][1] === "ROLL",
                    "action--end": actionRecord[0][1] === "END_TURN",
                    "action--robber":
                      actionRecord[0][1] === "MOVE_ROBBER" ||
                      actionRecord[0][1] === "PLAY_KNIGHT_CARD" ||
                      actionRecord[0][1] === "PLAY_MONOPOLY",
                  })}
                >
                  <div className="action__main">
                    <span
                      className="action__dot"
                      style={{ background: palette.primary }}
                    />
                    <span className="action__icon" aria-hidden="true">
                      {actionIcon(actionRecord)}
                    </span>
                    <span className="action__text">{text}</span>
                  </div>
                  {details.length > 0 && (
                    <div className="action__details">
                      {details.map((detail, dIdx) => (
                        <div key={dIdx} className="action__detail-row">
                          {detail}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
        )}
      </div>

      <div className="left-drawer__footer">
        Rule the Isle •{" "}
        {t("Baseado em Catanatron (GPL-3.0)", "Powered by Catanatron (GPL-3.0)")}
      </div>
    </div>
  );
}

export default function LeftDrawer() {
  const { state, dispatch } = useContext(store);
  const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  const openLeftDrawer = useCallback(
    (event: InteractionEvent) => {
      if (isTabOrShift(event)) {
        return;
      }
      dispatch({ type: ACTIONS.SET_LEFT_DRAWER_OPENED, data: true });
    },
    [dispatch]
  );

  const closeLeftDrawer = useCallback(
    (event: InteractionEvent) => {
      if (isTabOrShift(event)) {
        return;
      }
      dispatch({ type: ACTIONS.SET_LEFT_DRAWER_OPENED, data: false });
    },
    [dispatch]
  );

  return (
    <SwipeableDrawer
      className="left-drawer"
      anchor="left"
      open={state.isLeftDrawerOpen}
      onClose={closeLeftDrawer}
      onOpen={openLeftDrawer}
      disableBackdropTransition={!iOS}
      disableDiscovery={iOS}
    >
      <DrawerContent gameState={state.gameState as GameState} />
    </SwipeableDrawer>
  );
}
