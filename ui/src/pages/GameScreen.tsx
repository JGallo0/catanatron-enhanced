import { useEffect, useState, useContext, useRef, useMemo } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import PropTypes from "prop-types";
import { GridLoader } from "react-spinners";
import { useSnackbar } from "notistack";
import cn from "classnames";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
} from "@mui/material";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";

import ZoomableBoard from "./ZoomableBoard";
import ActionsToolbar from "./ActionsToolbar";

import "./GameScreen.scss";
import LeftDrawer from "../components/LeftDrawer";
import RightDrawer from "../components/RightDrawer";
import PlayerTopBar from "../components/PlayerTopBar";
import DiceRollOverlay from "../components/DiceRollOverlay";
import { store } from "../store";
import ACTIONS from "../actions";
import {
  type StateIndex,
  abandonGame,
  getSavedAccount,
  getState,
  postAction,
  reclaimGame,
  sendGameHeartbeat,
  setPerspective,
} from "../utils/apiClient";
import { dispatchSnackbar } from "../components/Snackbar";
import { getHumanColor } from "../utils/stateUtils";
import AnalysisBox from "../components/AnalysisBox";
import { PLAYER_COLOR_META } from "../config/assetRegistry";
import { getSavedAccountAvatarSummary } from "../config/avatarCatalog";
import { resolvePlayerDisplayName } from "../config/botCatalog";
import type { Color, GameState } from "../utils/api.types";
import { getSavedGameSeat } from "./RoomLobbyPage";
import {
  isSoundMuted,
  setSoundMuted,
  playActionRecordSound,
  playVictorySound,
} from "../utils/soundEffects";
import { humanizeActionRecordPt } from "../utils/promptUtils";
import {
  type GameSpeed,
  electBotCoordinator,
  extractTransitionVisuals,
  getActionDelayMs,
  getRollSpinDurationMs,
  getSavedGameSpeed,
  saveGameSpeed,
} from "../utils/tabletopPacing";

const VALID_COLORS = new Set<Color>(["RED", "BLUE", "ORANGE", "WHITE"]);

