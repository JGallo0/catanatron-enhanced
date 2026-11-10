import { useEffect, useState, useContext } from "react";
import { useParams, Link } from "react-router-dom";
import PropTypes from "prop-types";
import { GridLoader } from "react-spinners";
import { useSnackbar } from "notistack";
import { Divider } from "@mui/material";

import ZoomableBoard from "./ZoomableBoard";
import ActionsToolbar from "./ActionsToolbar";

import "./GameScreen.scss";
import LeftDrawer from "../components/LeftDrawer";
import RightDrawer from "../components/RightDrawer";
import { store } from "../store";
import ACTIONS from "../actions";
import {
  type StateIndex,
  getState,
  postAction,
  setPerspective,
} from "../utils/apiClient";
import { dispatchSnackbar } from "../components/Snackbar";
import { getHumanColor } from "../utils/stateUtils";
import AnalysisBox from "../components/AnalysisBox";
import { PLAYER_COLOR_META } from "../config/assetRegistry";
import type { GameState } from "../utils/api.types";

const ROBOT_THINKING_TIME = 300;

function describePromptBanner(
  gameState: GameState,
  isBotThinking: boolean
): string {
  if (gameState.winning_color) {
    return `🏆 Vitória de ${PLAYER_COLOR_META[gameState.winning_color].label}!`;
  }
  const activeLabel = PLAYER_COLOR_META[gameState.current_color].label;
  if (isBotThinking) {
    return `🤖 IA (${activeLabel}) está calculando a melhor jogada...`;
  }
  switch (gameState.current_prompt) {
    case "BUILD_INITIAL_SETTLEMENT":
      return `Fase Inicial — ${activeLabel}: Escolha um vértice para fundar sua Aldeia`;
    case "BUILD_INITIAL_ROAD":
      return `Fase Inicial — ${activeLabel}: Construa uma Estrada conectada`;
    case "MOVE_ROBBER":
      return `🥷 Ladrão Ativo — ${activeLabel}: Clique em um hexágono iluminado para mover o Ladrão`;
    case "DISCARD":
      return `⚠️ Sete nos Dados — ${activeLabel}: Descarte ${gameState.current_discard_count} carta(s)`;
    case "PLAY_TURN":
      return `Vez de ${activeLabel} — Role os dados, negocie ou construa`;
    default:
      return `Vez de ${activeLabel}`;
  }
}

function GameScreen({ replayMode }: { replayMode: boolean }) {
  const { gameId, stateIndex } = useParams();
  const { state, dispatch } = useContext(store);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const [isBotThinking, setIsBotThinking] = useState(false);

  // Load game state
  useEffect(() => {
    if (!gameId) {
      return;
    }

    setPerspective(state.perspective);
    (async () => {
      const gameState = await getState(gameId, stateIndex as StateIndex);
      dispatch({ type: ACTIONS.SET_GAME_STATE, data: gameState });
    })();
  }, [gameId, stateIndex, state.perspective, dispatch]);

  // Advance bot turns automatically
  useEffect(() => {
    if (!state.gameState || replayMode || !gameId) {
      return;
    }
    if (
      state.gameState.bot_colors.includes(state.gameState.current_color) &&
      !state.gameState.winning_color
    ) {
      (async () => {
        setIsBotThinking(true);
        const start = new Date();
        const gameState = await postAction(gameId);
        const requestTime = new Date().valueOf() - start.valueOf();
        setTimeout(() => {
          setIsBotThinking(false);
          dispatch({ type: ACTIONS.SET_GAME_STATE, data: gameState });
          if (getHumanColor(gameState)) {
            dispatchSnackbar(enqueueSnackbar, closeSnackbar, gameState);
          }
        }, ROBOT_THINKING_TIME - requestTime);
      })();
    }
  }, [
    gameId,
    replayMode,
    state.gameState,
    dispatch,
    enqueueSnackbar,
    closeSnackbar,
  ]);

  if (!state.gameState) {
    return (
      <main>
        <GridLoader className="loader" color="#FACC15" size={80} />
      </main>
    );
  }

  const currentPalette = PLAYER_COLOR_META[state.gameState.current_color];
  const devCardsRemaining = state.gameState.development_listdeck
    ? Object.values(state.gameState.development_listdeck).reduce(
        (a, b) => a + b,
        0
      )
    : 0;

  return (
    <main className="catan-game-screen">
      {/* Top Floating HUD Bar (Steam Catan style) */}
      <header className="game-top-hud">
        <div className="game-top-hud__left">
          <Link to="/" className="game-top-hud__home-btn" title="Voltar ao Lobby">
            ← Lobby
          </Link>
          <h1 className="logo">Catanatron</h1>
        </div>

        <div
          className="game-top-hud__banner"
          style={{
            borderColor: currentPalette.primary,
          }}
        >
          <span
            className="game-top-hud__turn-dot"
            style={{
              background: currentPalette.primary,
              boxShadow: `0 0 10px ${currentPalette.glow}`,
            }}
          />
          <span>{describePromptBanner(state.gameState, isBotThinking)}</span>
        </div>

        <div className="game-top-hud__right">
          <span
            className="game-top-hud__bank-chip"
            title="Cartas de Desenvolvimento restantes no baralho do banco"
          >
            🃏 Baralho Dev: <strong>{devCardsRemaining}</strong>
          </span>
        </div>
      </header>

      <ZoomableBoard replayMode={replayMode} />
      <ActionsToolbar isBotThinking={isBotThinking} replayMode={replayMode} />
      <LeftDrawer />
      <RightDrawer>
        <AnalysisBox stateIndex={"latest"} />
        <Divider />
      </RightDrawer>
    </main>
  );
}

GameScreen.propTypes = {
  window: PropTypes.func,
};

export default GameScreen;
