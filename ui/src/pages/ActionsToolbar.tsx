import React, {
  useState,
  useRef,
  useEffect,
  useContext,
  useCallback,
  useMemo,
} from "react";
import cn from "classnames";
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  Tooltip,
} from "@mui/material";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import CasinoIcon from "@mui/icons-material/Casino";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import SimCardIcon from "@mui/icons-material/SimCard";
import GavelIcon from "@mui/icons-material/Gavel";
import PanToolAltIcon from "@mui/icons-material/PanToolAlt";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import MenuItem from "@mui/material/MenuItem";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import Grow from "@mui/material/Grow";
import Paper from "@mui/material/Paper";
import Popper from "@mui/material/Popper";
import MenuList from "@mui/material/MenuList";
import { Link, useParams } from "react-router-dom";

import Prompt from "../components/Prompt";
import ResourceCards from "../components/ResourceCards";
import ResourceSelector from "../components/ResourceSelector";
import DiscardPlannerDialog from "../components/DiscardPlannerDialog";
import TradeModal from "../components/TradeModal";
import TradeOfferDecisionDialog from "../components/TradeOfferDecisionDialog";
import Dice3D from "../components/Dice3D";
import {
  CitySvgPiece,
  ResourceIcon,
  RoadSvgPiece,
  SettlementSvgPiece,
} from "../components/icons/GameIcons";
import {
  getBuildingCosts,
  getDevCardMeta,
  getPlayerColorMeta,
  getResourceMeta,
} from "../config/assetRegistry";
import { useLanguage } from "../i18n";
import { store } from "../store";
import ACTIONS from "../actions";
import type {
  GameAction,
  GameState,
  MaritimeTradeAction,
  ResourceCard,
} from "../utils/api.types";
import { getHumanColor, playerKey } from "../utils/stateUtils";
import { postAction } from "../utils/apiClient";
import { useDiscardBatchSubmission } from "../hooks/useDiscardBatchSubmission";

import "./ActionsToolbar.scss";
import { useSnackbar } from "notistack";
import { dispatchSnackbar } from "../components/Snackbar";

const RESOURCE_ORDER: ResourceCard[] = [
  "WOOD",
  "BRICK",
  "SHEEP",
  "WHEAT",
  "ORE",
];

function getLatestRollPair(gameState: GameState): [number, number] | null {
  const records = gameState.action_records || [];
  for (let i = records.length - 1; i >= 0; i--) {
    const [action, result] = records[i];
    if (action[1] === "ROLL" && Array.isArray(result) && result.length === 2) {
      return [Number(result[0]), Number(result[1])];
    }
  }
  return null;
}