function describePromptBanner(
  gameState: GameState,
  isBotThinking: boolean
): string {
  if (gameState.winning_color) {
    const winName = resolvePlayerDisplayName(
      gameState,
      gameState.winning_color,
      PLAYER_COLOR_META[gameState.winning_color].label
    );
    return `🏆 Vitória de ${winName}!`;
  }
  const activeLabel = resolvePlayerDisplayName(
    gameState,
    gameState.current_color,
    PLAYER_COLOR_META[gameState.current_color].label
  );
  if (isBotThinking) {
    return `🧭 ${activeLabel} está calculando a melhor jogada...`;
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
    case "DECIDE_TRADE":
      return `🤝 Negociação — ${activeLabel}: Avalie a proposta de troca`;
    case "DECIDE_ACCEPTEES":
      return `⚖️ Negociação — ${activeLabel}: Escolha com quem fechar a troca`;
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
  const [gameSpeed, setGameSpeed] = useState<GameSpeed>(() =>
    getSavedGameSpeed()
  );
  const gameSpeedRef = useRef<GameSpeed>(gameSpeed);
  gameSpeedRef.current = gameSpeed;

  const [abandonConfirmOpen, setAbandonConfirmOpen] = useState(false);
  const [isAbandoning, setIsAbandoning] = useState(false);
  const [isReclaiming, setIsReclaiming] = useState(false);
  const hasAbandonedRef = useRef(false);

  const [spotlightToast, setSpotlightToast] = useState<{
    text: string;
    color: Color;
    icon: string;
  } | null>(null);
  const [diceStage, setDiceStage] = useState<{
    open: boolean;
    rolling: boolean;
    dice: [number, number] | null;
    rollerName: string;
    rollerColor: Color;
  } | null>(null);
  const [recentNodeId, setRecentNodeId] = useState<number | null>(null);
  const [recentEdgeId, setRecentEdgeId] = useState<string | null>(null);
  const [recentDevColor, setRecentDevColor] = useState<Color | null>(null);

  const prevStateIndexRef = useRef<number | null>(null);
  const prevWinnerRef = useRef<Color | null>(null);
  const latestStateIndexRef = useRef<number | null>(null);
  const nextBotReadyAtRef = useRef<number>(0);
  const botGenerationRef = useRef<number>(0);

  const diceSpinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const diceHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const gs = state.gameState;
  latestStateIndexRef.current = gs?.state_index ?? null;

  const mySeatColor: Color | null = useMemo(() => {
    if (!gs) return null;
    const urlSeat = searchParams.get("seat")?.toUpperCase() as Color | undefined;
    if (urlSeat && VALID_COLORS.has(urlSeat) && gs.colors.includes(urlSeat)) {
      return urlSeat;
    }
    const savedSeat = gameId ? getSavedGameSeat(gameId) : null;
    if (savedSeat && VALID_COLORS.has(savedSeat) && gs.colors.includes(savedSeat)) {
      return savedSeat;
    }
    if (state.perspective && gs.colors.includes(state.perspective)) {
      return state.perspective;
    }
    const acctUsername =
      getSavedAccount?.()?.username ??
      getSavedAccountAvatarSummary()?.username;
    if (acctUsername) {
      const matched = gs.colors.find(
        (c) =>
          gs.seat_avatars?.[c]?.username === acctUsername ||
          gs.seat_takeover?.[c]?.original_username === acctUsername
      );
      if (matched) return matched;
    }
    const activeHumans = gs.colors.filter((c) => !gs.bot_colors.includes(c));
    const takeoverColors = Object.keys(gs.seat_takeover || {}) as Color[];
    const origHumanCount = new Set([...activeHumans, ...takeoverColors]).size;
    if (!gs.room_code && origHumanCount < 2 && activeHumans.length === 1) {
      return activeHumans[0];
    }
    return null;
  }, [gs, gameId, searchParams, state.perspective]);

  const originalHumansCount = useMemo(() => {
    if (!gs) return 0;
    const activeHumans = gs.colors.filter((c) => !gs.bot_colors.includes(c));
    const takeoverKeys = Object.keys(gs.seat_takeover || {}) as Color[];
    return new Set([...activeHumans, ...takeoverKeys]).size;
  }, [gs]);

  const isMultiplayerGame = Boolean(gs?.room_code) || originalHumansCount >= 2;
  const isMySeatTakenOver = Boolean(
    mySeatColor &&
      (gs?.seat_takeover?.[mySeatColor]?.taken_over ||
        gs?.taken_over_colors?.includes(mySeatColor))
  );

  // Reset game-scoped refs when switching gameId
  useEffect(() => {
    prevStateIndexRef.current = null;
    prevWinnerRef.current = null;
    latestStateIndexRef.current = null;
    nextBotReadyAtRef.current = 0;
    hasAbandonedRef.current = false;
  }, [gameId]);

  // Clean up visual presentation timers on unmount
  useEffect(() => {
    return () => {
      if (diceSpinTimerRef.current) clearTimeout(diceSpinTimerRef.current);
      if (diceHideTimerRef.current) clearTimeout(diceHideTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

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
    } else if (!chosenSeat && !state.perspective && gs) {
      const acctUsername =
        getSavedAccount?.()?.username ??
        getSavedAccountAvatarSummary()?.username;
      if (acctUsername) {
        const matched = gs.colors.find(
          (c) =>
            gs.seat_avatars?.[c]?.username === acctUsername ||
            gs.seat_takeover?.[c]?.original_username === acctUsername
        );
        if (matched) {
          dispatch({ type: ACTIONS.SET_PERSPECTIVE, data: matched });
        }
      }
    }
  }, [gameId, replayMode, searchParams, state.perspective, gs, dispatch]);

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

  // Real-time multiplayer polling (700ms) when waiting on peer human, peer bot coordinator, or while taken over
  useEffect(() => {
    if (
      !gameId ||
      replayMode ||
      !gs ||
      gs.winning_color ||
      !isMultiplayerGame
    ) {
      return;
    }
    const isBotTurn = gs.bot_colors.includes(gs.current_color);
    const isAnotherHumanTurn =
      !isBotTurn &&
      (mySeatColor === null || gs.current_color !== mySeatColor);
    const isBotCoordinator = electBotCoordinator(gs, mySeatColor);
    const shouldPoll =
      (isBotTurn && !isBotCoordinator) ||
      isAnotherHumanTurn ||
      isMySeatTakenOver;

    if (!shouldPoll) {
      return;
    }

    const currBots = (gs.bot_colors || []).join(",");
    const currTaken = (gs.taken_over_colors || []).join(",");

    const interval = setInterval(async () => {
      try {
        const latest = await getState(gameId, "latest");
        const latestBots = (latest.bot_colors || []).join(",");
        const latestTaken = (latest.taken_over_colors || []).join(",");
        if (
          latest.state_index !== gs.state_index ||
          latestBots !== currBots ||
          latestTaken !== currTaken
        ) {
          dispatch({ type: ACTIONS.SET_GAME_STATE, data: latest });
          if (
            latest.state_index > gs.state_index &&
            getHumanColor(latest, state.perspective)
          ) {
            dispatchSnackbar(enqueueSnackbar, closeSnackbar, latest);
          }
        }
      } catch {
        // ignore transient network errors
      }
    }, 700);

    return () => clearInterval(interval);
  }, [
    gameId,
    replayMode,
    gs,
    isMultiplayerGame,
    mySeatColor,
    isMySeatTakenOver,
    state.perspective,
    dispatch,
    enqueueSnackbar,
    closeSnackbar,
  ]);

  // 10s multiplayer heartbeat to prevent false inactivity takeover and sync promoted bots promptly
  const hasGameState = Boolean(gs);
  const hasWinningColor = Boolean(gs?.winning_color);
  const botColorsKeyRef = useRef("");
  const takenOverKeyRef = useRef("");
  const isMySeatTakenOverRef = useRef(false);
  botColorsKeyRef.current = (gs?.bot_colors || []).join(",");
  takenOverKeyRef.current = (gs?.taken_over_colors || []).join(",");
  isMySeatTakenOverRef.current = isMySeatTakenOver;

  useEffect(() => {
    if (
      !gameId ||
      replayMode ||
      !hasGameState ||
      hasWinningColor ||
      !isMultiplayerGame ||
      !mySeatColor ||
      isMySeatTakenOver ||
      hasAbandonedRef.current
    ) {
      return;
    }

    const interval = setInterval(async () => {
      if (hasAbandonedRef.current) return;
      try {
        const res = await sendGameHeartbeat(gameId, mySeatColor);
        if (!res?.ok) return;
        const nextBotsKey = (res.bot_colors || []).join(",");
        const nextTakenKey = (res.taken_over_colors || []).join(",");
        if (
          nextBotsKey !== botColorsKeyRef.current ||
          nextTakenKey !== takenOverKeyRef.current ||
          res.my_seat_taken_over !== isMySeatTakenOverRef.current
        ) {
          const latest = await getState(gameId, "latest");
          dispatch({ type: ACTIONS.SET_GAME_STATE, data: latest });
        }
      } catch {
        // ignore transient network errors
      }
    }, 10_000);

    return () => clearInterval(interval);
  }, [
    gameId,
    replayMode,
    hasGameState,
    hasWinningColor,
    isMultiplayerGame,
    mySeatColor,
    isMySeatTakenOver,
    dispatch,
  ]);

  // Play tabletop audio cues, opening announcement, 2D6 dice stage, recent board highlights, and spotlight toast
  useEffect(() => {
    if (!gs) return;

    if (prevStateIndexRef.current === null) {
      prevStateIndexRef.current = gs.state_index;
      prevWinnerRef.current = gs.winning_color;

      if (!replayMode && gs.state_index === 0) {
        const activeHumans = gs.colors.filter((c) => !gs.bot_colors.includes(c));
        const starterIsLocal =
          !gs.bot_colors.includes(gs.current_color) &&
          (mySeatColor !== null
            ? gs.current_color === mySeatColor
            : activeHumans.length === 1);
        const starterName = resolvePlayerDisplayName(
          gs,
          gs.current_color,
          PLAYER_COLOR_META[gs.current_color]?.label || gs.current_color
        );
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setSpotlightToast({
          text: starterIsLocal
            ? "Ordem sorteada: Você inicia a partida!"
            : `Ordem sorteada: ${starterName} inicia a partida!`,
          color: gs.current_color,
          icon: "🎲",
        });
        toastTimerRef.current = setTimeout(() => {
          setSpotlightToast(null);
        }, 3000);
      }
      return;
    }

    if (gs.state_index > prevStateIndexRef.current && !replayMode) {
      const latestRecord = gs.action_records?.[gs.action_records.length - 1];
      playActionRecordSound(latestRecord);
      if (gs.winning_color && !prevWinnerRef.current) {
        playVictorySound();
      }

      if (latestRecord && latestRecord[0]) {
        const visuals = extractTransitionVisuals(latestRecord);
        const actorColor = latestRecord[0][0];
        const actorName = resolvePlayerDisplayName(
          gs,
          actorColor,
          PLAYER_COLOR_META[actorColor]?.label || actorColor
        );

        if (visuals.rollDice) {
          if (diceSpinTimerRef.current) clearTimeout(diceSpinTimerRef.current);
          if (diceHideTimerRef.current) clearTimeout(diceHideTimerRef.current);

          setDiceStage({
            open: true,
            rolling: true,
            dice: visuals.rollDice,
            rollerName: actorName,
            rollerColor: visuals.rollColor ?? actorColor,
          });

          const spinMs = getRollSpinDurationMs(gameSpeedRef.current);
          const totalMs = getActionDelayMs(latestRecord, gameSpeedRef.current);

          diceSpinTimerRef.current = setTimeout(() => {
            setDiceStage((prev) =>
              prev ? { ...prev, rolling: false } : null
            );
          }, spinMs);

          diceHideTimerRef.current = setTimeout(() => {
            setDiceStage(null);
          }, totalMs);
        }

        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setSpotlightToast({
          text: humanizeActionRecordPt(gs, latestRecord),
          color: actorColor,
          icon: visuals.actionIcon,
        });
        toastTimerRef.current = setTimeout(() => {
          setSpotlightToast(null);
        }, 2200);

        if (
          visuals.recentNodeId !== null ||
          visuals.recentEdgeId !== null ||
          visuals.boughtDevColor !== null
        ) {
          if (highlightTimerRef.current) {
            clearTimeout(highlightTimerRef.current);
          }
          setRecentNodeId(visuals.recentNodeId);
          setRecentEdgeId(visuals.recentEdgeId);
          setRecentDevColor(visuals.boughtDevColor);
          highlightTimerRef.current = setTimeout(() => {
            setRecentNodeId(null);
            setRecentEdgeId(null);
            setRecentDevColor(null);
          }, 2200);
        }
      }
    }

    prevStateIndexRef.current = gs.state_index;
    prevWinnerRef.current = gs.winning_color;
  }, [gs, replayMode, mySeatColor]);

  const toggleSoundMute = () => {
    const next = !muted;
    setMuted(next);
    setSoundMuted(next);
  };

  const toggleGameSpeed = () => {
    const next: GameSpeed = gameSpeed === "normal" ? "fast" : "normal";
    setGameSpeed(next);
    saveGameSpeed(next);
  };

  const handleConfirmAbandon = async () => {
    if (!gameId || !mySeatColor || isAbandoning) return;
    setIsAbandoning(true);
    hasAbandonedRef.current = true;
    try {
      const nextState = await abandonGame(gameId, mySeatColor);
      setAbandonConfirmOpen(false);
      dispatch({ type: ACTIONS.SET_GAME_STATE, data: nextState });
    } catch {
      hasAbandonedRef.current = false;
    } finally {
      setIsAbandoning(false);
    }
  };

  const handleReclaimSeat = async () => {
    if (!gameId || !mySeatColor || isReclaiming) return;
    setIsReclaiming(true);
    try {
      const nextState = await reclaimGame(gameId, mySeatColor);
      hasAbandonedRef.current = false;
      dispatch({ type: ACTIONS.SET_GAME_STATE, data: nextState });
    } catch {
      // ignore transient network errors
    } finally {
      setIsReclaiming(false);
    }
  };

  // Coordinated ?bot_only=1 pacing loop
  useEffect(() => {
    if (!gs || replayMode || !gameId || gs.winning_color) {
      return;
    }
    if (!gs.bot_colors.includes(gs.current_color)) {
      return;
    }
    if (!electBotCoordinator(gs, mySeatColor)) {
      return;
    }

    let cancelled = false;
    const gen = ++botGenerationRef.current;

    const runBotStep = async () => {
      if (cancelled || botGenerationRef.current !== gen) return;
      setIsBotThinking(true);
      let nextState: GameState;
      try {
        nextState = await postAction(gameId, undefined, { botOnly: true });
      } catch {
        if (!cancelled && botGenerationRef.current === gen) {
          setIsBotThinking(false);
        }
        return;
      }
      if (cancelled || botGenerationRef.current !== gen) {
        return;
      }
      if (
        latestStateIndexRef.current !== null &&
        nextState.state_index < latestStateIndexRef.current
      ) {
        setIsBotThinking(false);
        return;
      }

      const returnedLastRecord =
        nextState.action_records?.[nextState.action_records.length - 1];
      const requiresLocalHumanPrompt =
        !nextState.bot_colors.includes(nextState.current_color) &&
        (mySeatColor === null || nextState.current_color === mySeatColor);
      const holdMs = getActionDelayMs(
        returnedLastRecord,
        gameSpeedRef.current,
        { requiresLocalHumanPrompt }
      );
      nextBotReadyAtRef.current = Date.now() + holdMs;

      setIsBotThinking(false);
      dispatch({ type: ACTIONS.SET_GAME_STATE, data: nextState });
      if (getHumanColor(nextState, state.perspective)) {
        dispatchSnackbar(enqueueSnackbar, closeSnackbar, nextState);
      }
    };

    const remainingHold = Math.max(0, nextBotReadyAtRef.current - Date.now());
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (remainingHold === 0) {
      runBotStep();
    } else {
      timer = setTimeout(runBotStep, remainingHold);
    }

    return () => {
      cancelled = true;
      botGenerationRef.current += 1;
      if (timer !== null) {
        clearTimeout(timer);
      }
      setIsBotThinking(false);
    };
  }, [
    gameId,
    replayMode,
    gs,
    mySeatColor,
    state.perspective,
    dispatch,
    enqueueSnackbar,
    closeSnackbar,
  ]);

  if (!gs) {
    return (
      <main className="catan-game-screen">
        <GridLoader className="loader" color="#FACC15" size={80} />
      </main>
    );
  }

  const currentPalette = PLAYER_COLOR_META[gs.current_color];
  const devCardsRemaining = gs.development_listdeck
    ? Object.values(gs.development_listdeck).reduce((a, b) => a + b, 0)
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
          {gs.room_code && (
            <Link
              to={`/rooms/${gs.room_code}`}
              className="game-top-hud__room-badge"
              title="Ver Sala e Link de Convite"
            >
              🔗 Sala #{gs.room_code}
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
          <span>{describePromptBanner(gs, isBotThinking)}</span>
        </div>

        <div className="game-top-hud__right">
          <span
            className="game-top-hud__bank-chip"
            title="Cartas de Desenvolvimento restantes no baralho do banco"
          >
            🃏 <span className="hud-btn-label">Baralho Dev: </span>
            <strong>{devCardsRemaining}</strong>
          </span>
          {!replayMode && (
            <button
              type="button"
              className={cn("game-top-hud__speed-btn", {
                "is-fast": gameSpeed === "fast",
              })}
              onClick={toggleGameSpeed}
              title={
                gameSpeed === "fast"
                  ? "Velocidade: Rápido (0.5x) — Clique para voltar para Normal (1x)"
                  : "Velocidade: Normal (1x) — Clique para acelerar para Rápido (0.5x)"
              }
              aria-label={
                gameSpeed === "fast"
                  ? "Velocidade: Rápido (0.5x)"
                  : "Velocidade: Normal (1x)"
              }
            >
              <span>{gameSpeed === "fast" ? "⚡" : "🐢"}</span>
              <span className="game-top-hud__speed-text">
                {gameSpeed === "fast" ? "Rápido (0.5x)" : "Normal (1x)"}
              </span>
            </button>
          )}
          <button
            type="button"
            className="game-top-hud__mcts-btn"
            onClick={() =>
              dispatch({
                type: ACTIONS.SET_LEFT_DRAWER_OPENED,
                data: !state.isLeftDrawerOpen,
              })
            }
            aria-label="Histórico"
            title="Abrir Histórico de Jogadas"
          >
            📜 <span className="hud-btn-label">Histórico</span>
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
            aria-label="Chances (IA)"
            title="Abrir Análise de Probabilidade de Vitória (IA MCTS)"
          >
            📊 <span className="hud-btn-label">Chances (IA)</span>
          </button>
          {isMultiplayerGame &&
            !replayMode &&
            !gs.winning_color &&
            mySeatColor &&
            !isMySeatTakenOver && (
              <button
                type="button"
                className="game-top-hud__abandon-btn"
                onClick={() => setAbandonConfirmOpen(true)}
                title="Sair da partida e deixar um Bot IA assumir seu assento"
                aria-label="Sair (Bot Assume)"
              >
                🚪 <span className="hud-btn-label">Sair (Bot Assume)</span>
              </button>
            )}
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

      <PlayerTopBar gameState={gs} recentDevColor={recentDevColor} />

      {isMultiplayerGame &&
        !replayMode &&
        !gs.winning_color &&
        isMySeatTakenOver && (
          <div
            className="game-reclaim-banner"
            role="region"
            aria-label="Retomar assento"
          >
            <span className="game-reclaim-banner__text">
              🤖 Um Bot IA assumiu o seu assento enquanto você esteve ausente.
            </span>
            <button
              type="button"
              className="game-reclaim-banner__btn"
              disabled={isReclaiming}
              onClick={handleReclaimSeat}
            >
              {isReclaiming ? "Retomando..." : "↩️ Retomar Meu Assento"}
            </button>
          </div>
        )}

      <ZoomableBoard
        replayMode={replayMode}
        recentNodeId={recentNodeId}
        recentEdgeId={recentEdgeId}
      />

      {spotlightToast && (
        <div
          className="action-spotlight-toast"
          style={{
            borderColor:
              PLAYER_COLOR_META[spotlightToast.color]?.primary || "#facc15",
          }}
          role="status"
          aria-live="polite"
        >
          <span
            className="action-spotlight-toast__dot"
            style={{
              background:
                PLAYER_COLOR_META[spotlightToast.color]?.primary || "#facc15",
            }}
          />
          <span className="action-spotlight-toast__icon" aria-hidden="true">
            {spotlightToast.icon}
          </span>
          <span className="action-spotlight-toast__text">
            {spotlightToast.text}
          </span>
        </div>
      )}

      <DiceRollOverlay
        open={Boolean(diceStage?.open)}
        rolling={Boolean(diceStage?.rolling)}
        dice={diceStage?.dice ?? null}
        rollerName={diceStage?.rollerName ?? ""}
        rollerColor={diceStage?.rollerColor ?? gs.current_color}
      />

      <ActionsToolbar
        isBotThinking={isBotThinking}
        replayMode={replayMode}
        isRollingDice={Boolean(diceStage?.open && diceStage.rolling)}
      />
      <LeftDrawer />
      <RightDrawer>
        <AnalysisBox stateIndex={"latest"} />
        <Divider />
      </RightDrawer>

      <Dialog
        open={abandonConfirmOpen}
        onClose={() => !isAbandoning && setAbandonConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ className: "catan-modal-paper" }}
      >
        <DialogTitle className="catan-modal-title">
          🚪 Sair da Partida (Bot Assume)
        </DialogTitle>
        <DialogContent className="catan-modal-content">
          <p style={{ margin: 0, color: "#cbd5e1", lineHeight: 1.5 }}>
            Deseja sair e deixar um Bot jogar no seu lugar? Sua cor, peças e
            cartas serão preservadas e você poderá clicar em{" "}
            <strong>Retomar Meu Assento</strong> caso volte antes do fim da
            partida.
          </p>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setAbandonConfirmOpen(false)}
            disabled={isAbandoning}
            sx={{ color: "#cbd5e1", textTransform: "none" }}
          >
            Continuar Jogando
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleConfirmAbandon}
            disabled={isAbandoning}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            {isAbandoning ? "Saindo..." : "Confirmar Saída"}
          </Button>
        </DialogActions>
      </Dialog>
    </main>
  );
}

GameScreen.propTypes = {
  window: PropTypes.func,
};

export default GameScreen;
