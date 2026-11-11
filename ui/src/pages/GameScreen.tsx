import { useEffect, useState, useContext, useRef } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import PropTypes from "prop-types";
import { GridLoader } from "react-spinners";
import { useSnackbar } from "notistack";
import { Divider } from "@mui/material";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";

import ZoomableBoard from "./ZoomableBoard";
import ActionsToolbar from "./ActionsToolbar";

import "./GameScreen.scss";
import LeftDrawer from "../components/LeftDrawer";
import RightDrawer from "../components/RightDrawer";
import PlayerTopBar from "../components/PlayerTopBar";
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
import type { Color, GameState } from "../utils/api.types";
import { getSavedGameSeat } from "./RoomLobbyPage";
import {
  isSoundMuted,
  setSoundMuted,
  playActionRecordSound,
  playVictorySound,
} from "../utils/soundEffects";

const ROBOT_THINKING_TIME = 300;
const VALID_COLORS = new Set<Color>(["RED", "BLUE", "ORANGE", "WHITE"]);

function describePromptBanner(
  gameState: GameState,
  isBotThinking: boolean
): string {
  if (gameState.winning_color) {
    const winName =
      gameState.seat_names?.[gameState.winning_color] ||
      PLAYER_COLOR_META[gameState.winning_color].label;
    return `🏆 Vitória de ${winName}!`;
  }
  const activeLabel =
    gameState.seat_names?.[gameState.current_color] ||
    PLAYER_COLOR_META[gameState.current_color].label;
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
  const [searchParams] = useSearchParams();
  const { state, dispatch } = useContext(store);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [muted, setMuted] = useState(() => isSoundMuted());
  const prevStateIndexRef = useRef<number | null>(null);
  const prevWinnerRef = useRef<Color | null>(null);

  // Automatically apply seat perspective if ?seat=COLOR is in URL or saved from Room Lobby
  useEffect(() => {
    if (!gameId || replayMode) return;
    const urlSeat = searchParams.get("seat")?.toUpperCase() as Color | undefined;
    const savedSeat = getSavedGameSeat(gameId);
    const chosenSeat =
      urlSeat && VALID_COLORS.has(urlSeat)
        ? urlSeat
        : savedSeat && VALID_COLORS.has(savedSeat)
          ? savedSeat
          : null;

    if (chosenSeat && state.perspective !== chosenSeat) {
      dispatch({ type: ACTIONS.SET_PERSPECTIVE, data: chosenSeat });
    }
  }, [gameId, replayMode, searchParams, state.perspective, dispatch]);

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

  // Real-time multiplayer polling when waiting for another human friend's turn
  useEffect(() => {
    if (!gameId || replayMode || !state.gameState || state.gameState.winning_color) {
      return;
    }
    const isBotTurn = state.gameState.bot_colors.includes(
      state.gameState.current_color
    );
    const isAnotherHumanTurn =
      !isBotTurn &&
      state.perspective !== null &&
      state.gameState.current_color !== state.perspective;

    if (!isAnotherHumanTurn) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const latest = await getState(gameId, "latest");
        if (latest.state_index !== state.gameState?.state_index) {
          dispatch({ type: ACTIONS.SET_GAME_STATE, data: latest });
        }
      } catch {
        // ignore transient network errors
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [gameId, replayMode, state.gameState, state.perspective, dispatch]);

  // Play tactile tabletop audio cues on state transitions
  useEffect(() => {
    const gs = state.gameState;
    if (!gs || replayMode) return;

    if (prevStateIndexRef.current === null) {
      prevStateIndexRef.current = gs.state_index;
      prevWinnerRef.current = gs.winning_color;
      return;
    }

    if (gs.state_index > prevStateIndexRef.current) {
      const latestRecord = gs.action_records?.[gs.action_records.length - 1];
      playActionRecordSound(latestRecord);
      if (gs.winning_color && !prevWinnerRef.current) {
        playVictorySound();
      }
    }
    prevStateIndexRef.current = gs.state_index;
    prevWinnerRef.current = gs.winning_color;
  }, [state.gameState, replayMode]);

  const toggleSoundMute = () => {
    const next = !muted;
    setMuted(next);
    setSoundMuted(next);
  };

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
        let gameState;
        try {
          gameState = await postAction(gameId);
        } catch {
          // Never leave the UI stuck on "IA pensando"
          setIsBotThinking(false);
          return;
        }
        const requestTime = new Date().valueOf() - start.valueOf();
        setTimeout(() => {
          setIsBotThinking(false);
          dispatch({ type: ACTIONS.SET_GAME_STATE, data: gameState });
          if (getHumanColor(gameState, state.perspective)) {
            dispatchSnackbar(enqueueSnackbar, closeSnackbar, gameState);
          }
        }, Math.max(0, ROBOT_THINKING_TIME - requestTime));
      })();
    }
  }, [
    gameId,
    replayMode,
    state.gameState,
    state.perspective,
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
          <h1 className="logo">Rule the Isle</h1>
          {state.gameState.room_code && (
            <Link
              to={`/rooms/${state.gameState.room_code}`}
              className="game-top-hud__room-badge"
              title="Ver Sala e Link de Convite"
            >
              🔗 Sala #{state.gameState.room_code}
            </Link>
          )}
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
          <button
            type="button"
            className="game-top-hud__mcts-btn"
            onClick={() =>
              dispatch({
                type: ACTIONS.SET_LEFT_DRAWER_OPENED,
                data: !state.isLeftDrawerOpen,
              })
            }
            title="Abrir Histórico de Jogadas"
          >
            📜 Histórico
          </button>
          <button
            type="button"
            className="game-top-hud__mcts-btn"
            onClick={() =>
              dispatch({
                type: ACTIONS.SET_RIGHT_DRAWER_OPENED,
                data: !state.isRightDrawerOpen,
              })
            }
            title="Abrir Análise de Probabilidade de Vitória (IA MCTS)"
          >
            📊 Chances (IA)
          </button>
          <button
            type="button"
            className="game-top-hud__sound-btn"
            onClick={toggleSoundMute}
            title={muted ? "Ativar efeitos sonoros" : "Silenciar efeitos sonoros"}
            aria-label={muted ? "Ativar som" : "Silenciar som"}
          >
            {muted ? <VolumeOffIcon fontSize="small" /> : <VolumeUpIcon fontSize="small" />}
          </button>
        </div>
      </header>

      <PlayerTopBar gameState={state.gameState} />

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