export default function ActionsToolbar({
  isBotThinking,
  replayMode,
  isRollingDice = false,
  onSendChatMessage,
}: {
  isBotThinking: boolean;
  replayMode: boolean;
  isRollingDice?: boolean;
  onSendChatMessage?: (body: string) => Promise<void> | void;
}) {
  const { gameId } = useParams();
  const { state, dispatch } = useContext(store);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { language, t } = useLanguage();
  const buildingCosts = getBuildingCosts(language);
  const devCardMeta = getDevCardMeta(language);
  const playerColorMeta = getPlayerColorMeta(language);
  const resourceMeta = getResourceMeta(language);

  const [resourceSelectorOpen, setResourceSelectorOpen] = useState(false);
  const [discardPlannerOpen, setDiscardPlannerOpen] = useState(false);
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [tradeDecisionMinimized, setTradeDecisionMinimized] = useState(false);
  const [costsModalOpen, setCostsModalOpen] = useState(false);
  const { isSubmitting, submitDiscardBatch } = useDiscardBatchSubmission();

  const {
    gameState,
    isBuildingRoad,
    isBuildingSettlement,
    isBuildingCity,
    isPlayingMonopoly,
    isPlayingYearOfPlenty,
    isRoadBuilding,
  } = state;

  if (!gameState) {
    return null;
  }

  const resolvedGameId = gameId ?? gameState.game?.id ?? "";
  const botsTurn = gameState.bot_colors.includes(gameState.current_color);
  const isOtherHumansTurn =
    !botsTurn &&
    state.perspective !== null &&
    gameState.current_color !== state.perspective;
  const isInteractiveTurn =
    !(botsTurn || isOtherHumansTurn || gameState.winning_color) && !replayMode;

  const humanColor = getHumanColor(gameState, state.perspective);
  const humanKey = humanColor ? playerKey(gameState, humanColor) : null;
  const activeKey = playerKey(gameState, gameState.current_color);

  const executeGameAction = useCallback(
    async (action?: GameAction) => {
      if (!resolvedGameId) return;
      const nextState = await postAction(resolvedGameId, action);
      dispatch({ type: ACTIONS.SET_GAME_STATE, data: nextState });
      dispatchSnackbar(enqueueSnackbar, closeSnackbar, nextState);
    },
    [resolvedGameId, dispatch, enqueueSnackbar, closeSnackbar]
  );

  const isRoll =
    gameState.current_prompt === "PLAY_TURN" &&
    !gameState.player_state[`${activeKey}_HAS_ROLLED`];
  const isDiscard = gameState.current_prompt === "DISCARD";
  const isMoveRobber = gameState.current_prompt === "MOVE_ROBBER";
  const isDecideTrade = gameState.current_prompt === "DECIDE_TRADE";
  const isDecideAcceptees = gameState.current_prompt === "DECIDE_ACCEPTEES";
  const isPlayingDevCard =
    isPlayingMonopoly || isPlayingYearOfPlenty || isRoadBuilding;

  useEffect(() => {
    setTradeDecisionMinimized(false);
  }, [gameState.state_index, gameState.current_prompt]);

  const playableDevCardTypes = useMemo(
    () =>
      new Set(
        gameState.current_playable_actions
          .filter((action) => action[1].startsWith("PLAY"))
          .map((action) => action[1])
      ),
    [gameState.current_playable_actions]
  );

  const buildActionTypes = useMemo(
    () =>
      new Set(
        gameState.is_initial_build_phase
          ? []
          : gameState.current_playable_actions
              .filter(
                (action) =>
                  action[1].startsWith("BUY") || action[1].startsWith("BUILD")
              )
              .map((a) => a[1])
      ),
    [gameState.is_initial_build_phase, gameState.current_playable_actions]
  );

  const tradeActions = useMemo(
    () =>
      gameState.current_playable_actions.filter(
        (action): action is MaritimeTradeAction =>
          action[1] === "MARITIME_TRADE"
      ),
    [gameState.current_playable_actions]
  );

  const discardActionType =
    gameState.current_playable_actions.find(
      (action) => action[1] === "DISCARD_RESOURCE"
    )?.[1] ?? "DISCARD_RESOURCE";

  const getDiscardResourceCounts = useCallback(() => {
    return RESOURCE_ORDER.reduce(
      (counts, resource) => {
        const inHand = gameState.player_state[`${activeKey}_${resource}_IN_HAND`];
        if (inHand > 0) {
          counts[resource] = inHand;
        }
        return counts;
      },
      {} as Partial<Record<ResourceCard, number>>
    );
  }, [gameState.player_state, activeKey]);

  const getValidYearOfPlentyOptions = useCallback(() => {
    return gameState.current_playable_actions
      .filter((action) => action[1] === "PLAY_YEAR_OF_PLENTY")
      .map((action) => action[2]);
  }, [gameState.current_playable_actions]);

  const handleResourceSelection = useCallback(
    async (selectedResources: ResourceCard | ResourceCard[]) => {
      setResourceSelectorOpen(false);
      let action: GameAction;
      if (isPlayingMonopoly) {
        action = [
          humanColor,
          "PLAY_MONOPOLY",
          selectedResources as ResourceCard,
        ];
      } else if (isPlayingYearOfPlenty) {
        action = [
          humanColor,
          "PLAY_YEAR_OF_PLENTY",
          selectedResources as [ResourceCard] | [ResourceCard, ResourceCard],
        ];
      } else {
        console.error("Invalid resource selector mode");
        return;
      }
      await executeGameAction(action);
    },
    [humanColor, isPlayingMonopoly, isPlayingYearOfPlenty, executeGameAction]
  );

  const handleDiscardSelection = useCallback(
    async (resources: ResourceCard[]) => {
      setDiscardPlannerOpen(false);
      const nextGameState = await submitDiscardBatch({
        discardActionType,
        gameId: resolvedGameId,
        humanColor,
        resources,
      });
      dispatch({ type: ACTIONS.SET_GAME_STATE, data: nextGameState });
      dispatchSnackbar(enqueueSnackbar, closeSnackbar, nextGameState);
    },
    [
      discardActionType,
      resolvedGameId,
      humanColor,
      submitDiscardBatch,
      dispatch,
      enqueueSnackbar,
      closeSnackbar,
    ]
  );

  const playRoadBuilding = useCallback(async () => {
    const nextState = await postAction(resolvedGameId, [
      humanColor,
      "PLAY_ROAD_BUILDING",
      null,
    ]);
    dispatch({ type: ACTIONS.PLAY_ROAD_BUILDING });
    dispatch({ type: ACTIONS.SET_GAME_STATE, data: nextState });
    dispatchSnackbar(enqueueSnackbar, closeSnackbar, nextState);
  }, [resolvedGameId, dispatch, enqueueSnackbar, closeSnackbar, humanColor]);

  const playKnightCard = useCallback(async () => {
    await executeGameAction([humanColor, "PLAY_KNIGHT_CARD", null]);
  }, [humanColor, executeGameAction]);

  const buyDevCard = useCallback(async () => {
    await executeGameAction([humanColor, "BUY_DEVELOPMENT_CARD", null]);
  }, [humanColor, executeGameAction]);

  const playableDevCallbacks = useMemo(() => {
    if (!isInteractiveTurn || isPlayingDevCard) return undefined;
    const map: Partial<
      Record<
        "KNIGHT" | "MONOPOLY" | "YEAR_OF_PLENTY" | "ROAD_BUILDING",
        () => void
      >
    > = {};
    if (playableDevCardTypes.has("PLAY_KNIGHT_CARD")) {
      map.KNIGHT = playKnightCard;
    }
    if (playableDevCardTypes.has("PLAY_MONOPOLY")) {
      map.MONOPOLY = () => dispatch({ type: ACTIONS.SET_IS_PLAYING_MONOPOLY });
    }
    if (playableDevCardTypes.has("PLAY_YEAR_OF_PLENTY")) {
      map.YEAR_OF_PLENTY = () =>
        dispatch({ type: ACTIONS.SET_IS_PLAYING_YEAR_OF_PLENTY });
    }
    if (playableDevCardTypes.has("PLAY_ROAD_BUILDING")) {
      map.ROAD_BUILDING = playRoadBuilding;
    }
    return map;
  }, [
    isInteractiveTurn,
    isPlayingDevCard,
    playableDevCardTypes,
    playKnightCard,
    playRoadBuilding,
    dispatch,
  ]);

  const useItems = [
    {
      label: `⚔️ ${devCardMeta.KNIGHT.label} (${t("Mover Ladrão", "Move Robber")})`,
      disabled: !playableDevCardTypes.has("PLAY_KNIGHT_CARD"),
      onClick: playKnightCard,
    },
    {
      label: `👑 ${devCardMeta.MONOPOLY.label}`,
      disabled: !playableDevCardTypes.has("PLAY_MONOPOLY"),
      onClick: () => dispatch({ type: ACTIONS.SET_IS_PLAYING_MONOPOLY }),
    },
    {
      label: `🌾 ${devCardMeta.YEAR_OF_PLENTY.label} (${t("+2 Recursos", "+2 Resources")})`,
      disabled: !playableDevCardTypes.has("PLAY_YEAR_OF_PLENTY"),
      onClick: () => dispatch({ type: ACTIONS.SET_IS_PLAYING_YEAR_OF_PLENTY }),
    },
    {
      label: `🛤️ ${devCardMeta.ROAD_BUILDING.label} (${t("2 grátis", "2 free")})`,
      disabled: !playableDevCardTypes.has("PLAY_ROAD_BUILDING"),
      onClick: playRoadBuilding,
    },
  ];

  // Stock & card totals for player's own seat
  const mySettlementsLeft = humanKey
    ? gameState.player_state[`${humanKey}_SETTLEMENTS_AVAILABLE`] ?? 5
    : 5;
  const myCitiesLeft = humanKey
    ? gameState.player_state[`${humanKey}_CITIES_AVAILABLE`] ?? 4
    : 4;
  const myRoadsLeft = humanKey
    ? gameState.player_state[`${humanKey}_ROADS_AVAILABLE`] ?? 15
    : 15;
  const myResourceTotal = humanKey
    ? RESOURCE_ORDER.reduce(
        (sum, r) =>
          sum + (gameState.player_state[`${humanKey}_${r}_IN_HAND`] ?? 0),
        0
      )
    : 0;
  const discardLimit = gameState.game?.discard_limit ?? 7;

  const latestDice = useMemo(() => getLatestRollPair(gameState), [gameState]);
  const diceSum = latestDice ? latestDice[0] + latestDice[1] : null;

  const hasRolled = Boolean(gameState.player_state[`${activeKey}_HAS_ROLLED`]);
  const canOfferDomesticTrade =
    isInteractiveTurn &&
    !gameState.is_initial_build_phase &&
    !isPlayingDevCard &&
    !gameState.is_resolving_trade &&
    gameState.current_prompt === "PLAY_TURN" &&
    hasRolled &&
    gameState.colors.length >= 2 &&
    myResourceTotal > 0;

  // Primary CTA orb state
  const ctaConfig = useMemo(() => {
    if (isDecideTrade) {
      return {
        label: t("RESPONDER", "RESPOND"),
        shortSub: t("Proposta", "Offer"),
        variant: "gold",
        icon: <AccountBalanceIcon />,
        onClick: () => setTradeDecisionMinimized(false),
      };
    }
    if (isDecideAcceptees) {
      return {
        label: t("CONFIRMAR", "CONFIRM"),
        shortSub: t("Fechar Troca", "Confirm Trade"),
        variant: "emerald",
        icon: <AccountBalanceIcon />,
        onClick: () => setTradeDecisionMinimized(false),
      };
    }
    if (isDiscard) {
      return {
        label: t("DESCARTAR", "DISCARD"),
        shortSub: t(
          `${gameState.current_discard_count} cartas`,
          `${gameState.current_discard_count} cards`
        ),
        variant: "danger",
        icon: <PanToolAltIcon />,
        onClick: () => setDiscardPlannerOpen(true),
      };
    }
    if (isMoveRobber) {
      return {
        label: t("ROUBAR", "ROB"),
        shortSub: t("Mover Ladrão", "Move Robber"),
        variant: "danger",
        icon: <GavelIcon />,
        onClick: () => dispatch({ type: ACTIONS.SET_IS_MOVING_ROBBER }),
      };
    }
    if (isPlayingYearOfPlenty || isPlayingMonopoly) {
      return {
        label: t("ESCOLHER", "CHOOSE"),
        shortSub: isPlayingMonopoly
          ? t("Monopólio", "Monopoly")
          : t("Fartura", "Plenty"),
        variant: "gold",
        icon: <AutoAwesomeIcon />,
        onClick: () => setResourceSelectorOpen(true),
      };
    }
    if (isRoll) {
      return {
        label: t("ROLAR DADOS", "ROLL DICE"),
        shortSub: t("Iniciar Turno", "Start Turn"),
        variant: "gold",
        icon: <CasinoIcon />,
        onClick: () => executeGameAction([humanColor, "ROLL", null]),
      };
    }
    return {
      label: t("PASSAR VEZ", "END TURN"),
      shortSub: t("Encerrar", "End Turn"),
      variant: "emerald",
      icon: <NavigateNextIcon />,
      onClick: () => executeGameAction([humanColor, "END_TURN", null]),
    };
  }, [
    isDecideTrade,
    isDecideAcceptees,
    isDiscard,
    isMoveRobber,
    isPlayingYearOfPlenty,
    isPlayingMonopoly,
    isRoll,
    gameState.current_discard_count,
    dispatch,
    executeGameAction,
    humanColor,
    t,
  ]);

  const activeBuildHint = isBuildingRoad
    ? t(
        "Clique em uma aresta iluminada para construir sua Estrada (ou clique no botão novamente para cancelar)",
        "Click a highlighted edge to build your Road (or click the button again to cancel)"
      )
    : isBuildingSettlement
      ? t(
          "Clique em um vértice iluminado para fundar sua Aldeia (ou clique no botão novamente para cancelar)",
          "Click a highlighted vertex to build your Settlement (or click the button again to cancel)"
        )
      : isBuildingCity
        ? t(
            "Clique em uma das suas Aldeias para evoluir para Cidade",
            "Click one of your Settlements to upgrade to a City"
          )
        : isRoadBuilding
          ? t(
              `Estrada Gratuita (${state.freeRoadsAvailable} restante${state.freeRoadsAvailable === 1 ? "" : "s"}): clique em uma aresta iluminada`,
              `Free Road (${state.freeRoadsAvailable} remaining): click a highlighted edge`
            )
          : null;

  const canRoad =
    isInteractiveTurn && !isPlayingDevCard && buildActionTypes.has("BUILD_ROAD");
  const canSettlement =
    isInteractiveTurn &&
    !isPlayingDevCard &&
    buildActionTypes.has("BUILD_SETTLEMENT");
  const canCity =
    isInteractiveTurn && !isPlayingDevCard && buildActionTypes.has("BUILD_CITY");
  const canBuyDev =
    isInteractiveTurn &&
    !isPlayingDevCard &&
    buildActionTypes.has("BUY_DEVELOPMENT_CARD");

  return (
    <div className="cu-console-wrapper">
      {activeBuildHint && (
        <div className="cu-build-hint-pill" role="status">
          ✨ {activeBuildHint}
        </div>
      )}

      <div className="cu-bottom-console">
        {/* LEFT ZONE: Quick Build & Tactical Actions (or Bot/Opponent status) */}
        <div className="cu-console__actions">
          {isInteractiveTurn ? (
            <>
              <div
                className="cu-build-strip"
                role="group"
                aria-label={t("Construções", "Builds")}
              >
                <Tooltip
                  title={t(
                    "Construir Estrada (1 Madeira + 1 Argila) — Maior Estrada (+2 PV)",
                    "Build Road (1 Lumber + 1 Brick) — Longest Road (+2 VP)"
                  )}
                  arrow
                  placement="top"
                >
                  <span>
                    <button
                      type="button"
                      className={cn("cu-build-tile", {
                        "is-selected": isBuildingRoad,
                      })}
                      style={
                        humanColor
                          ? ({
                              "--seat-color": playerColorMeta[humanColor].primary,
                            } as React.CSSProperties)
                          : undefined
                      }
                      disabled={!canRoad}
                      onClick={() =>
                        dispatch({ type: ACTIONS.TOGGLE_BUILDING_ROAD })
                      }
                    >
                      {humanColor ? (
                        <span className="cu-build-tile__road-svg" aria-hidden="true">
                          <RoadSvgPiece color={humanColor} />
                        </span>
                      ) : (
                        <span className="cu-build-tile__piece cu-build-tile__piece--road" />
                      )}
                      <span className="cu-build-tile__name">
                        {buildingCosts.ROAD.label}
                      </span>
                      <span className="cu-build-tile__stock">{myRoadsLeft}</span>
                    </button>
                  </span>
                </Tooltip>

                <Tooltip
                  title={t(
                    "Fundar Aldeia (1 Madeira + 1 Argila + 1 Lã + 1 Trigo) — +1 PV",
                    "Build Settlement (1 Lumber + 1 Brick + 1 Wool + 1 Grain) — +1 VP"
                  )}
                  arrow
                  placement="top"
                >
                  <span>
                    <button
                      type="button"
                      className={cn("cu-build-tile", {
                        "is-selected": isBuildingSettlement,
                      })}
                      disabled={!canSettlement}
                      onClick={() =>
                        dispatch({ type: ACTIONS.SET_IS_BUILDING_SETTLEMENT })
                      }
                    >
                      {humanColor && (
                        <svg width="22" height="22" viewBox="-24 -30 48 52" aria-hidden="true">
                          <SettlementSvgPiece color={humanColor} scale={0.95} />
                        </svg>
                      )}
                      <span className="cu-build-tile__name">
                        {buildingCosts.SETTLEMENT.label}
                      </span>
                      <span className="cu-build-tile__stock">{mySettlementsLeft}</span>
                    </button>
                  </span>
                </Tooltip>

                <Tooltip
                  title={t(
                    "Evoluir para Cidade (2 Trigos + 3 Minérios) — +2 PV & coleta em dobro",
                    "Upgrade to City (2 Grain + 3 Ore) — +2 VP & double yield"
                  )}
                  arrow
                  placement="top"
                >
                  <span>
                    <button
                      type="button"
                      className={cn("cu-build-tile", {
                        "is-selected": isBuildingCity,
                      })}
                      disabled={!canCity}
                      onClick={() =>
                        dispatch({ type: ACTIONS.SET_IS_BUILDING_CITY })
                      }
                    >
                      {humanColor && (
                        <svg width="22" height="22" viewBox="-24 -30 48 52" aria-hidden="true">
                          <CitySvgPiece color={humanColor} scale={0.88} />
                        </svg>
                      )}
                      <span className="cu-build-tile__name">
                        {buildingCosts.CITY.label}
                      </span>
                      <span className="cu-build-tile__stock">{myCitiesLeft}</span>
                    </button>
                  </span>
                </Tooltip>

                <Tooltip
                  title={t(
                    "Comprar Carta de Desenvolvimento (1 Lã + 1 Trigo + 1 Minério)",
                    "Buy Development Card (1 Wool + 1 Grain + 1 Ore)"
                  )}
                  arrow
                  placement="top"
                >
                  <span>
                    <button
                      type="button"
                      className="cu-build-tile"
                      disabled={!canBuyDev}
                      onClick={buyDevCard}
                    >
                      <span className="cu-build-tile__emoji" aria-hidden="true">
                        🃏
                      </span>
                      <span className="cu-build-tile__name">
                        {t("Carta Dev", "Dev Card")}
                      </span>
                      <span className="cu-build-tile__stock">+1</span>
                    </button>
                  </span>
                </Tooltip>
              </div>

              <div className="cu-tactical-strip">
                <Button
                  disabled={
                    (tradeActions.length === 0 && !canOfferDomesticTrade) ||
                    isPlayingDevCard ||
                    isDecideTrade ||
                    isDecideAcceptees
                  }
                  variant="contained"
                  color="secondary"
                  className="cu-tactical-btn"
                  startIcon={<AccountBalanceIcon fontSize="small" />}
                  onClick={() => setTradeModalOpen(true)}
                >
                  {t("Trocar", "Trade")}
                </Button>

                <OptionsButton
                  disabled={playableDevCardTypes.size === 0 || isPlayingDevCard}
                  menuListId="use-menu-list"
                  icon={<SimCardIcon fontSize="small" />}
                  badgeCount={playableDevCardTypes.size}
                  items={useItems}
                >
                  {t("Usar Carta", "Use Card")}
                </OptionsButton>

                <Tooltip
                  title={t(
                    "Tabela de Custos de Construção",
                    "Building Costs Guide"
                  )}
                  arrow
                  placement="top"
                >
                  <button
                    type="button"
                    className="cu-costs-icon-btn"
                    onClick={() => setCostsModalOpen(true)}
                    aria-label={t("Custos", "Costs")}
                  >
                    <MenuBookIcon fontSize="small" />
                    <span>{t("Custos", "Costs")}</span>
                  </button>
                </Tooltip>
              </div>
            </>
          ) : (
            <div className="cu-status-panel">
              <Prompt gameState={gameState} isBotThinking={isBotThinking} />
              {gameState.winning_color && (
                <Link to="/" className="cu-victory-lobby-btn">
                  {t("🔄 Nova Partida / Lobby", "🔄 New Match / Lobby")}
                </Link>
              )}
            </div>
          )}
        </div>

        {/* CENTER ZONE: Illustrated Hand Deck (Always visible in player perspective) */}
        {humanColor && (
          <div className="cu-console__hand">
            <ResourceCards
              playerState={gameState.player_state}
              playerKey={playerKey(gameState, humanColor)}
              showEmptySlots={true}
              interactiveDevCards={true}
              playableDevCallbacks={playableDevCallbacks}
            />
            <div
              className={cn("cu-hand-limit-pill", {
                "is-over-limit": myResourceTotal > discardLimit,
              })}
              title={t(
                `Total de cartas de recurso na mão: ${myResourceTotal}. Se tirar 7 nos dados acima de ${discardLimit}, descarta metade!`,
                `Total resource cards in hand: ${myResourceTotal}. If a 7 is rolled above ${discardLimit}, discard half!`
              )}
            >
              <span>{t("Mão", "Hand")}</span>
              <strong>
                {myResourceTotal}/{discardLimit}
              </strong>
            </div>
          </div>
        )}

        {/* RIGHT ZONE: 2D6 Dice + Circular Golden CTA Orb */}
        <div className="cu-console__cta-zone">
          {(isRollingDice || latestDice) && (() => {
            const shownPillDice: [number, number] = latestDice ?? [1, 6];
            const isHotDice =
              !isRollingDice && (diceSum === 6 || diceSum === 7 || diceSum === 8);
            return (
              <div
                className={cn("dice-widget-pill", {
                  "is-rolling": isRollingDice,
                })}
                title={
                  isRollingDice
                    ? t("Rolando dados...", "Rolling dice...")
                    : t(
                        `Última rolagem: ${latestDice![0]} + ${latestDice![1]} = ${diceSum}`,
                        `Last roll: ${latestDice![0]} + ${latestDice![1]} = ${diceSum}`
                      )
                }
              >
                <div className="dice-widget-pill__faces">
                  <Dice3D
                    value={shownPillDice[0]}
                    rolling={isRollingDice}
                    isHot={isHotDice}
                    size={24}
                    dieIndex={0}
                    variant="mini"
                  />
                  <Dice3D
                    value={shownPillDice[1]}
                    rolling={isRollingDice}
                    isHot={isHotDice}
                    size={24}
                    dieIndex={1}
                    variant="mini"
                  />
                </div>
                <span className="dice-widget-pill__sum">
                  {isRollingDice ? "..." : `Σ ${diceSum}`}
                </span>
              </div>
            );
          })()}

          {isInteractiveTurn && (
            <button
              type="button"
              disabled={
                gameState.is_initial_build_phase ||
                isRoadBuilding ||
                isSubmitting
              }
              onClick={ctaConfig.onClick}
              className={cn("cu-cta-orb", `cu-cta-orb--${ctaConfig.variant}`)}
              aria-label={ctaConfig.label}
              title={ctaConfig.label}
            >
              <span className="cu-cta-orb__icon" aria-hidden="true">
                {ctaConfig.icon}
              </span>
              <span className="cu-cta-orb__label">{ctaConfig.label}</span>
            </button>
          )}
        </div>
      </div>

      {/* Modals & Dialogs */}
      <TradeModal
        open={tradeModalOpen}
        onClose={() => setTradeModalOpen(false)}
        tradeActions={tradeActions}
        playerState={gameState.player_state}
        playerKey={activeKey}
        playerColor={humanColor ?? gameState.current_color}
        gameState={gameState}
        canOfferDomesticTrade={canOfferDomesticTrade}
        onExecuteTrade={executeGameAction}
      />

      <TradeOfferDecisionDialog
        open={
          isInteractiveTurn &&
          (isDecideTrade || isDecideAcceptees) &&
          !tradeDecisionMinimized
        }
        onMinimize={() => setTradeDecisionMinimized(true)}
        gameState={gameState}
        humanColor={humanColor ?? gameState.current_color}
        onExecuteAction={executeGameAction}
        onSendChatMessage={onSendChatMessage}
      />

      <Dialog
        open={costsModalOpen}
        onClose={() => setCostsModalOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ className: "catan-modal-paper" }}
      >
        <DialogTitle className="catan-modal-title">
          {t("📋 Tabela de Custos de Construção", "📋 Building Costs Guide")}
        </DialogTitle>
        <DialogContent className="catan-modal-content">
          <div className="costs-reference-list">
            {Object.entries(buildingCosts).map(([itemKey, info]) => (
              <div key={itemKey} className="costs-reference-row">
                <div className="costs-reference-row__title">
                  <strong>{info.label}</strong>
                  <small>{info.vps}</small>
                </div>
                <div className="costs-reference-row__recipe">
                  {Object.entries(info.recipe).map(([res, qty]) => {
                    const r = res as ResourceCard;
                    return (
                      <span
                        key={r}
                        className="costs-recipe-chip"
                        title={`${qty}× ${resourceMeta[r].label}`}
                      >
                        <ResourceIcon resource={r} size={16} />
                        <strong>×{qty}</strong>
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <ResourceSelector
        open={resourceSelectorOpen}
        onClose={() => {
          setResourceSelectorOpen(false);
          dispatch({ type: ACTIONS.CANCEL_MONOPOLY });
          dispatch({ type: ACTIONS.CANCEL_YEAR_OF_PLENTY });
        }}
        options={getValidYearOfPlentyOptions()}
        onSelect={handleResourceSelection}
        mode={isPlayingMonopoly ? "monopoly" : "yearOfPlenty"}
      />

      <DiscardPlannerDialog
        open={discardPlannerOpen}
        onClose={() => setDiscardPlannerOpen(false)}
        onConfirm={handleDiscardSelection}
        remainingDiscardCount={gameState.current_discard_count}
        discardResourceCounts={getDiscardResourceCounts()}
        submitting={isSubmitting}
      />
    </div>
  );
}

type OptionItem = {
  label: string;
  disabled: boolean;
  onClick: (event: MouseEvent | TouchEvent) => void;
};

type OptionsButtonProps = {
  menuListId: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  items: OptionItem[];
  disabled: boolean;
  badgeCount?: number;
};

function OptionsButton({
  menuListId,
  icon,
  children,
  items,
  disabled,
  badgeCount = 0,
}: OptionsButtonProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const handleToggle = () => {
    setOpen((prevOpen) => !prevOpen);
  };
  const handleClose =
    (onClick?: (event: MouseEvent | TouchEvent) => void) =>
    (event: MouseEvent | TouchEvent) => {
      if (
        anchorRef.current &&
        anchorRef.current.contains(event.target as Node)
      ) {
        return;
      }

      onClick && onClick(event);
      setOpen(false);
    };
  function handleListKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Tab") {
      event.preventDefault();
      setOpen(false);
    }
  }
  const prevOpen = useRef(open);
  useEffect(() => {
    if (prevOpen.current === true && open === false) {
      anchorRef.current && anchorRef.current.focus();
    }
    prevOpen.current = open;
  }, [open]);

  return (
    <React.Fragment>
      <Button
        disabled={disabled}
        ref={anchorRef}
        aria-controls={open ? menuListId : undefined}
        aria-haspopup="true"
        variant="contained"
        color="secondary"
        className="cu-tactical-btn"
        startIcon={icon}
        onClick={handleToggle}
      >
        {children}
        {badgeCount > 0 && !disabled && (
          <span className="cu-tactical-badge">{badgeCount}</span>
        )}
      </Button>
      <Popper
        className="action-popover"
        open={open}
        anchorEl={anchorRef.current}
        role={undefined}
        transition
        disablePortal
        placement="top-start"
      >
        {({ TransitionProps, placement }) => (
          <Grow
            {...TransitionProps}
            style={{
              transformOrigin:
                placement === "bottom" ? "center top" : "center bottom",
            }}
          >
            <Paper className="catan-menu-paper">
              <ClickAwayListener onClickAway={handleClose()}>
                <MenuList
                  autoFocusItem={open}
                  id={menuListId}
                  onKeyDown={handleListKeyDown}
                >
                  {items.map((item) => (
                    <MenuItem
                      key={item.label}
                      onClick={
                        handleClose(
                          item.onClick
                        ) as unknown as React.MouseEventHandler
                      }
                      disabled={item.disabled}
                    >
                      {item.label}
                    </MenuItem>
                  ))}
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Grow>
        )}
      </Popper>
    </React.Fragment>
  );
}
