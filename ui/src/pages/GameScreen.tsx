import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  Menu,
  MenuItem,
  useMediaQuery,
} from "@mui/material";
import { BookOpen, Castle, ChartColumn, FastForward, History, Map as MapIcon, MessageSquare, Smile } from "lucide-react";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";

import ZoomableBoard from "./ZoomableBoard";
import ActionsToolbar from "./ActionsToolbar";

import "./GameScreen.scss";
import LeftDrawer from "../components/LeftDrawer";
import RightDrawer from "../components/RightDrawer";
import PlayerTopBar, {
  type ActivePortraitTaunt,
  type FloatingDiscardFX,
  type FloatingVpFX,
  type FloatingYieldFX,
} from "../components/PlayerTopBar";
import CardGainOverlay from "../components/CardGainOverlay";
import { getCardGains } from "../utils/cardGains";
import GameChatPanel from "../components/GameChatPanel";
import MatchIntroOverlay from "../components/MatchIntroOverlay";
import AlmanacModal from "../components/AlmanacModal";
import DiceHistogram from "../components/DiceHistogram";
import OceanBackdrop from "../components/OceanBackdrop";
import LanguageToggle from "../components/LanguageToggle";
import { store } from "../store";
import ACTIONS from "../actions";
import {
  type StateIndex,
  abandonGame,
  getGameMessages,
  getSavedAccount,
  getState,
  postAction,
  reclaimGame,
  sendGameHeartbeat,
  sendGameMessage,
  setPerspective,
} from "../utils/apiClient";
import { dispatchSnackbar } from "../components/Snackbar";
import { getHumanColor, playerKey } from "../utils/stateUtils";
import AnalysisBox from "../components/AnalysisBox";
import { getPlayerColorMeta } from "../config/assetRegistry";
import { getSavedAccountAvatarSummary } from "../config/avatarCatalog";
import {
  formatBotSpeedLabel,
  normalizeBotSpeed,
  resolvePlayerDisplayName,
} from "../config/botCatalog";
import {
  TAUNT_COOLDOWN_MS,
  TAUNT_DISPLAY_MS,
  type TauntDefinition,
  encodeTauntBody,
  getTauntById,
  getTauntCatalog,
  parseTauntMessage,
} from "../config/tauntCatalog";
import {
  type AppLanguage,
  getCurrentLanguage,
  tr,
  useLanguage,
} from "../i18n";
import type { Card, Color, GameMessage, GameState } from "../utils/api.types";
import { getSavedGameSeat, saveGameSeat } from "../utils/seatStorage";
import {
  isSoundMuted,
  setSoundMuted,
  playActionRecordSound,
  playChatSound,
  playTauntSound,
  playVictorySound,
} from "../utils/soundEffects";
import { humanizeActionRecordPt } from "../utils/promptUtils";
import {
  LOCAL_MESSAGES_CHANNEL_NAME,
  LOCAL_MESSAGES_STORAGE_KEY,
} from "../utils/localEngine";
import {
  type GameSpeed,
  type RobberNoticeFX,
  type TurnHandoffFX,
  INTRO_SPLASH_MS,
  TURN_TRANSITION_MS,
  cycleGameSpeed,
  electBotCoordinator,
  extractBatchTransitionFX,
  extractTransitionVisuals,
  getActionDelayMs,
  getBotThinkDelayMs,
  getDiceOverlayDurationMs,
  getRollSpinDurationMs,
  getSavedGameSpeed,
  saveGameSpeed,
} from "../utils/tabletopPacing";
import { usePieceSkin } from "../utils/pieceSkin";
import { useBoardSkin } from "../utils/boardSkin";

const VALID_COLORS = new Set<Color>(["RED", "BLUE", "ORANGE", "WHITE"]);

function describePromptBanner(
  gameState: GameState,
  isBotThinking: boolean,
  lang: AppLanguage = getCurrentLanguage()
): string {
  const colorMeta = getPlayerColorMeta(lang);
  const en = lang === "en";
  if (gameState.winning_color) {
    const winName = resolvePlayerDisplayName(
      gameState,
      gameState.winning_color,
      colorMeta[gameState.winning_color].label
    );
    return en ? `🏆 ${winName} wins!` : `🏆 Vitória de ${winName}!`;
  }
  const activeLabel = resolvePlayerDisplayName(
    gameState,
    gameState.current_color,
    colorMeta[gameState.current_color].label
  );
  if (isBotThinking) {
    return en
      ? `🧭 ${activeLabel} is thinking...`
      : `🧭 ${activeLabel} está calculando a melhor jogada...`;
  }
  switch (gameState.current_prompt) {
    case "BUILD_INITIAL_SETTLEMENT":
      return en
        ? `Setup — ${activeLabel}: Choose a vertex to place your Settlement`
        : `Fase Inicial — ${activeLabel}: Escolha um vértice para fundar sua Aldeia`;
    case "BUILD_INITIAL_ROAD":
      return en
        ? `Setup — ${activeLabel}: Build a connected Road`
        : `Fase Inicial — ${activeLabel}: Construa uma Estrada conectada`;
    case "MOVE_ROBBER":
      return en
        ? `🥷 Robber Active — ${activeLabel}: Click a highlighted hex to move the Robber`
        : `🥷 Ladrão Ativo — ${activeLabel}: Clique em um hexágono iluminado para mover o Ladrão`;
    case "DISCARD":
      return en
        ? `⚠️ Rolled a 7 — ${activeLabel}: Discard ${gameState.current_discard_count} card(s)`
        : `⚠️ Sete nos Dados — ${activeLabel}: Descarte ${gameState.current_discard_count} carta(s)`;
    case "DECIDE_TRADE":
      return en
        ? `🤝 Trade — ${activeLabel}: Review the trade offer`
        : `🤝 Negociação — ${activeLabel}: Avalie a proposta de troca`;
    case "DECIDE_ACCEPTEES":
      return en
        ? `⚖️ Trade — ${activeLabel}: Choose whom to finalize the trade with`
        : `⚖️ Negociação — ${activeLabel}: Escolha com quem fechar a troca`;
    case "PLAY_TURN":
      return en
        ? `${activeLabel}'s Turn — Roll dice, trade, or build`
        : `Vez de ${activeLabel} — Role os dados, negocie ou construa`;
    default:
      return en ? `${activeLabel}'s Turn` : `Vez de ${activeLabel}`;
  }
}

