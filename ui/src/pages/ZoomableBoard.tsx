import { useCallback, useContext, useEffect, useRef, useState } from "react";
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
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import cn from "classnames";
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
import { getPlayerColorMeta } from "../config/assetRegistry";
import { resolvePlayerDisplayName } from "../config/botCatalog";
import { dispatchSnackbar } from "../components/Snackbar";
import { useLanguage } from "../i18n";

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
  recentNodeId?: number | null;
  recentEdgeId?: string | null;
};

export const CONFIRM_PLACEMENT_STORAGE_KEY = "catan_confirm_placement_v1";

type PendingPlacement =
  | {
      kind: "node";
      nodeId: number;
      action: GameAction;
      buildType: "CITY" | "SETTLEMENT";
    }
  | {
      kind: "edge";
      edgeId: string;
      action: GameAction;
      buildType: "ROAD";
    };

function loadSavedConfirmPlacement(): boolean {
  try {
    const saved = localStorage.getItem(CONFIRM_PLACEMENT_STORAGE_KEY);
    return saved === null ? true : saved === "1";
  } catch {
    return true;
  }
}

export default function ZoomableBoard({
  replayMode,
  recentNodeId = null,
  recentEdgeId = null,
}: ZoomableBoardProps) {
  const { gameId } = useParams();
  const { state, dispatch } = useContext(store);
  const { language, t } = useLanguage();
  const colorMeta = getPlayerColorMeta(language);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { width, height } = useWindowSize();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [show, setShow] = useState(false);
  const [pendingRobberActions, setPendingRobberActions] = useState<
    MoveRobberAction[]
  >([]);
  const [confirmPlacement, setConfirmPlacement] = useState<boolean>(() =>
    loadSavedConfirmPlacement()
  );
  const [pendingPlacement, setPendingPlacement] =
    useState<PendingPlacement | null>(null);
  const boardContainerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const gameState = state.gameState;
  if (!gameState) throw new Error("GameState is not ready!");
  if (!gameId) throw new Error("expecting gameId in URL");

  useEffect(() => {
    const el = boardContainerRef.current;
    if (!el) return;

    const updateSize = () => {
      const nextWidth = Math.round(el.clientWidth);
      const nextHeight = Math.round(el.clientHeight);
      if (nextWidth > 0 && nextHeight > 0) {
        setContainerSize((prev) =>
          prev && prev.width === nextWidth && prev.height === nextHeight
            ? prev
            : { width: nextWidth, height: nextHeight }
        );
      }
    };

    updateSize();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateSize);
      observer.observe(el);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [width, height]);

  useEffect(() => {
    setPendingPlacement(null);
  }, [gameState.state_index, gameState.current_prompt, replayMode, confirmPlacement]);

  const executePlacementAction = useCallback(
    async (action: GameAction) => {
      setPendingPlacement(null);
      const nextState = await postAction(gameId, action);
      dispatch({ type: ACTIONS.SET_GAME_STATE, data: nextState });
      dispatchSnackbar(enqueueSnackbar, closeSnackbar, nextState);
    },
    [gameId, dispatch, enqueueSnackbar, closeSnackbar]
  );

  const handleToggleConfirmPlacement = () => {
    setConfirmPlacement((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(CONFIRM_PLACEMENT_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore storage errors
      }
      if (!next) {
        setPendingPlacement(null);
      }
      return next;
    });
  };

  const buildOnNodeClick = useCallback(
    (id: number, action?: GameAction) => async () => {
      if (!action) return;
      if (!confirmPlacement) {
        await executePlacementAction(action);
        return;
      }
      if (pendingPlacement?.kind === "node" && pendingPlacement.nodeId === id) {
        await executePlacementAction(action);
        return;
      }
      setPendingPlacement({
        kind: "node",
        nodeId: id,
        action,
        buildType: action[1] === "BUILD_CITY" ? "CITY" : "SETTLEMENT",
      });
    },
    [confirmPlacement, pendingPlacement, executePlacementAction]
  );

  const buildOnEdgeClick = useCallback(
    (id: [number, number], action?: GameAction) => async () => {
      if (!action) return;
      if (!confirmPlacement) {
        await executePlacementAction(action);
        return;
      }
      const normId = `${Math.min(id[0], id[1])},${Math.max(id[0], id[1])}`;
      if (pendingPlacement?.kind === "edge" && pendingPlacement.edgeId === normId) {
        await executePlacementAction(action);
        return;
      }
      setPendingPlacement({
        kind: "edge",
        edgeId: normId,
        action,
        buildType: "ROAD",
      });
    },
    [confirmPlacement, pendingPlacement, executePlacementAction]
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
        minScale={0.65}
        maxScale={2.5}
        centerOnInit={true}
        limitToBounds={true}
        smooth={true}
        wheel={{ step: 0.05, smoothStep: 0.002 }}
        pinch={{ step: 5 }}
        doubleClick={{ disabled: true }}
        panning={{
          velocityDisabled: false,
          excluded: [
            "node--buildable",
            "edge--buildable",
            "pulse",
            "camera-btn",
            "board-confirm-toggle",
            "placement-confirm-bar",
            "placement-confirm-btn",
            "cu-placement-confirm-dock",
            "cu-confirm-btn",
            "cu-cancel-btn",
          ],
        }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <div className="board-container" ref={boardContainerRef}>
            <div className="board-camera-controls">
              <button
                type="button"
                className="camera-btn"
                onClick={() => zoomIn(0.25, 220, "easeOutCubic")}
                title={t("Aproximar (Zoom +)", "Zoom +")}
                aria-label={t("Zoom +", "Zoom +")}
              >
                <ZoomInIcon fontSize="small" />
              </button>
              <button
                type="button"
                className="camera-btn"
                onClick={() => zoomOut(0.25, 220, "easeOutCubic")}
                title={t("Afastar (Zoom -)", "Zoom -")}
                aria-label={t("Zoom -", "Zoom -")}
              >
                <ZoomOutIcon fontSize="small" />
              </button>
              <button
                type="button"
                className="camera-btn"
                onClick={() => resetTransform(250, "easeOutCubic")}
                title={t("Centralizar tabuleiro", "Center board")}
                aria-label={t("Centralizar tabuleiro", "Center board")}
              >
                <CenterFocusStrongIcon fontSize="small" />
              </button>
              {!replayMode && (
                <button
                  type="button"
                  className={cn("camera-btn board-confirm-toggle", {
                    "is-active": confirmPlacement,
                  })}
                  onClick={handleToggleConfirmPlacement}
                  title={
                    confirmPlacement
                      ? t(
                          "Confirmação em 2 cliques: Ativa (clique para voltar a 1 clique)",
                          "2-click build confirm: On (click to switch to 1-click)"
                        )
                      : t(
                          "Ativar confirmação antes de construir (2 cliques)",
                          "Enable 2-click build confirmation"
                        )
                  }
                  aria-label={t(
                    "Confirmar jogada em 2 cliques",
                    "2-click build confirm"
                  )}
                  aria-pressed={confirmPlacement}
                >
                  <CheckIcon fontSize="small" />
                </button>
              )}
            </div>
            <TransformComponent>
              <Board
                width={width}
                height={height}
                containerWidth={containerSize?.width}
                containerHeight={containerSize?.height}
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
                recentNodeId={recentNodeId}
                recentEdgeId={recentEdgeId}
                pendingNodeId={
                  pendingPlacement?.kind === "node"
                    ? pendingPlacement.nodeId
                    : null
                }
                pendingEdgeId={
                  pendingPlacement?.kind === "edge"
                    ? pendingPlacement.edgeId
                    : null
                }
                pendingColor={
                  pendingPlacement ? (gameState.current_player as Color) : null
                }
                pendingBuilding={
                  pendingPlacement?.kind === "node"
                    ? pendingPlacement.buildType
                    : null
                }
              />
            </TransformComponent>

            {pendingPlacement && !replayMode && (
              <>
                <div
                  className="placement-confirm-bar"
                  role="region"
                  aria-label={t(
                    "Confirmar posicionamento no tabuleiro",
                    "Confirm board placement"
                  )}
                >
                  <span className="placement-confirm-bar__label">
                    {pendingPlacement.buildType === "CITY"
                      ? t(
                          "Confirmar melhoria para Cidade?",
                          "Confirm City upgrade?"
                        )
                      : pendingPlacement.buildType === "SETTLEMENT"
                        ? t(
                            "Confirmar construção de Aldeia?",
                            "Confirm Settlement build?"
                          )
                        : t(
                            "Confirmar construção de Estrada?",
                            "Confirm Road build?"
                          )}
                  </span>
                  <div className="placement-confirm-bar__actions">
                    <button
                      type="button"
                      className="placement-confirm-btn placement-confirm-btn--confirm"
                      onClick={() => executePlacementAction(pendingPlacement.action)}
                    >
                      ✓ {t("Confirmar", "Confirm")}
                    </button>
                    <button
                      type="button"
                      className="placement-confirm-btn placement-confirm-btn--cancel"
                      onClick={() => setPendingPlacement(null)}
                    >
                      ✕ {t("Cancelar", "Cancel")}
                    </button>
                  </div>
                </div>

                {/* Catan Universe Prominent Confirmation Dock (Right Margin) */}
                <div
                  className="cu-placement-confirm-dock"
                  role="dialog"
                  aria-label={t("Confirmar jogada", "Confirm move")}
                >
                  <button
                    type="button"
                    className="cu-confirm-btn"
                    onClick={() => executePlacementAction(pendingPlacement.action)}
                    title={t("Confirmar Construção [✔]", "Confirm Build [✔]")}
                    aria-label={t("Confirmar Construção", "Confirm Build")}
                  >
                    <CheckIcon fontSize="large" className="cu-confirm-btn__icon" />
                  </button>
                  <button
                    type="button"
                    className="cu-cancel-btn"
                    onClick={() => setPendingPlacement(null)}
                    title={t("Cancelar jogada", "Cancel move")}
                    aria-label={t("Cancelar jogada", "Cancel move")}
                  >
                    <CloseIcon fontSize="small" />
                  </button>
                </div>
              </>
            )}
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
          {t(
            "Escolha de Quem Roubar 1 Recurso",
            "Choose Who to Steal 1 Resource From"
          )}
        </DialogTitle>
        <DialogContent className="catan-modal-content">
          <div className="victim-selector-grid">
            {pendingRobberActions.map((action, idx) => {
              const rawVictim = action[2][1];
              const victimColor = rawVictim ? (rawVictim as Color) : undefined;
              const meta = victimColor ? colorMeta[victimColor] : null;
              const victimName = victimColor
                ? resolvePlayerDisplayName(
                    gameState,
                    victimColor,
                    meta?.label ?? victimColor
                  )
                : t("Ninguém", "Nobody");
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
                    <strong>{victimName}</strong>
                    <span>
                      {numCards}{" "}
                      {t(
                        "carta(s) na mão",
                        numCards === 1 ? "card in hand" : "cards in hand"
                      )}
                    </span>
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
