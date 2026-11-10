import React, {
  useState,
  useRef,
  useEffect,
  useContext,
  useCallback,
  useMemo,
} from "react";
import memoize from "fast-memoize";
import { Button, Dialog, DialogTitle, DialogContent } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import BuildIcon from "@mui/icons-material/Build";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import MenuItem from "@mui/material/MenuItem";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import Grow from "@mui/material/Grow";
import Paper from "@mui/material/Paper";
import Popper from "@mui/material/Popper";
import MenuList from "@mui/material/MenuList";
import SimCardIcon from "@mui/icons-material/SimCard";
import { useParams } from "react-router-dom";

import Hidden from "../components/Hidden";
import Prompt from "../components/Prompt";
import ResourceCards from "../components/ResourceCards";
import ResourceSelector from "../components/ResourceSelector";
import DiscardPlannerDialog from "../components/DiscardPlannerDialog";
import TradeModal from "../components/TradeModal";
import { DiceFaceSvg, ResourceIcon } from "../components/icons/GameIcons";
import { BUILDING_COSTS, RESOURCE_META } from "../config/assetRegistry";
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

function PlayButtons() {
  const { gameId } = useParams();
  if (!gameId) {
    console.error("Game ID is not found in URL parameters.");
    return null;
  }
  const { state, dispatch } = useContext(store);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const [resourceSelectorOpen, setResourceSelectorOpen] = useState(false);
  const [discardPlannerOpen, setDiscardPlannerOpen] = useState(false);
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [costsModalOpen, setCostsModalOpen] = useState(false);
  const { isSubmitting, submitDiscardBatch } = useDiscardBatchSubmission();

  const executeGameAction = useCallback(
    async (action?: GameAction) => {
      const nextState = await postAction(gameId, action);
      dispatch({ type: ACTIONS.SET_GAME_STATE, data: nextState });
      dispatchSnackbar(enqueueSnackbar, closeSnackbar, nextState);
    },
    [gameId, dispatch, enqueueSnackbar, closeSnackbar]
  );

  const carryOutAction = useCallback(
    memoize((action?: GameAction) => async () => {
      await executeGameAction(action);
    }),
    [executeGameAction]
  );

  const {
    gameState,
    isPlayingMonopoly,
    isPlayingYearOfPlenty,
    isRoadBuilding,
  } = state;
  if (gameState === null) {
    return null;
  }
  const key = playerKey(gameState, gameState.current_color);
  const isRoll =
    gameState.current_prompt === "PLAY_TURN" &&
    !gameState.player_state[`${key}_HAS_ROLLED`];
  const isDiscard = gameState.current_prompt === "DISCARD";
  const isMoveRobber = gameState.current_prompt === "MOVE_ROBBER";
  const isPlayingDevCard =
    isPlayingMonopoly || isPlayingYearOfPlenty || isRoadBuilding;
  const playableDevCardTypes = new Set(
    gameState.current_playable_actions
      .filter((action) => action[1].startsWith("PLAY"))
      .map((action) => action[1])
  );
  const humanColor = getHumanColor(gameState);
  const discardActionType =
    gameState.current_playable_actions.find(
      (action) => action[1] === "DISCARD_RESOURCE"
    )?.[1] ?? "DISCARD_RESOURCE";

  const setIsPlayingMonopoly = useCallback(() => {
    dispatch({ type: ACTIONS.SET_IS_PLAYING_MONOPOLY });
  }, [dispatch]);

  const getDiscardResourceCounts = useCallback(() => {
    return RESOURCE_ORDER.reduce(
      (counts, resource) => {
        const inHand = gameState.player_state[`${key}_${resource}_IN_HAND`];
        if (inHand > 0) {
          counts[resource] = inHand;
        }
        return counts;
      },
      {} as Partial<Record<ResourceCard, number>>
    );
  }, [gameState.player_state, key]);

  const getValidYearOfPlentyOptions = useCallback(() => {
    return gameState.current_playable_actions
      .filter((action) => action[1] === "PLAY_YEAR_OF_PLENTY")
      .map((action) => action[2]);
  }, [gameState.current_playable_actions]);

  const handleResourceSelection = useCallback(
    async (selectedResources: ResourceCard | ResourceCard[]) => {
      setResourceSelectorOpen(false);
      let nextGameState;
      let action: GameAction;
      if (isPlayingMonopoly) {
        action = [
          humanColor,
          "PLAY_MONOPOLY",
          selectedResources as ResourceCard,
        ];
        nextGameState = await postAction(gameId, action);
      } else if (isPlayingYearOfPlenty) {
        action = [
          humanColor,
          "PLAY_YEAR_OF_PLENTY",
          selectedResources as [ResourceCard] | [ResourceCard, ResourceCard],
        ];
        nextGameState = await postAction(gameId, action);
      } else {
        console.error("Invalid resource selector mode");
        return;
      }
      dispatch({ type: ACTIONS.SET_GAME_STATE, data: nextGameState });
      dispatchSnackbar(enqueueSnackbar, closeSnackbar, nextGameState);
    },
    [
      gameId,
      humanColor,
      dispatch,
      enqueueSnackbar,
      closeSnackbar,
      isPlayingMonopoly,
      isPlayingYearOfPlenty,
    ]
  );

  const handleOpenResourceSelector = useCallback(() => {
    setResourceSelectorOpen(true);
  }, []);

  const handleOpenDiscardPlanner = useCallback(() => {
    setDiscardPlannerOpen(true);
  }, []);

  const handleDiscardSelection = useCallback(
    async (resources: ResourceCard[]) => {
      setDiscardPlannerOpen(false);
      const nextGameState = await submitDiscardBatch({
        discardActionType,
        gameId,
        humanColor,
        resources,
      });
      dispatch({ type: ACTIONS.SET_GAME_STATE, data: nextGameState });
      dispatchSnackbar(enqueueSnackbar, closeSnackbar, nextGameState);
    },
    [
      discardActionType,
      gameId,
      humanColor,
      submitDiscardBatch,
      dispatch,
      enqueueSnackbar,
      closeSnackbar,
    ]
  );

  const setIsPlayingYearOfPlenty = useCallback(() => {
    dispatch({ type: ACTIONS.SET_IS_PLAYING_YEAR_OF_PLENTY });
  }, [dispatch]);

  const playRoadBuilding = useCallback(async () => {
    const action: GameAction = [humanColor, "PLAY_ROAD_BUILDING", null];
    const nextState = await postAction(gameId, action);
    dispatch({ type: ACTIONS.PLAY_ROAD_BUILDING });
    dispatch({ type: ACTIONS.SET_GAME_STATE, data: nextState });
    dispatchSnackbar(enqueueSnackbar, closeSnackbar, nextState);
  }, [gameId, dispatch, enqueueSnackbar, closeSnackbar, humanColor]);

  const playKnightCard = useCallback(async () => {
    const action: GameAction = [humanColor, "PLAY_KNIGHT_CARD", null];
    const nextState = await postAction(gameId, action);
    dispatch({ type: ACTIONS.SET_GAME_STATE, data: nextState });
    dispatchSnackbar(enqueueSnackbar, closeSnackbar, nextState);
  }, [gameId, dispatch, enqueueSnackbar, closeSnackbar, humanColor]);

  const useItems = [
    {
      label: "👑 Monopólio (Monopoly)",
      disabled: !playableDevCardTypes.has("PLAY_MONOPOLY"),
      onClick: setIsPlayingMonopoly,
    },
    {
      label: "🌾 Ano da Fartura (Year of Plenty)",
      disabled: !playableDevCardTypes.has("PLAY_YEAR_OF_PLENTY"),
      onClick: setIsPlayingYearOfPlenty,
    },
    {
      label: "🛤️ Construção de Estradas (2 grátis)",
      disabled: !playableDevCardTypes.has("PLAY_ROAD_BUILDING"),
      onClick: playRoadBuilding,
    },
    {
      label: "⚔️ Cavaleiro (Mover Ladrão)",
      disabled: !playableDevCardTypes.has("PLAY_KNIGHT_CARD"),
      onClick: playKnightCard,
    },
  ];

  const buildActionTypes = new Set(
    gameState.is_initial_build_phase
      ? []
      : gameState.current_playable_actions
          .filter(
            (action) =>
              action[1].startsWith("BUY") || action[1].startsWith("BUILD")
          )
          .map((a) => a[1])
  );

  const buyDevCard = useCallback(async () => {
    const action: GameAction = [humanColor, "BUY_DEVELOPMENT_CARD", null];
    const nextState = await postAction(gameId, action);
    dispatch({ type: ACTIONS.SET_GAME_STATE, data: nextState });
    dispatchSnackbar(enqueueSnackbar, closeSnackbar, nextState);
  }, [gameId, dispatch, enqueueSnackbar, closeSnackbar, humanColor]);

  const setIsBuildingSettlement = useCallback(() => {
    dispatch({ type: ACTIONS.SET_IS_BUILDING_SETTLEMENT });
  }, [dispatch]);

  const setIsBuildingCity = useCallback(() => {
    dispatch({ type: ACTIONS.SET_IS_BUILDING_CITY });
  }, [dispatch]);

  const toggleBuildingRoad = useCallback(() => {
    dispatch({ type: ACTIONS.TOGGLE_BUILDING_ROAD });
  }, [dispatch]);

  const buildItems = [
    {
      label: "🛤️ Estrada (1 Madeira + 1 Argila)",
      disabled: !buildActionTypes.has("BUILD_ROAD"),
      onClick: toggleBuildingRoad,
    },
    {
      label: "🏠 Aldeia (1 Mad + 1 Arg + 1 Lã + 1 Tri)",
      disabled: !buildActionTypes.has("BUILD_SETTLEMENT"),
      onClick: setIsBuildingSettlement,
    },
    {
      label: "🏰 Cidade (2 Trigos + 3 Minérios)",
      disabled: !buildActionTypes.has("BUILD_CITY"),
      onClick: setIsBuildingCity,
    },
    {
      label: "🃏 Carta de Desenv. (1 Lã + 1 Tri + 1 Min)",
      disabled: !buildActionTypes.has("BUY_DEVELOPMENT_CARD"),
      onClick: buyDevCard,
    },
  ];

  const tradeActions = useMemo(
    () =>
      gameState.current_playable_actions.filter(
        (action): action is MaritimeTradeAction =>
          action[1] === "MARITIME_TRADE"
      ),
    [gameState.current_playable_actions]
  );

  const setIsMovingRobber = useCallback(() => {
    dispatch({ type: ACTIONS.SET_IS_MOVING_ROBBER });
  }, [dispatch]);

  const rollAction = carryOutAction([humanColor, "ROLL", null]);
  const endTurnAction = carryOutAction([humanColor, "END_TURN", null]);

  return (
    <>
      <Button
        variant="outlined"
        className="hud-btn hud-btn--ghost"
        onClick={() => setCostsModalOpen(true)}
        title="Tabela de Custos de Construção"
      >
        <MenuBookIcon fontSize="small" />
        <span>Custos</span>
      </Button>

      <OptionsButton
        disabled={playableDevCardTypes.size === 0 || isPlayingDevCard}
        menuListId="use-menu-list"
        icon={<SimCardIcon />}
        items={useItems}
      >
        Use
      </OptionsButton>

      <OptionsButton
        disabled={buildActionTypes.size === 0 || isPlayingDevCard}
        menuListId="build-menu-list"
        icon={<BuildIcon />}
        items={buildItems}
      >
        Buy
      </OptionsButton>

      <Button
        disabled={tradeActions.length === 0 || isPlayingDevCard}
        variant="contained"
        color="secondary"
        className="hud-btn"
        startIcon={<AccountBalanceIcon />}
        onClick={() => setTradeModalOpen(true)}
      >
        Trade
      </Button>

      <Button
        disabled={
          gameState.is_initial_build_phase || isRoadBuilding || isSubmitting
        }
        variant="contained"
        color="primary"
        className="hud-btn hud-btn--cta"
        startIcon={<NavigateNextIcon />}
        onClick={
          isDiscard
            ? handleOpenDiscardPlanner
            : isMoveRobber
              ? setIsMovingRobber
              : isPlayingYearOfPlenty || isPlayingMonopoly
                ? handleOpenResourceSelector
                : isRoll
                  ? rollAction
                  : endTurnAction
        }
      >
        {isDiscard
          ? "DISCARD"
          : isMoveRobber
            ? "ROB"
            : isPlayingYearOfPlenty || isPlayingMonopoly
              ? "SELECT"
              : isRoll
                ? "ROLL"
                : "END"}
      </Button>

      <TradeModal
        open={tradeModalOpen}
        onClose={() => setTradeModalOpen(false)}
        tradeActions={tradeActions}
        playerState={gameState.player_state}
        playerKey={key}
        onExecuteTrade={executeGameAction}
      />

      <Dialog
        open={costsModalOpen}
        onClose={() => setCostsModalOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ className: "catan-modal-paper" }}
      >
        <DialogTitle className="catan-modal-title">
          📋 Tabela de Custos de Construção
        </DialogTitle>
        <DialogContent className="catan-modal-content">
          <div className="costs-reference-list">
            {Object.entries(BUILDING_COSTS).map(([itemKey, info]) => (
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
                        title={`${qty}x ${RESOURCE_META[r].label}`}
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
    </>
  );
}

export default function ActionsToolbar({
  isBotThinking,
  replayMode,
}: {
  isBotThinking: boolean;
  replayMode: boolean;
}) {
  const { state, dispatch } = useContext(store);
  const { gameState } = state;
  if (gameState === null) {
    console.error("No gameState found...");
    return null;
  }
  const openLeftDrawer = useCallback(() => {
    dispatch({
      type: ACTIONS.SET_LEFT_DRAWER_OPENED,
      data: true,
    });
  }, [dispatch]);

  const openRightDrawer = useCallback(() => {
    dispatch({
      type: ACTIONS.SET_RIGHT_DRAWER_OPENED,
      data: true,
    });
  }, [dispatch]);

  const botsTurn = gameState.bot_colors.includes(gameState.current_color);
  const humanColor = getHumanColor(gameState);
  const latestDice = useMemo(() => getLatestRollPair(gameState), [gameState]);
  const diceSum = latestDice ? latestDice[0] + latestDice[1] : null;

  return (
    <div className="hud-bottom-dock">
      <div className="state-summary">
        <Hidden breakpoint={{ size: "md", direction: "up" }}>
          <Button className="open-drawer-btn" onClick={openLeftDrawer}>
            <ChevronLeftIcon />
          </Button>
        </Hidden>

        {humanColor && (
          <ResourceCards
            playerState={gameState.player_state}
            playerKey={playerKey(gameState, humanColor)}
          />
        )}

        {latestDice && (
          <div
            className="dice-widget-pill"
            title={`Última rolagem: ${latestDice[0]} + ${latestDice[1]} = ${diceSum}`}
          >
            <DiceFaceSvg
              value={latestDice[0]}
              size={28}
              isHot={diceSum === 6 || diceSum === 8}
            />
            <DiceFaceSvg
              value={latestDice[1]}
              size={28}
              isHot={diceSum === 6 || diceSum === 8}
            />
            <span className="dice-widget-pill__sum">= {diceSum}</span>
          </div>
        )}

        <Hidden breakpoint={{ size: "lg", direction: "up" }}>
          <Button
            className="open-drawer-btn"
            onClick={openRightDrawer}
            style={{ marginLeft: "auto" }}
          >
            <ChevronRightIcon />
          </Button>
        </Hidden>
      </div>

      <div className="actions-toolbar">
        {!(botsTurn || gameState.winning_color) && !replayMode && (
          <PlayButtons />
        )}
        {(botsTurn || gameState.winning_color) && (
          <Prompt gameState={gameState} isBotThinking={isBotThinking} />
        )}
      </div>
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
  icon: any;
  children: React.ReactNode;
  items: OptionItem[];
  disabled: boolean;
};

function OptionsButton({
  menuListId,
  icon,
  children,
  items,
  disabled,
}: OptionsButtonProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLAnchorElement>(null);

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
        href="#"
        aria-controls={open ? menuListId : undefined}
        aria-haspopup="true"
        variant="contained"
        color="secondary"
        className="hud-btn"
        startIcon={icon}
        onClick={handleToggle}
      >
        {children}
      </Button>
      <Popper
        className="action-popover"
        open={open}
        anchorEl={anchorRef.current}
        role={undefined}
        transition
        disablePortal
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