function GameScreen({ replayMode }: { replayMode: boolean }) {
  const { gameId, stateIndex } = useParams();
  const [searchParams] = useSearchParams();
  const { state, dispatch } = useContext(store);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { language, t } = useLanguage();
  const colorMeta = useMemo(() => getPlayerColorMeta(language), [language]);
  const languageRef = useRef<AppLanguage>(language);
  languageRef.current = language;
  const [isBotThinking, setIsBotThinking] = useState(false);
  const thinkDeadlineRef = useRef({ key: "", at: 0 });
  const [cardGains, setCardGains] = useState<{ id: number; card: Card }[]>([]);
  const finishCardGain = useCallback(() => setCardGains([]), []);
  const [muted, setMuted] = useState(() => isSoundMuted());
  const [localGameSpeed, setLocalGameSpeed] = useState<GameSpeed>(() =>
    getSavedGameSpeed()
  );
  const gameSpeedRef = useRef<GameSpeed>(localGameSpeed);

  const [abandonConfirmOpen, setAbandonConfirmOpen] = useState(false);
  const [almanacOpen, setAlmanacOpen] = useState(false);
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

  const [introDismissedForGameId, setIntroDismissedForGameId] = useState<
    string | null
  >(null);
  const [turnPauseBanner, setTurnPauseBanner] = useState<TurnHandoffFX | null>(
    null
  );
  const [discardDrops, setDiscardDrops] = useState<FloatingDiscardFX[]>([]);
  const [yieldFX, setYieldFX] = useState<FloatingYieldFX[]>([]);
  const [vpFX, setVpFX] = useState<FloatingVpFX[]>([]);
  const [robberNotice, setRobberNotice] = useState<RobberNoticeFX | null>(null);

  const hasOceanChatSpace = useMediaQuery("(min-width: 1100px) and (min-height: 640px)");
  const [chatPreference, setChatOpen] = useState<boolean | null>(null);
  const chatOpen = chatPreference ?? (!replayMode && hasOceanChatSpace);
  const [chatMessages, setChatMessages] = useState<GameMessage[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatPreview, setChatPreview] = useState<GameMessage | null>(null);

  const [tauntPickerOpen, setTauntPickerOpen] = useState(false);
  const [tauntCoolingDown, setTauntCoolingDown] = useState(false);
  const [activeTaunts, setActiveTaunts] = useState<
    Partial<Record<Color, ActivePortraitTaunt>>
  >({});
  const { skin: pieceSkin, toggle: togglePieceSkin } = usePieceSkin();
  const { skin: boardSkin, changeSkin: setBoardSkin, skins: boardSkins } = useBoardSkin();
  const [boardSkinAnchor, setBoardSkinAnchor] = useState<HTMLElement | null>(null);
  const boardSkinLabel = t("Estilo do tabuleiro", "Board style");

  const prevStateRef = useRef<GameState | null>(null);
  const prevStateIndexRef = useRef<number | null>(null);
  const prevWinnerRef = useRef<Color | null>(null);
  const latestStateIndexRef = useRef<number | null>(null);
  const fxCounterRef = useRef<number>(1);
  const fxCleanupTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(
    new Set()
  );
  const nextBotReadyAtRef = useRef<number>(0);
  const botGenerationRef = useRef<number>(0);
  const lastSeenMessageIdRef = useRef<number>(0);
  const knownMessageIdsRef = useRef<Set<number>>(new Set());
  const chatInitializedRef = useRef<boolean>(false);
  const chatOpenRef = useRef<boolean>(false);
  const mySeatColorRef = useRef<Color | null>(null);
  chatOpenRef.current = chatOpen;

  const introTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turnPauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const robberNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const diceSpinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const diceHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tauntCooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const tauntTimersRef = useRef<
    Partial<Record<Color, ReturnType<typeof setTimeout>>>
  >({});
  const tauntNonceRef = useRef<number>(1);
  const lastBotTauntAtRef = useRef<number>(0);

  const gs = state.gameState;
  const topHudRef = useRef<HTMLDivElement>(null);
  const consoleRef = useRef<HTMLDivElement>(null);
  const shortcutsRef = useRef<HTMLElement>(null);
  const [hudClearance, setHudClearance] = useState<{ top: number; bottom: number; shortcutsHeight: number }>();
  latestStateIndexRef.current = gs?.state_index ?? null;
  const latestActionRecord = gs?.action_records?.[gs.action_records.length - 1];
  const isDiceRollStarting =
    !replayMode &&
    gs !== null &&
    prevStateIndexRef.current !== null &&
    gs.state_index > prevStateIndexRef.current &&
    latestActionRecord?.[0][1] === "ROLL" &&
    Boolean(extractTransitionVisuals(latestActionRecord).rollDice);
  const isRollingDice = isDiceRollStarting || Boolean(diceStage?.rolling);
  const introActive = Boolean(
    gs &&
      !replayMode &&
      gs.state_index === 0 &&
      gameId &&
      introDismissedForGameId !== gameId
  );

  const mySeatColor: Color | null = useMemo(() => {
    if (!gs) return null;
    const isNativeBot = (c: Color) =>
      gs.bot_colors.includes(c) &&
      !gs.taken_over_colors?.includes(c) &&
      !gs.seat_takeover?.[c]?.taken_over;

    const urlSeat = searchParams.get("seat")?.toUpperCase() as Color | undefined;
    if (urlSeat && VALID_COLORS.has(urlSeat) && gs.colors.includes(urlSeat) && !isNativeBot(urlSeat)) {
      return urlSeat;
    }
    const savedSeat = gameId ? getSavedGameSeat(gameId) : null;
    if (savedSeat && VALID_COLORS.has(savedSeat) && gs.colors.includes(savedSeat) && !isNativeBot(savedSeat)) {
      return savedSeat;
    }
    const activeHumans = gs.colors.filter((c) => !isNativeBot(c));
    const takeoverColors = Object.keys(gs.seat_takeover || {}) as Color[];
    const origHumanCount = new Set([...activeHumans, ...takeoverColors]).size;
    if (!gs.room_code && origHumanCount <= 1 && activeHumans.length === 1) {
      return activeHumans[0];
    }
    if (state.perspective && gs.colors.includes(state.perspective) && !isNativeBot(state.perspective)) {
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
    return null;
  }, [gs, gameId, searchParams, state.perspective]);

  const originalHumansCount = useMemo(() => {
    if (!gs) return 0;
    const activeHumans = gs.colors.filter((c) => !gs.bot_colors.includes(c));
    const takeoverKeys = Object.keys(gs.seat_takeover || {}) as Color[];
    return new Set([...activeHumans, ...takeoverKeys]).size;
  }, [gs]);

  const isMultiplayerGame = Boolean(gs?.room_code) || originalHumansCount >= 2;
  const isSpeedLockedOnline = !replayMode && isMultiplayerGame;
  const gameSpeed: GameSpeed = isSpeedLockedOnline
    ? (normalizeBotSpeed(gs?.bot_speed) ?? "normal")
    : localGameSpeed;
  gameSpeedRef.current = gameSpeed;
  const isMySeatTakenOver = Boolean(
    mySeatColor &&
      (gs?.seat_takeover?.[mySeatColor]?.taken_over ||
        gs?.taken_over_colors?.includes(mySeatColor))
  );
  mySeatColorRef.current = mySeatColor;

  const triggerPortraitTaunt = useCallback(
    (color: Color, taunt: TauntDefinition, playAudio: boolean) => {
      const nonce = tauntNonceRef.current++;
      setActiveTaunts((prev) => ({
        ...prev,
        [color]: {
          id: taunt.id,
          emoji: taunt.emoji,
          label: taunt.label,
          bubbleText: taunt.bubbleText,
          tone: taunt.tone,
          nonce,
        },
      }));
      const prevTimer = tauntTimersRef.current[color];
      if (prevTimer) clearTimeout(prevTimer);
      tauntTimersRef.current[color] = setTimeout(() => {
        delete tauntTimersRef.current[color];
        setActiveTaunts((prev) => {
          if (!prev[color] || prev[color]?.nonce !== nonce) return prev;
          const next = { ...prev };
          delete next[color];
          return next;
        });
      }, TAUNT_DISPLAY_MS);
      if (playAudio) {
        playTauntSound(taunt.tone);
      }
    },
    []
  );

  const applyIncomingChatMessages = useCallback(
    (incoming: GameMessage[], notifyOnNew: boolean) => {
      if (!Array.isArray(incoming) || incoming.length === 0) return;
      const unseen: GameMessage[] = [];
      for (const m of incoming) {
        if (m && typeof m.id === "number") {
          if (!knownMessageIdsRef.current.has(m.id)) {
            knownMessageIdsRef.current.add(m.id);
            unseen.push(m);
          }
          if (m.id > lastSeenMessageIdRef.current) {
            lastSeenMessageIdRef.current = m.id;
          }
        }
      }
      if (unseen.length === 0) return;

      setChatMessages((prev) => {
        const byId = new Map<number, GameMessage>();
        for (const existing of prev) byId.set(existing.id, existing);
        for (const nextMsg of unseen) byId.set(nextMsg.id, nextMsg);
        return Array.from(byId.values()).sort((a, b) => a.id - b.id);
      });

      if (notifyOnNew) {
        const mySeat = mySeatColorRef.current;
        const fromOthers = unseen.filter((m) => !mySeat || m.color !== mySeat);
        if (fromOthers.length > 0) {
          const regularChatMsgs: GameMessage[] = [];
          for (const msg of fromOthers) {
            const parsed = parseTauntMessage(
              msg.body,
              msg.kind,
              languageRef.current
            );
            if (parsed.taunt) {
              triggerPortraitTaunt(msg.color, parsed.taunt, true);
            } else {
              regularChatMsgs.push(msg);
            }
          }
          if (regularChatMsgs.length > 0) {
            playChatSound();
            if (!chatOpenRef.current) {
              setUnreadChatCount((c) => c + regularChatMsgs.length);
              setChatPreview(regularChatMsgs[regularChatMsgs.length - 1]);
              if (chatPreviewTimerRef.current) {
                clearTimeout(chatPreviewTimerRef.current);
              }
              chatPreviewTimerRef.current = setTimeout(() => {
                setChatPreview(null);
              }, 4200);
            }
          }
        }
      }
    },
    [triggerPortraitTaunt]
  );

  // Reset game-scoped refs when switching gameId
  useEffect(() => {
    prevStateRef.current = null;
    prevStateIndexRef.current = null;
    prevWinnerRef.current = null;
    latestStateIndexRef.current = null;
    nextBotReadyAtRef.current = 0;
    hasAbandonedRef.current = false;
    lastSeenMessageIdRef.current = 0;
    knownMessageIdsRef.current = new Set();
    chatInitializedRef.current = false;
    lastBotTauntAtRef.current = 0;
    for (const timer of Object.values(tauntTimersRef.current)) {
      if (timer) clearTimeout(timer);
    }
    tauntTimersRef.current = {};
    if (tauntCooldownTimerRef.current) {
      clearTimeout(tauntCooldownTimerRef.current);
      tauntCooldownTimerRef.current = null;
    }
    setIntroDismissedForGameId(null);
    setTurnPauseBanner(null);
    setDiscardDrops([]);
    setYieldFX([]);
    setCardGains([]);
    setVpFX([]);
    setRobberNotice(null);
    setChatMessages([]);
    setUnreadChatCount(0);
    setChatPreview(null);
    setChatError(null);
    setTauntPickerOpen(false);
    setTauntCoolingDown(false);
    setActiveTaunts({});
  }, [gameId]);

  // Clean up visual presentation timers on unmount
  useEffect(() => {
    const cleanupTimers = fxCleanupTimersRef.current;
    const tauntTimers = tauntTimersRef.current;
    return () => {
      if (introTimerRef.current) clearTimeout(introTimerRef.current);
      if (turnPauseTimerRef.current) clearTimeout(turnPauseTimerRef.current);
      if (robberNoticeTimerRef.current) clearTimeout(robberNoticeTimerRef.current);
      if (diceSpinTimerRef.current) clearTimeout(diceSpinTimerRef.current);
      if (diceHideTimerRef.current) clearTimeout(diceHideTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      if (chatPreviewTimerRef.current) clearTimeout(chatPreviewTimerRef.current);
      if (tauntCooldownTimerRef.current) {
        clearTimeout(tauntCooldownTimerRef.current);
      }
      for (const timer of Object.values(tauntTimers)) {
        if (timer) clearTimeout(timer);
      }
      for (const timer of cleanupTimers) clearTimeout(timer);
      cleanupTimers.clear();
    };
  }, []);

  // Automatically apply seat perspective if ?seat=COLOR is in URL, saved, or solo human
  useEffect(() => {
    if (!gameId || replayMode || !gs) return;
    const isNativeBot = (c: Color) =>
      gs.bot_colors.includes(c) &&
      !gs.taken_over_colors?.includes(c) &&
      !gs.seat_takeover?.[c]?.taken_over;

    const urlSeat = searchParams.get("seat")?.toUpperCase() as Color | undefined;
    const savedSeat = getSavedGameSeat(gameId);
    const activeHumans = gs.colors.filter((c) => !isNativeBot(c));
    const takeoverColors = Object.keys(gs.seat_takeover || {}) as Color[];
    const origHumanCount = new Set([...activeHumans, ...takeoverColors]).size;

    let targetSeat: Color | null = null;
    if (urlSeat && VALID_COLORS.has(urlSeat) && gs.colors.includes(urlSeat) && !isNativeBot(urlSeat)) {
      targetSeat = urlSeat;
    } else if (savedSeat && VALID_COLORS.has(savedSeat) && gs.colors.includes(savedSeat) && !isNativeBot(savedSeat)) {
      targetSeat = savedSeat;
    } else if (!gs.room_code && origHumanCount <= 1 && activeHumans.length === 1) {
      targetSeat = activeHumans[0];
    } else {
      const acctUsername =
        getSavedAccount?.()?.username ??
        getSavedAccountAvatarSummary()?.username;
      if (acctUsername) {
        const matched = gs.colors.find(
          (c) =>
            gs.seat_avatars?.[c]?.username === acctUsername ||
            gs.seat_takeover?.[c]?.original_username === acctUsername
        );
        if (matched) targetSeat = matched;
      }
    }

    if (targetSeat) {
      saveGameSeat(gameId, targetSeat);
      if (state.perspective !== targetSeat) {
        dispatch({ type: ACTIONS.SET_PERSPECTIVE, data: targetSeat });
      }
    } else if (state.perspective && isNativeBot(state.perspective)) {
      const fallback = activeHumans[0] ?? null;
      dispatch({ type: ACTIONS.SET_PERSPECTIVE, data: fallback });
      if (fallback) saveGameSeat(gameId, fallback);
    }
  }, [gameId, replayMode, searchParams, state.perspective, gs, dispatch]);

  // Synchronize perspective to apiClient
  useEffect(() => {
    setPerspective(state.perspective);
  }, [state.perspective]);

  // Load game state
  useEffect(() => {
    if (!gameId) {
      return;
    }

    (async () => {
      const gameState = await getState(gameId, stateIndex as StateIndex);
      dispatch({ type: ACTIONS.SET_GAME_STATE, data: gameState });
    })();
  }, [gameId, stateIndex, dispatch]);

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

    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const latest = await getState(gameId, "latest");
        if (cancelled || latest.state_index < (latestStateIndexRef.current ?? 0)) return;
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

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
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

  const hasGameState = Boolean(gs);
  useLayoutEffect(() => {
    const topHud = topHudRef.current;
    const console = consoleRef.current;
    const shortcuts = shortcutsRef.current;
    const screen = topHud?.parentElement;
    if (!topHud || !console || !shortcuts || !screen || !hasGameState) return;

    const measure = () => {
      const screenBottom = screen.getBoundingClientRect().bottom;
      const top = topHud.offsetHeight + 4;
      const bottom = Math.ceil(screenBottom - console.getBoundingClientRect().top) + 4;
      const shortcutsHeight = shortcuts.offsetHeight;
      if (top <= 4 || bottom <= 4) return;
      setHudClearance((current) => (
        current?.top === top && current.bottom === bottom && current.shortcutsHeight === shortcutsHeight
          ? current
          : { top, bottom, shortcutsHeight }
      ));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(topHud);
    observer.observe(console);
    observer.observe(shortcuts);
    observer.observe(screen);
    return () => observer.disconnect();
  }, [hasGameState, gameId]);

  // 10s multiplayer heartbeat to prevent false inactivity takeover and sync promoted bots promptly
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

  // Initial chat history load + BroadcastChannel/storage sync + immediate refresh when drawer opens
  useEffect(() => {
    if (!gameId || !hasGameState) return;
    let active = true;

    (async () => {
      try {
        const msgs = await getGameMessages(
          gameId,
          chatInitializedRef.current ? lastSeenMessageIdRef.current : 0
        );
        if (!active) return;
        const notify = !replayMode && chatInitializedRef.current;
        chatInitializedRef.current = true;
        applyIncomingChatMessages(msgs, notify);
      } catch {
        // ignore transient chat fetch errors
      }
    })();

    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        channel = new BroadcastChannel(LOCAL_MESSAGES_CHANNEL_NAME);
        channel.onmessage = (ev) => {
          if (!active || ev?.data?.gameId !== gameId || !ev?.data?.message) {
            return;
          }
          applyIncomingChatMessages([ev.data.message as GameMessage], !replayMode);
        };
      }
    } catch {
      channel = null;
    }

    const onStorage = (ev: StorageEvent) => {
      if (!active || ev.key !== LOCAL_MESSAGES_STORAGE_KEY || !ev.newValue) {
        return;
      }
      try {
        const map = JSON.parse(ev.newValue) as Record<string, GameMessage[]>;
        const rows = Array.isArray(map?.[gameId]) ? map[gameId] : [];
        if (rows.length > 0) {
          applyIncomingChatMessages(rows, !replayMode);
        }
      } catch {
        // ignore storage parse error
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      active = false;
      if (channel) channel.close();
      window.removeEventListener("storage", onStorage);
    };
  }, [gameId, hasGameState, replayMode, applyIncomingChatMessages]);

  // Refresh immediately when chat drawer opens
  useEffect(() => {
    if (!gameId || !hasGameState || !chatOpen) return;
    let active = true;
    (async () => {
      try {
        const msgs = await getGameMessages(gameId, lastSeenMessageIdRef.current);
        if (active && msgs.length > 0) {
          applyIncomingChatMessages(msgs, false);
        }
      } catch {
        // ignore transient errors
      }
    })();
    return () => {
      active = false;
    };
  }, [gameId, hasGameState, chatOpen, applyIncomingChatMessages]);

  // Real-time chat polling (1500ms) in active multiplayer matches even during your own turn
  useEffect(() => {
    if (!gameId || !hasGameState || !isMultiplayerGame || replayMode) {
      return;
    }
    const interval = setInterval(async () => {
      try {
        const msgs = await getGameMessages(gameId, lastSeenMessageIdRef.current);
        if (msgs.length > 0) {
          applyIncomingChatMessages(msgs, chatInitializedRef.current);
        }
      } catch {
        // ignore transient chat polling errors
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [gameId, hasGameState, isMultiplayerGame, replayMode, applyIncomingChatMessages]);

  // Play tabletop audio cues, intro "Boa Guerra", turn pause "Vez de...", 2D6 dice stage, visible discards/yields, and spotlight toast
  useEffect(() => {
    if (!gs) return;

    if (prevStateIndexRef.current === null) {
      prevStateRef.current = gs;
      prevStateIndexRef.current = gs.state_index;
      prevWinnerRef.current = gs.winning_color;

      if (!replayMode && gs.state_index === 0) {
        if (introTimerRef.current) clearTimeout(introTimerRef.current);
        introTimerRef.current = setTimeout(() => {
          setIntroDismissedForGameId(gameId ?? "__done__");
        }, INTRO_SPLASH_MS);

        const activeHumans = gs.colors.filter((c) => !gs.bot_colors.includes(c));
        const starterIsLocal =
          !gs.bot_colors.includes(gs.current_color) &&
          (mySeatColor !== null
            ? gs.current_color === mySeatColor
            : activeHumans.length === 1);
        const activeLang = languageRef.current;
        const activeColorMeta = getPlayerColorMeta(activeLang);
        const starterName = resolvePlayerDisplayName(
          gs,
          gs.current_color,
          activeColorMeta[gs.current_color]?.label || gs.current_color
        );
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setSpotlightToast({
          text: starterIsLocal
            ? tr(
                "Ordem sorteada: Você inicia a partida!",
                "Turn order rolled: You start the match!",
                activeLang
              )
            : tr(
                `Ordem sorteada: ${starterName} inicia a partida!`,
                `Turn order rolled: ${starterName} starts the match!`,
                activeLang
              ),
          color: gs.current_color,
          icon: "🎲",
        });
        toastTimerRef.current = setTimeout(() => {
          setSpotlightToast(null);
        }, INTRO_SPLASH_MS);
      }
      return;
    }

    if (gs.state_index > prevStateIndexRef.current && !replayMode) {
      const activeLang = languageRef.current;
      const activeColorMeta = getPlayerColorMeta(activeLang);
      const batchFx = extractBatchTransitionFX(
        prevStateRef.current,
        gs,
        mySeatColor,
        activeLang
      );
      const latestRecord = latestActionRecord;
      const gainedCards = getCardGains(prevStateRef.current, gs, mySeatColor ?? getHumanColor(gs, state.perspective) ?? null);
      if (gainedCards.length) {
        const entries = gainedCards.map((card) => ({ id: fxCounterRef.current++, card }));
        setCardGains((queue) => [...queue, ...entries]);
      }
      playActionRecordSound(latestRecord);
      if (gs.winning_color && !prevWinnerRef.current) {
        playVictorySound();
      }

      if (batchFx.discards.length > 0) {
        const createdDrops = batchFx.discards.map((d) => ({
          id: fxCounterRef.current++,
          color: d.color,
          resource: d.resource,
        }));
        const createdIds = new Set(createdDrops.map((d) => d.id));
        setDiscardDrops((prev) => [...prev.slice(-8), ...createdDrops]);
        const t = setTimeout(() => {
          fxCleanupTimersRef.current.delete(t);
          setDiscardDrops((prev) => prev.filter((item) => !createdIds.has(item.id)));
        }, 2500);
        fxCleanupTimersRef.current.add(t);
      }

      if (batchFx.yields.length > 0) {
        const createdYields = batchFx.yields.map((y) => ({
          id: fxCounterRef.current++,
          color: y.color,
          resource: y.resource,
          amount: y.amount,
        }));
        const createdIds = new Set(createdYields.map((y) => y.id));
        const revealDelay = latestRecord?.[0][1] === "ROLL" ? getRollSpinDurationMs(gameSpeedRef.current) : 0;
        const t = setTimeout(() => {
          fxCleanupTimersRef.current.delete(t);
          setYieldFX((prev) => [...prev.slice(-10), ...createdYields]);
          const cleanup = setTimeout(() => {
            fxCleanupTimersRef.current.delete(cleanup);
            setYieldFX((prev) => prev.filter((item) => !createdIds.has(item.id)));
          }, 2300);
          fxCleanupTimersRef.current.add(cleanup);
        }, revealDelay);
        fxCleanupTimersRef.current.add(t);
      }

      if (batchFx.vpDeltas.length > 0) {
        const createdVps = batchFx.vpDeltas.map((v) => ({
          id: fxCounterRef.current++,
          color: v.color,
          delta: v.delta,
        }));
        const createdIds = new Set(createdVps.map((v) => v.id));
        setVpFX((prev) => [...prev.slice(-6), ...createdVps]);
        const t = setTimeout(() => {
          fxCleanupTimersRef.current.delete(t);
          setVpFX((prev) => prev.filter((item) => !createdIds.has(item.id)));
        }, 2500);
        fxCleanupTimersRef.current.add(t);
      }

      if (batchFx.robberEvent) {
        if (robberNoticeTimerRef.current) clearTimeout(robberNoticeTimerRef.current);
        setRobberNotice(batchFx.robberEvent);
        robberNoticeTimerRef.current = setTimeout(() => {
          setRobberNotice(null);
        }, 6200);
      }

      if (batchFx.turnHandoff) {
        if (turnPauseTimerRef.current) clearTimeout(turnPauseTimerRef.current);
        setTurnPauseBanner(batchFx.turnHandoff);
        turnPauseTimerRef.current = setTimeout(() => {
          setTurnPauseBanner(null);
        }, TURN_TRANSITION_MS);
      }

      if (latestRecord && latestRecord[0]) {
        const visuals = extractTransitionVisuals(latestRecord);
        const actorColor = latestRecord[0][0];
        const actorName = resolvePlayerDisplayName(
          gs,
          actorColor,
          activeColorMeta[actorColor]?.label || actorColor
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
          const overlayMs = getDiceOverlayDurationMs(gameSpeedRef.current);

          diceSpinTimerRef.current = setTimeout(() => {
            setDiceStage((prev) =>
              prev ? { ...prev, rolling: false } : null
            );
          }, spinMs);

          diceHideTimerRef.current = setTimeout(() => {
            setDiceStage(null);
          }, overlayMs);
        }

        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setSpotlightToast({
          text: humanizeActionRecordPt(gs, latestRecord, activeLang),
          color: actorColor,
          icon: visuals.actionIcon,
        });
        toastTimerRef.current = setTimeout(() => {
          setSpotlightToast(null);
        }, 3600 + (visuals.rollDice ? getRollSpinDurationMs(gameSpeedRef.current) : 0));

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
          }, 4200);
        }

        // Contextual rate-limited bot portrait reactions (>= 18s global cooldown)
        const nowTs = Date.now();
        if (nowTs - lastBotTauntAtRef.current >= 18_000) {
          const [, recType, recVal] = latestRecord[0];
          let botReaction: { color: Color; tauntId: string } | null = null;
          if (recType === "MOVE_ROBBER" && Array.isArray(recVal)) {
            const victim = recVal[1] as Color | undefined;
            if (victim && gs.bot_colors.includes(victim)) {
              botReaction = { color: victim, tauntId: "olha_trairagem" };
            } else if (victim && gs.bot_colors.includes(actorColor)) {
              botReaction = { color: actorColor, tauntId: "quedi_a_paia" };
            }
          } else if (
            gs.winning_color &&
            !prevWinnerRef.current &&
            gs.bot_colors.includes(gs.winning_color)
          ) {
            botReaction = { color: gs.winning_color, tauntId: "praca_nossa" };
          } else if (
            gs.bot_colors.includes(actorColor) &&
            (recType === "BUILD_SETTLEMENT" || recType === "BUILD_CITY")
          ) {
            const actorKey = playerKey(gs, actorColor);
            const vps =
              gs.player_state?.[`${actorKey}_ACTUAL_VICTORY_POINTS`] ??
              gs.player_state?.[`${actorKey}_VICTORY_POINTS`] ??
              0;
            const targetVp = gs.game?.vps_to_win ?? 10;
            if (vps >= Math.max(4, targetVp - 2)) {
              botReaction = { color: actorColor, tauntId: "praca_nossa" };
            }
          }

          if (botReaction) {
            const def = getTauntById(botReaction.tauntId, activeLang);
            if (def) {
              lastBotTauntAtRef.current = nowTs;
              triggerPortraitTaunt(botReaction.color, def, false);
            }
          }
        }
      }
    }

    prevStateRef.current = gs;
    prevStateIndexRef.current = gs.state_index;
    prevWinnerRef.current = gs.winning_color;
  }, [gs, latestActionRecord, replayMode, mySeatColor, gameId, triggerPortraitTaunt]);

  const handleDismissIntro = () => {
    if (introTimerRef.current) clearTimeout(introTimerRef.current);
    setIntroDismissedForGameId(gameId ?? "__done__");
  };

  const toggleSoundMute = () => {
    const next = !muted;
    setMuted(next);
    setSoundMuted(next);
  };

  const toggleGameSpeed = () => {
    if (isSpeedLockedOnline) return;
    const next = cycleGameSpeed(localGameSpeed);
    setLocalGameSpeed(next);
    saveGameSpeed(next);
  };

  const handleToggleChat = () => {
    if (!chatOpen) {
      setUnreadChatCount(0);
      setChatPreview(null);
      setChatError(null);
    }
    setChatOpen(!chatOpen);
  };

  const handleSendChat = async (body: string) => {
    if (!gameId || !gs || !mySeatColor || replayMode || isSendingChat) return;
    setIsSendingChat(true);
    setChatError(null);
    try {
      const sent = await sendGameMessage(gameId, {
        body,
        color: mySeatColor,
        senderName: resolvePlayerDisplayName(
          gs,
          mySeatColor,
          colorMeta[mySeatColor]?.label || mySeatColor
        ),
      });
      applyIncomingChatMessages([sent], false);
    } catch (err: any) {
      const desc =
        err?.response?.data?.description ||
        err?.message ||
        t("Não foi possível enviar a mensagem.", "Could not send the message.");
      setChatError(desc);
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleSendTaunt = async (tauntId: string) => {
    if (!gameId || !gs || !mySeatColor || replayMode || tauntCoolingDown) {
      return;
    }
    const def = getTauntById(tauntId, language);
    if (!def) return;

    setTauntPickerOpen(false);
    setTauntCoolingDown(true);
    if (tauntCooldownTimerRef.current) {
      clearTimeout(tauntCooldownTimerRef.current);
    }
    tauntCooldownTimerRef.current = setTimeout(() => {
      tauntCooldownTimerRef.current = null;
      setTauntCoolingDown(false);
    }, TAUNT_COOLDOWN_MS);

    triggerPortraitTaunt(mySeatColor, def, true);

    try {
      const sent = await sendGameMessage(gameId, {
        body: encodeTauntBody(def.id),
        color: mySeatColor,
        senderName: resolvePlayerDisplayName(
          gs,
          mySeatColor,
          colorMeta[mySeatColor]?.label || mySeatColor
        ),
        kind: "TAUNT",
      });
      if (sent && typeof sent.id === "number") {
        applyIncomingChatMessages([sent], false);
      }
    } catch {
      // Portrait feedback stays active even if network sync fails transiently
    }
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

  const isTurnPauseActive = Boolean(turnPauseBanner);

  // Coordinated ?bot_only=1 pacing loop
  useEffect(() => {
    if (
      !gs ||
      replayMode ||
      !gameId ||
      gs.winning_color ||
      introActive ||
      isTurnPauseActive || isRollingDice || cardGains.length > 0
    ) {
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

    const thinkKey = `${gameId}:${gs.state_index}:${gameSpeed}`;
    if (thinkDeadlineRef.current.key !== thinkKey) {
      thinkDeadlineRef.current = { key: thinkKey, at: Date.now() + getBotThinkDelayMs(gs.state_index, gameSpeed) };
    }
    const remainingHold = Math.max(0, nextBotReadyAtRef.current - Date.now(), thinkDeadlineRef.current.at - Date.now());
    if (gameSpeed === "slow" && remainingHold > 0) setIsBotThinking(true);
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
    introActive,
    isTurnPauseActive,
    isRollingDice,
    cardGains.length,
    gameSpeed,
    mySeatColor,
    dispatch,
    enqueueSnackbar,
    closeSnackbar,
  ]);

  if (!gs) {
    return (
      <main className="catan-game-screen">
        <OceanBackdrop />
        <GridLoader className="loader" color="#FACC15" size={80} />
      </main>
    );
  }

  const currentPalette = colorMeta[gs.current_color];
  const devCardsRemaining = gs.development_listdeck
    ? Object.values(gs.development_listdeck).reduce((a, b) => a + b, 0)
    : 0;
  const tauntCatalog = getTauntCatalog(language);

  return (
    <main
      className="catan-game-screen"
      style={hudClearance ? ({
        "--match-top-clearance": `${hudClearance.top}px`,
        "--match-bottom-clearance": `${hudClearance.bottom}px`,
      } as React.CSSProperties) : undefined}
    >
      <div
        className="ocean-panorama-backdrop ocean-panorama-backdrop--room-floor"
        aria-hidden="true"
      />

      {/* Fullscreen Board + Tabletop Canvas (Zoom In/Out scales table, board, and dice inside the box together) */}
      <ZoomableBoard
        isRollingDice={isRollingDice}
        replayMode={replayMode}
        hudClearance={hudClearance && {
          top: hudClearance.top,
          bottom: hudClearance.bottom,
        }}
        recentNodeId={recentNodeId}
        recentEdgeId={recentEdgeId}
        diceStage={{
          open: Boolean(diceStage?.open),
          rolling: Boolean(diceStage?.rolling),
          dice: diceStage?.dice ?? null,
          rollerName: diceStage?.rollerName ?? "",
          rollerColor: diceStage?.rollerColor ?? gs.current_color,
        }}
      />

      {/* Floating Top HUD Container (Glassmorphism over sea) */}
      <div className="game-top-hud-container" ref={topHudRef}>
        <header className="game-top-hud">
          <div className="game-top-hud__left">
            <Link
              to="/"
              className="game-top-hud__home-btn"
              title={t("Voltar ao Lobby", "Back to Lobby")}
            >
              ← Lobby
            </Link>
            <h1 className="logo">Rule the Isle</h1>
            {gs.room_code && (
              <Link
                to={`/rooms/${gs.room_code}`}
                className="game-top-hud__room-badge"
                title={t("Ver Sala e Link de Convite", "View Room & Invite Link")}
              >
                🔗 {t("Sala", "Room")} #{gs.room_code}
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
            <span>{describePromptBanner(gs, isBotThinking, language)}</span>
          </div>

          <div className="game-top-hud__right">
            <span
              className="game-top-hud__bank-chip"
              title={t(
                "Cartas de Desenvolvimento restantes no baralho do banco",
                "Remaining Development Cards in the bank deck"
              )}
            >
              🃏{" "}
              <span className="hud-btn-label">
                {t("Baralho Dev:", "Dev Deck:")}{" "}
              </span>
              <strong>{devCardsRemaining}</strong>
            </span>
            <LanguageToggle compact />
            {isMultiplayerGame &&
              !replayMode &&
              !gs.winning_color &&
              mySeatColor &&
              !isMySeatTakenOver && (
                <button
                  type="button"
                  className="game-top-hud__abandon-btn"
                  onClick={() => setAbandonConfirmOpen(true)}
                  title={t(
                    "Sair da partida e deixar um Bot IA assumir seu assento",
                    "Leave the match and let an AI Bot take over your seat"
                  )}
                  aria-label={t("Sair (Bot Assume)", "Leave (Bot Takes Over)")}
                >
                  🚪{" "}
                  <span className="hud-btn-label">
                    {t("Sair (Bot Assume)", "Leave (Bot Takes Over)")}
                  </span>
                </button>
              )}
          </div>
        </header>

        <PlayerTopBar
          gameState={gs}
          recentDevColor={recentDevColor}
          discardDrops={discardDrops}
          yieldFX={yieldFX}
          vpFX={vpFX}
          activeTaunts={activeTaunts}
        />

        {isMultiplayerGame &&
          !replayMode &&
          !gs.winning_color &&
          isMySeatTakenOver && (
            <div
              className="game-reclaim-banner"
              role="region"
              aria-label={t("Retomar assento", "Reclaim seat")}
            >
              <span className="game-reclaim-banner__text">
                🤖{" "}
                {t(
                  "Um Bot IA assumiu o seu assento enquanto você esteve ausente.",
                  "An AI Bot took over your seat while you were away."
                )}
              </span>
              <button
                type="button"
                className="game-reclaim-banner__btn"
                disabled={isReclaiming}
                onClick={handleReclaimSeat}
              >
                {isReclaiming
                  ? t("Retomando...", "Reclaiming...")
                  : t("↩️ Retomar Meu Assento", "↩️ Reclaim My Seat")}
              </button>
            </div>
          )}
      </div>

      {/* Left Vertical Quick Dock (Catan Universe style shortcuts) */}
      <nav
        ref={shortcutsRef}
        className="game-left-dock"
        aria-label={t("Atalhos da partida", "Match shortcuts")}
      >
        {!replayMode && (
          <button
            type="button"
            disabled={isSpeedLockedOnline}
            className={cn("game-left-dock__btn", {
              "is-fast": gameSpeed === "fast",
              "is-turbo": gameSpeed === "turbo",
              "is-locked": isSpeedLockedOnline,
            })}
            onClick={toggleGameSpeed}
            title={isSpeedLockedOnline
              ? `Velocidade: ${formatBotSpeedLabel(gameSpeed, "pt")} (Definida pela sala)`
              : `Velocidade: ${formatBotSpeedLabel(gameSpeed, "pt")} — Clique para mudar para ${formatBotSpeedLabel(cycleGameSpeed(gameSpeed), "pt")}`}
            aria-label={`Velocidade: ${formatBotSpeedLabel(gameSpeed, "pt")}${isSpeedLockedOnline ? " (Travada pela sala)" : ""}`}
          >
            <span className="game-left-dock__icon" aria-hidden="true">
              <FastForward />
            </span>
            <span className="game-left-dock__tag">
              {gameSpeed === "slow" ? "Lenta" : gameSpeed === "normal"
                ? "1×"
                : gameSpeed === "fast"
                  ? t("Ráp", "Fast")
                  : "Trb"}
            </span>
            {isSpeedLockedOnline && (
              <span className="game-left-dock__lock" aria-hidden="true">
                🔒
              </span>
            )}
          </button>
        )}

        <button
          type="button"
          className={cn("game-left-dock__btn game-left-dock__btn--chat", {
            "is-open": chatOpen,
            "has-unread": unreadChatCount > 0,
          })}
          onClick={handleToggleChat}
          aria-label={
            unreadChatCount > 0
              ? t(
                  `Bate-papo (${unreadChatCount} não lidas)`,
                  `Chat (${unreadChatCount} unread)`
                )
              : t("Bate-papo", "Chat")
          }
          aria-expanded={chatOpen}
          title={t("Abrir Bate-papo da Partida", "Open Match Chat")}
        >
          <span className="game-left-dock__icon" aria-hidden="true"><MessageSquare /></span>
          <span className="game-left-dock__tag" aria-hidden="true">Chat</span>
          {unreadChatCount > 0 && (
            <span className="game-left-dock__badge">
              {unreadChatCount > 9 ? "9+" : unreadChatCount}
            </span>
          )}
        </button>

        {!replayMode && mySeatColor && (
          <div className="taunt-picker-wrap">
            <button
              type="button"
              className={cn("game-left-dock__btn", {
                "is-open": tauntPickerOpen,
                "is-cooldown": tauntCoolingDown,
              })}
              onClick={() => setTauntPickerOpen((prev) => !prev)}
              aria-label={t("Provocações", "Taunts")}
              aria-expanded={tauntPickerOpen}
              disabled={tauntCoolingDown}
              title={
                tauntCoolingDown
                  ? t(
                      "Aguarde 3s para enviar outra provocação",
                      "Wait 3s before sending another taunt"
                    )
                  : t(
                      "Enviar provocação ou saudação animada",
                      "Send animated taunt or greeting"
                    )
              }
            >
              <span className="game-left-dock__icon" aria-hidden="true"><Smile /></span>
            </button>
            {tauntPickerOpen && (
              <div
                className="taunt-picker-popover taunt-picker-popover--dock"
                role="dialog"
                aria-label={t("Escolher provocação", "Choose taunt")}
              >
                <div className="taunt-picker-popover__header">
                  <span>🎭 {t("Provocações & Saudações", "Taunts & Greetings")}</span>
                  <button
                    type="button"
                    className="taunt-picker-popover__close"
                    onClick={() => setTauntPickerOpen(false)}
                    aria-label={t("Fechar provocações", "Close taunts")}
                  >
                    ✕
                  </button>
                </div>
                <div className="taunt-picker-popover__grid">
                  {tauntCatalog.map((taunt) => (
                    <button
                      key={taunt.id}
                      type="button"
                      className="taunt-picker-popover__item"
                      onClick={() => handleSendTaunt(taunt.id)}
                    >
                      <span className="taunt-picker-popover__emoji">
                        {taunt.emoji}
                      </span>
                      <span className="taunt-picker-popover__label">
                        {taunt.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          className={cn("game-left-dock__btn", {
            "is-open": state.isLeftDrawerOpen,
          })}
          onClick={() =>
            dispatch({
              type: ACTIONS.SET_LEFT_DRAWER_OPENED,
              data: !state.isLeftDrawerOpen,
            })
          }
          aria-label={t("Histórico", "History")}
          title={t("Abrir Histórico de Jogadas", "Open Action Log")}
        >
          <span className="game-left-dock__icon" aria-hidden="true"><History /></span>
        </button>

        <button
          type="button"
          className={cn("game-left-dock__btn", {
            "is-open": state.isRightDrawerOpen,
          })}
          onClick={() =>
            dispatch({
              type: ACTIONS.SET_RIGHT_DRAWER_OPENED,
              data: !state.isRightDrawerOpen,
            })
          }
          aria-label={t("Chances (IA)", "Win Odds (AI)")}
          title={t(
            "Chances (IA) & Histograma de Dados",
            "Win Odds (AI) & Dice Histogram"
          )}
        >
          <span className="game-left-dock__icon" aria-hidden="true"><ChartColumn /></span>
        </button>

        <button
          type="button"
          className={cn("game-left-dock__btn", {
            "is-open": almanacOpen,
          })}
          onClick={() => setAlmanacOpen(true)}
          aria-label={t("Almanaque", "Almanac")}
          title={t("Abrir Almanaque & Regras", "Open Almanac & Rules")}
        >
          <span className="game-left-dock__icon" aria-hidden="true"><BookOpen /></span>
        </button>

        <button
          type="button"
          className={cn("game-left-dock__btn", {
            "is-variant": boardSkin !== "diorama",
          })}
          onClick={(event) => setBoardSkinAnchor(event.currentTarget)}
          aria-label={boardSkinLabel}
          aria-haspopup="menu"
          aria-expanded={Boolean(boardSkinAnchor)}
          title={`${boardSkinLabel} · ${t(boardSkins[boardSkin].namePt, boardSkins[boardSkin].nameEn)}`}
        >
          <span className="game-left-dock__icon" aria-hidden="true"><MapIcon /></span>
        </button>
        <Menu
          anchorEl={boardSkinAnchor}
          open={Boolean(boardSkinAnchor)}
          onClose={() => setBoardSkinAnchor(null)}
          slotProps={{ list: { "aria-label": boardSkinLabel } }}
        >
          {Object.values(boardSkins).map((option) => (
            <MenuItem
              key={option.id}
              role="menuitemradio"
              aria-checked={option.id === boardSkin}
              selected={option.id === boardSkin}
              onClick={() => {
                setBoardSkin(option.id);
                setBoardSkinAnchor(null);
              }}
            >
              {t(option.namePt, option.nameEn)}
            </MenuItem>
          ))}
        </Menu>

        <button
          type="button"
          className={cn("game-left-dock__btn", {
            "is-variant": pieceSkin === "cottage",
          })}
          onClick={() => {
            const next = togglePieceSkin();
            enqueueSnackbar(
              t(
                `Estilo das Peças: ${next === "contrast" ? "Alto Contraste (Padrão)" : "Vilarejo Detalhado (Variante)"}`,
                `Piece Style: ${next === "contrast" ? "High Contrast (Default)" : "Detailed Cottage (Variant)"}`
              ),
              { variant: "info", autoHideDuration: 2200 }
            );
          }}
          title={t(
            `Estilo das Peças: ${pieceSkin === "contrast" ? "Alto Contraste (Padrão)" : "Vilarejo Detalhado (Variante)"}. Clique para alternar`,
            `Piece Style: ${pieceSkin === "contrast" ? "High Contrast (Default)" : "Detailed Cottage (Variant)"}. Click to switch`
          )}
          aria-label={t("Alternar estilo das peças", "Switch piece style")}
        >
          <span className="game-left-dock__icon" aria-hidden="true"><Castle /></span>
          <span className="game-left-dock__tag">
            {pieceSkin === "contrast" ? "Min" : "Det"}
          </span>
        </button>

        <button
          type="button"
          className="game-left-dock__btn"
          onClick={toggleSoundMute}
          title={
            muted
              ? t("Ativar efeitos sonoros", "Enable sound effects")
              : t("Silenciar efeitos sonoros", "Mute sound effects")
          }
          aria-label={
            muted ? t("Ativar som", "Unmute sound") : t("Silenciar som", "Mute sound")
          }
        >
          {muted ? <VolumeOffIcon fontSize="small" /> : <VolumeUpIcon fontSize="small" />}
        </button>
      </nav>

      {spotlightToast && (
        <div
          className="action-spotlight-toast"
          style={{
            borderColor:
              colorMeta[spotlightToast.color]?.primary || "#facc15",
          }}
          role="status"
          aria-live="polite"
        >
          <span
            className="action-spotlight-toast__dot"
            style={{
              background:
                colorMeta[spotlightToast.color]?.primary || "#facc15",
            }}
          />
          <span className="action-spotlight-toast__icon" aria-hidden="true">
            {spotlightToast.icon}
          </span>
          <span className="action-spotlight-toast__text">
            {isRollingDice && latestActionRecord?.[0][1] === "ROLL" ? "Rolando os dados…" : spotlightToast.text}
          </span>
        </div>
      )}

      {!isRollingDice && cardGains.length > 0 && (
        <CardGainOverlay
          key={cardGains[0].id}
          cards={cardGains.map((item) => item.card)}
          onComplete={finishCardGain}
        />
      )}

      {turnPauseBanner && !introActive && (
        <div
          className={cn("turn-transition-banner", {
            "is-local": turnPauseBanner.isLocal,
          })}
          style={
            {
              "--turn-color":
                colorMeta[turnPauseBanner.color]?.primary || "#facc15",
              "--turn-glow":
                colorMeta[turnPauseBanner.color]?.glow ||
                "rgba(250, 204, 21, 0.55)",
            } as React.CSSProperties
          }
          role="status"
          aria-live="polite"
        >
          <span className="turn-transition-banner__crest" aria-hidden="true">
            <span
              className="turn-transition-banner__dot"
              style={{
                background:
                  colorMeta[turnPauseBanner.color]?.primary || "#facc15",
              }}
            />
          </span>
          <span className="turn-transition-banner__text">
            {turnPauseBanner.isLocal
              ? t(
                  `Vez de ${turnPauseBanner.name} — Sua vez!`,
                  `${turnPauseBanner.name}'s Turn — Your turn!`
                )
              : t(
                  `Vez de ${turnPauseBanner.name}`,
                  `${turnPauseBanner.name}'s Turn`
                )}
          </span>
          <span className="turn-transition-banner__shimmer" aria-hidden="true" />
        </div>
      )}

      {robberNotice && (
        <div
          className={cn(
            "game-robber-notice",
            `game-robber-notice--${robberNotice.tone}`
          )}
          role="status"
          aria-live="polite"
        >
          <span className="game-robber-notice__badge" aria-hidden="true">
            🥷 LADRÃO
          </span>
          <span className="game-robber-notice__text">
            {robberNotice.message}
          </span>
        </div>
      )}

      {gs.action_records && gs.action_records.length > 0 && (
        <aside
          className={cn("mini-action-log", {
            "mini-action-log--chat-open": chatOpen,
          })}
          aria-label={t("Últimas jogadas na mesa", "Recent table actions")}
        >
          {gs.action_records.slice(-3).map((rec, idx, arr) => {
            const c = rec[0]?.[0];
            const actionType = rec[0]?.[1];
            const isRobberRow =
              actionType === "MOVE_ROBBER" ||
              actionType === "PLAY_KNIGHT_CARD" ||
              actionType === "PLAY_MONOPOLY";
            const palette = c ? colorMeta[c] : null;
            const globalIdx = gs.action_records.length - arr.length + idx;
            return (
              <div
                key={globalIdx}
                className={cn("mini-action-log__row", {
                  "mini-action-log__row--robber": isRobberRow,
                })}
              >
                <span
                  className="mini-action-log__dot"
                  style={{
                    background: isRobberRow
                      ? "#f87171"
                      : palette?.primary || "#94a3b8",
                  }}
                />
                <span className="mini-action-log__text">
                  {isRollingDice && rec === latestActionRecord && rec[0][1] === "ROLL" ? "Rolando os dados…" : humanizeActionRecordPt(gs, rec, language)}
                </span>
              </div>
            );
          })}
        </aside>
      )}

      <MatchIntroOverlay
        open={introActive && !replayMode}
        gameState={gs}
        perspective={state.perspective}
        onDismiss={handleDismissIntro}
      />

      {!chatOpen && chatPreview && (
        <button
          type="button"
          className="game-chat-preview-toast"
          onClick={() => {
            setChatOpen(true);
            setUnreadChatCount(0);
            setChatPreview(null);
          }}
          style={{
            borderColor:
              colorMeta[chatPreview.color]?.primary || "#facc15",
          }}
        >
          <span
            className="game-chat-preview-toast__dot"
            style={{
              background:
                colorMeta[chatPreview.color]?.primary || "#facc15",
            }}
          />
          <span className="game-chat-preview-toast__sender">
            {chatPreview.sender_name}:
          </span>
          <span className="game-chat-preview-toast__body">
            {
              parseTauntMessage(
                chatPreview.body,
                chatPreview.kind,
                language
              ).displayText
            }
          </span>
        </button>
      )}

      <GameChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={chatMessages}
        mySeatColor={mySeatColor}
        replayMode={replayMode}
        isSending={isSendingChat}
        errorMessage={chatError}
        onSendMessage={handleSendChat}
      />

      <ActionsToolbar
        key={gameId}
        consoleRef={consoleRef}
        isBotThinking={isBotThinking}
        replayMode={replayMode}
        mySeatColor={mySeatColor}
        isRollingDice={isRollingDice}
        onSendChatMessage={handleSendChat}
      />
      <LeftDrawer />
      <RightDrawer>
        <AnalysisBox stateIndex={"latest"} />
        <Divider />
        <DiceHistogram gameState={gs} />
      </RightDrawer>

      <AlmanacModal
        open={almanacOpen}
        onClose={() => setAlmanacOpen(false)}
      />

      <Dialog
        open={abandonConfirmOpen}
        onClose={() => !isAbandoning && setAbandonConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ className: "catan-modal-paper" }}
      >
        <DialogTitle className="catan-modal-title">
          {t("🚪 Sair da Partida (Bot Assume)", "🚪 Leave Match (Bot Takes Over)")}
        </DialogTitle>
        <DialogContent className="catan-modal-content">
          {language === "en" ? (
            <p style={{ margin: 0, color: "#cbd5e1", lineHeight: 1.5 }}>
              Do you want to leave and let a Bot play in your place? Your color,
              pieces, and cards will be preserved, and you can click{" "}
              <strong>Reclaim My Seat</strong> if you return before the match
              ends.
            </p>
          ) : (
            <p style={{ margin: 0, color: "#cbd5e1", lineHeight: 1.5 }}>
              Deseja sair e deixar um Bot jogar no seu lugar? Sua cor, peças e
              cartas serão preservadas e você poderá clicar em{" "}
              <strong>Retomar Meu Assento</strong> caso volte antes do fim da
              partida.
            </p>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setAbandonConfirmOpen(false)}
            disabled={isAbandoning}
            sx={{ color: "#cbd5e1", textTransform: "none" }}
          >
            {t("Continuar Jogando", "Keep Playing")}
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleConfirmAbandon}
            disabled={isAbandoning}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            {isAbandoning
              ? t("Saindo...", "Leaving...")
              : t("Confirmar Saída", "Confirm Leave")}
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
