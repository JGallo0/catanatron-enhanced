import React, { useCallback, useContext } from "react";
import cn from "classnames";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import Drawer from "@mui/material/Drawer";
import Button from "@mui/material/Button";

import Hidden from "./Hidden";
import PlayerStateBox from "./PlayerStateBox";
import { humanizeActionRecord } from "../utils/promptUtils";
import { store } from "../store";
import ACTIONS from "../actions";
import { getHumanColor, playerKey } from "../utils/stateUtils";
import { type GameActionRecord, type GameState } from "../utils/api.types";
import { isTabOrShift, type InteractionEvent } from "../utils/events";
import { PLAYER_COLOR_META } from "../config/assetRegistry";

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
  const humanColor = getHumanColor(gameState);
  if (!humanColor) {
    return null;
  }
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
          ? "Showing only what your seat can see"
          : "Showing every hand, as a spectator"
      }
    >
      {seated ? `👁️ Visão: ${humanColor}` : "👁️ Espectador (Mãos Abertas)"}
    </Button>
  );
}

function DrawerContent({ gameState }: { gameState: GameState }) {
  const playerSections = gameState.colors.map((color) => {
    const key = playerKey(gameState, color);
    const isCurrentTurn = gameState.current_color === color;
    const isBot = gameState.bot_colors.includes(color);
    return (
      <React.Fragment key={color}>
        <PlayerStateBox
          playerState={gameState.player_state}
          playerKey={key}
          color={color}
          isCurrentTurn={isCurrentTurn}
          isBot={isBot}
          customName={gameState.seat_names?.[color]}
        />
      </React.Fragment>
    );
  });

  return (
    <div className="left-drawer__container">
      <div className="left-drawer__top-bar">
        <div className="left-drawer__game-meta">
          <span className="left-drawer__meta-pill">
            🏆 Meta: <strong>{gameState.game?.vps_to_win ?? 10} PV</strong>
          </span>
          <span className="left-drawer__meta-pill">
            🔄 Turno: <strong>{gameState.num_turns ?? 0}</strong>
          </span>
        </div>
        <PerspectiveToggle gameState={gameState} />
      </div>

      <div className="left-drawer__players-list">{playerSections}</div>

      <div className="left-drawer__log-header">
        <span>📜 Histórico de Jogadas</span>
        <small>{gameState.action_records.length} ações</small>
      </div>

      <div className="log">
        {gameState.action_records
          .slice()
          .reverse()
          .map((actionRecord, i) => {
            const color = actionRecord[0][0];
            const palette = PLAYER_COLOR_META[color];
            return (
              <div
                key={i}
                className={cn("action foreground", color, {
                  "action--roll": actionRecord[0][1] === "ROLL",
                  "action--end": actionRecord[0][1] === "END_TURN",
                })}
              >
                <span
                  className="action__dot"
                  style={{ background: palette.primary }}
                />
                <span className="action__icon" aria-hidden="true">
                  {actionIcon(actionRecord)}
                </span>
                <span className="action__text">
                  {humanizeActionRecord(gameState, actionRecord)}
                </span>
              </div>
            );
          })}
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
    <>
      <Hidden breakpoint={{ size: "md", direction: "up" }} implementation="js">
        <SwipeableDrawer
          className="left-drawer"
          anchor="left"
          open={state.isLeftDrawerOpen}
          onClose={closeLeftDrawer}
          onOpen={openLeftDrawer}
          disableBackdropTransition={!iOS}
          disableDiscovery={iOS}
          onKeyDown={closeLeftDrawer}
        >
          <DrawerContent gameState={state.gameState as GameState} />
        </SwipeableDrawer>
      </Hidden>
      <Hidden
        breakpoint={{ size: "sm", direction: "down" }}
        implementation="css"
      >
        <Drawer className="left-drawer" anchor="left" variant="permanent" open>
          <DrawerContent gameState={state.gameState as GameState} />
        </Drawer>
      </Hidden>
    </>
  );
}
