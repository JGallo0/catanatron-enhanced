import { useCallback, useContext, useEffect, useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import {
  useMediaQuery,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
} from "@mui/material";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import CenterFocusStrongIcon from "@mui/icons-material/CenterFocusStrong";
import { useSnackbar } from "notistack";

import useWindowSize from "../utils/useWindowSize";

import "./Board.scss";
import { store } from "../store";
import { isPlayersTurn, playerKey } from "../utils/stateUtils";
import { postAction } from "../utils/apiClient";
import type { CatanState } from "../store";
import { useParams } from "react-router-dom";
import ACTIONS from "../actions";
import Board from "./Board";
import type {
  Color,
  GameAction,
  MoveRobberAction,
  TileCoordinate,
} from "../utils/api.types";
import { PLAYER_COLOR_META } from "../config/assetRegistry";
import { dispatchSnackbar } from "../components/Snackbar";

function buildNodeActions(state: CatanState) {
  if (!state.gameState) throw new Error("GameState is not ready!");

  if (!isPlayersTurn(state.gameState, state.perspective)) {
    return {};
  }

  const nodeActions: Record<number, GameAction> = {};
  const inInitialBuildPhase = state.gameState.is_initial_build_phase;

  if (inInitialBuildPhase) {
    state.gameState.current_playable_actions
      .filter((action) => action[1] === "BUILD_SETTLEMENT")
      .forEach((action) => {
        nodeActions[action[2]] = action;
      });
  } else if (state.isBuildingSettlement) {
    state.gameState.current_playable_actions
      .filter((action) => action[1] === "BUILD_SETTLEMENT")
      .forEach((action) => {
        nodeActions[action[2]] = action;
      });
  } else if (state.isBuildingCity) {
    state.gameState.current_playable_actions
      .filter((action) => action[1] === "BUILD_CITY")
      .forEach((action) => {
        nodeActions[action[2]] = action;
      });
  }
  return nodeActions;
}

function buildEdgeActions(state: CatanState) {
  if (!state.gameState) throw new Error("GameState is not ready!");
  if (!isPlayersTurn(state.gameState, state.perspective)) {
    return {};
  }

  const edgeActions: Record<`${number},${number}`, GameAction> = {};
  const inInitialBuildPhase = state.gameState.is_initial_build_phase;
  if (inInitialBuildPhase) {
    state.gameState.current_playable_actions
      .filter((action) => action[1] === "BUILD_ROAD")
      .forEach((action) => {
        edgeActions[`${action[2][0]},${action[2][1]}`] = action;
      });
  } else if (state.isBuildingRoad || state.isRoadBuilding) {
    state.gameState.current_playable_actions
      .filter((action) => action[1] === "BUILD_ROAD")
      .forEach((action) => {
        edgeActions[`${action[2][0]},${action[2][1]}`] = action;
      });
  }
  return edgeActions;
}

type ZoomableBoardProps = {
  replayMode: boolean;
};

export default function ZoomableBoard({ replayMode }: ZoomableBoardProps) {
  const { gameId } = useParams();
  const { state, dispatch } = useContext(store);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { width, height } = useWindowSize();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [show, setShow] = useState(false);
  const [pendingRobberActions, setPendingRobberActions] = useState<
    MoveRobberAction[]
  >([]);

  const gameState = state.gameState;
  if (!gameState) throw new Error("GameState is not ready!");
  if (!gameId) throw new Error("expecting gameId in URL");

  const buildOnNodeClick = useCallback(
    (_id: number, action?: GameAction) => async () => {
      if (action) {
        const nextState = await postAction(gameId, action);
        dispatch({ type: ACTIONS.SET_GAME_STATE, data: nextState });
        dispatchSnackbar(enqueueSnackbar, closeSnackbar, nextState);
      }
    },
    [gameId, dispatch, enqueueSnackbar, closeSnackbar]
  );

  const buildOnEdgeClick = useCallback(
    (_id: [number, number], action?: GameAction) => async () => {
      if (action) {
        const nextState = await postAction(gameId, action);
        dispatch({ type: ACTIONS.SET_GAME_STATE, data: nextState });
        dispatchSnackbar(enqueueSnackbar, closeSnackbar, nextState);
      }
    },
    [gameId, dispatch, enqueueSnackbar, closeSnackbar]
  );

  const handleTileClick = useCallback(
    (coordinate: TileCoordinate) => {
      if (
        !state.isMovingRobber &&
        gameState.current_prompt !== "MOVE_ROBBER"
      ) {
        return;
      }

      const matchingActions = gameState.current_playable_actions.filter(
        (action): action is MoveRobberAction =>
          action[1] === "MOVE_ROBBER" &&
          action[2][0].every(
            (val: number, index: number) => val === coordinate[index]
          )
      );

      if (matchingActions.length === 1) {
        postAction(gameId, matchingActions[0]).then((nextState) => {
          dispatch({ type: ACTIONS.SET_GAME_STATE, data: nextState });
          dispatchSnackbar(enqueueSnackbar, closeSnackbar, nextState);
        });
      } else if (matchingActions.length > 1) {
        setPendingRobberActions(matchingActions);
      }
    },
    [
      state.isMovingRobber,
      gameState.current_prompt,
      gameState.current_playable_actions,
      gameId,
      dispatch,
      enqueueSnackbar,
      closeSnackbar,
    ]
  );

  const handleChooseRobberVictim = async (action: MoveRobberAction) => {
    setPendingRobberActions([]);
    const nextState = await postAction(gameId, action);
    dispatch({ type: ACTIONS.SET_GAME_STATE, data: nextState });
    dispatchSnackbar(enqueueSnackbar, closeSnackbar, nextState);
  };

  const nodeActions = replayMode ? {} : buildNodeActions(state);
  const edgeActions = replayMode ? {} : buildEdgeActions(state);
  const isRobberPhase =
    state.isMovingRobber ||
    (isPlayersTurn(gameState, state.perspective) &&
      gameState.current_prompt === "MOVE_ROBBER");

  const robberCoordinates = new Set(
    isRobberPhase
      ? gameState.current_playable_actions
          .filter((action) => action[1] === "MOVE_ROBBER")
          .map((action) => `${action[2][0]}`)
      : []
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(true);
    }, 80);
    return () => clearTimeout(timer);
  }, []);

  if (!width || !height) return null;

  return (
    <>
      <TransformWrapper
        initialScale={1}
        minScale={0.55}
        maxScale={2.4}
        centerOnInit={true}
        limitToBounds={false}
        wheel={{ step: 0.08 }}
        panning={{
          excluded: [
            "node--buildable",
            "edge--buildable",
            "pulse",
            "camera-btn",
          ],
        }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <div className="board-container">
            <div className="board-camera-controls">
              <button
                type="button"
                className="camera-btn"
                onClick={() => zoomIn()}
                title="Aproximar (Zoom In)"
                aria-label="Zoom In"
              >
                <ZoomInIcon fontSize="small" />
              </button>
              <button
                type="button"
                className="camera-btn"
                onClick={() => zoomOut()}
                title="Afastar (Zoom Out)"
                aria-label="Zoom Out"
              >
                <ZoomOutIcon fontSize="small" />
              </button>
              <button
                type="button"
                className="camera-btn"
                onClick={() => resetTransform()}
                title="Centralizar Tabuleiro"
                aria-label="Reset View"
              >
                <CenterFocusStrongIcon fontSize="small" />
              </button>
            </div>
            <TransformComponent>
              <Board
                width={width}
                height={height}
                buildOnNodeClick={buildOnNodeClick}
                buildOnEdgeClick={buildOnEdgeClick}
                handleTileClick={handleTileClick}
                nodeActions={nodeActions}
                edgeActions={edgeActions}
                replayMode={replayMode}
                show={show}
                gameState={gameState}
                isMobile={isMobile}
                isMovingRobber={isRobberPhase}
                robberCoordinates={robberCoordinates}
              />
            </TransformComponent>
          </div>
        )}
      </TransformWrapper>

      {/* Steal Victim Selector Modal when multiple players touch the target hex */}
      <Dialog
        open={pendingRobberActions.length > 1}
        onClose={() => setPendingRobberActions([])}
        PaperProps={{
          className: "catan-modal-paper",
        }}
      >
        <DialogTitle className="catan-modal-title">
          Escolha de Quem Roubar 1 Recurso
        </DialogTitle>
        <DialogContent className="catan-modal-content">
          <div className="victim-selector-grid">
            {pendingRobberActions.map((action, idx) => {
              const victimColor = action[2][1] as Color | undefined;
              const meta = victimColor ? PLAYER_COLOR_META[victimColor] : null;
              const pKey = victimColor
                ? playerKey(gameState, victimColor)
                : null;
              const numCards = pKey
                ? gameState.player_state[`${pKey}_NUM_RESOURCES_IN_HAND`] ??
                  (["WOOD", "BRICK", "SHEEP", "WHEAT", "ORE"] as const).reduce(
                    (acc, r) =>
                      acc +
                      (gameState.player_state[`${pKey}_${r}_IN_HAND`] ?? 0),
                    0
                  )
                : 0;

              return (
                <button
                  key={idx}
                  type="button"
                  className="victim-card-btn"
                  style={{
                    borderColor: meta?.primary ?? "#64748B",
                  }}
                  onClick={() => handleChooseRobberVictim(action)}
                >
                  <span
                    className="victim-card-btn__dot"
                    style={{ background: meta?.primary ?? "#64748B" }}
                  />
                  <div className="victim-card-btn__info">
                    <strong>{meta ? meta.label : "Ninguém"}</strong>
                    <span>{numCards} carta(s) na mão</span>
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
