export type Card = ResourceCard | DevelopmentCard | VictoryPointCard;
export type DevelopmentCard =
  | "KNIGHT"
  | "MONOPOLY"
  | "YEAR_OF_PLENTY"
  | "ROAD_BUILDING";

export type Color = "RED" | "BLUE" | "ORANGE" | "WHITE";
export type TileCoordinate = [number, number, number];

export type TradeOfferTuple = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];
export type ActiveTradeTuple = [...TradeOfferTuple, number];
export type ConfirmTradeTuple = [...TradeOfferTuple, Color];

export type GameActionRecord =
  | [RollGameAction, [number, number]]
  | [DiscardGameAction, ResourceCard]
  | [MoveRobberAction, ResourceCard | null]
  | [BuyDevelopmentCardAction, DevelopmentCard]
  | [BuildSettlementAction, null]
  | [BuildCityAction, null]
  | [BuildRoadAction, null]
  | [PlayKnightCardAction, null]
  | [PlayRoadBuildingAction, null]
  | [PlayMonopolyAction, null]
  | [PlayYearOfPlentyAction, null]
  | [MaritimeTradeAction, null]
  | [OfferTradeAction, null]
  | [AcceptTradeAction, null]
  | [RejectTradeAction, null]
  | [ConfirmTradeAction, null]
  | [CancelTradeAction, null]
  | [EndTurnAction, null];

export type RollGameAction = [Color, "ROLL", null];
export type DiscardGameAction = [Color, "DISCARD_RESOURCE", ResourceCard];
export type BuyDevelopmentCardAction = [Color, "BUY_DEVELOPMENT_CARD", null];
export type BuildSettlementAction = [Color, "BUILD_SETTLEMENT", number];
export type BuildCityAction = [Color, "BUILD_CITY", number];
export type BuildRoadAction = [Color, "BUILD_ROAD", [number, number]];
export type PlayKnightCardAction = [Color, "PLAY_KNIGHT_CARD", null];
export type PlayRoadBuildingAction = [Color, "PLAY_ROAD_BUILDING", null];
export type PlayMonopolyAction = [Color, "PLAY_MONOPOLY", ResourceCard];
export type PlayYearOfPlentyAction = [
  Color,
  "PLAY_YEAR_OF_PLENTY",
  [ResourceCard] | [ResourceCard, ResourceCard],
];
export type MoveRobberAction = [
  Color,
  "MOVE_ROBBER",
  [TileCoordinate, string?],
];
export type MaritimeTradeAction = [
  Color,
  "MARITIME_TRADE",
  (ResourceCard | null)[],
];
export type OfferTradeAction = [Color, "OFFER_TRADE", TradeOfferTuple];
export type AcceptTradeAction = [
  Color,
  "ACCEPT_TRADE",
  ActiveTradeTuple | TradeOfferTuple | number[],
];
export type RejectTradeAction = [
  Color,
  "REJECT_TRADE",
  ActiveTradeTuple | TradeOfferTuple | number[],
];
export type ConfirmTradeAction = [
  Color,
  "CONFIRM_TRADE",
  ConfirmTradeTuple | [...number[], Color],
];
export type CancelTradeAction = [Color, "CANCEL_TRADE", null];
export type EndTurnAction = [Color, "END_TURN", null];

export type GameAction =
  | RollGameAction
  | DiscardGameAction
  | BuyDevelopmentCardAction
  | BuildSettlementAction
  | BuildCityAction
  | BuildRoadAction
  | PlayKnightCardAction
  | PlayRoadBuildingAction
  | PlayMonopolyAction
  | PlayYearOfPlentyAction
  | MoveRobberAction
  | MaritimeTradeAction
  | OfferTradeAction
  | AcceptTradeAction
  | RejectTradeAction
  | ConfirmTradeAction
  | CancelTradeAction
  | EndTurnAction;

export type PlayerState = any;
export type VictoryPointCard = "VICTORY_POINT";
export type ResourceCard = "WOOD" | "BRICK" | "SHEEP" | "WHEAT" | "ORE";
export type Building = "SETTLEMENT" | "CITY";

type ResourceTile = {
  id: number;
  type: "RESOURCE_TILE";
  resource: ResourceCard;
  number: number;
};

type DesertTile = {
  id: number;
  type: "DESERT";
};

type WaterTile = {
  type: "WATER";
};

type PortTile = {
  id: number;
  type: "PORT";
  direction: Direction;
  resource: ResourceCard | null;
};

export type Tile = ResourceTile | DesertTile | WaterTile | PortTile;

export type PlacedTile = {
  coordinate: TileCoordinate;
  tile: Tile;
};

export type GameNode = {
  id: number;
  tile_coordinate: TileCoordinate;
  direction: Direction;
  building: Building | null;
  color: Color | null;
};

export type GameEdge = {
  id: [number, number];
  color: Color | null;
  direction: Direction;
  tile_coordinate: TileCoordinate;
};

export type AvatarSkin = "porcelain" | "fair" | "warm" | "tan" | "brown" | "deep";
export type AvatarEyes = "calm" | "cheerful" | "sharp" | "wise";
export type AvatarHair = "none" | "short" | "wavy" | "bun" | "braids" | "curly" | "long";
export type AvatarHairColor = "brown" | "black" | "blonde" | "red" | "silver" | "navy";
export type AvatarBeard = "none" | "goatee" | "full" | "mustache";
export type AvatarHat = "none" | "captain" | "explorer" | "bandana" | "helm" | "crown_gold";
export type AvatarOutfit = "settler" | "captain" | "armor" | "merchant";
export type AvatarOutfitColor = "crimson" | "royal" | "emerald" | "amber" | "slate";
export type AvatarBackground = "ocean" | "sunset" | "forest" | "mountain" | "gold" | "crimson";
export type AvatarFrame = "wood" | "bronze" | "silver" | "gold" | "imperial";

export type AvatarConfig = {
  skin: AvatarSkin;
  eyes: AvatarEyes;
  hair: AvatarHair;
  hairColor: AvatarHairColor;
  beard: AvatarBeard;
  hat: AvatarHat;
  outfit: AvatarOutfit;
  outfitColor: AvatarOutfitColor;
  background: AvatarBackground;
  frame: AvatarFrame;
};

export type SeatAvatarMeta = {
  seat_kind: "USER" | "GUEST" | "BOT";
  username: string | null;
  avatar_config?: Partial<AvatarConfig> | null;
};

export type RoomSeat = {
  color: Color;
  player_key: string;
  player_name: string;
  is_bot: boolean;
  claimed: boolean;
  is_me: boolean;
  seat_kind?: "USER" | "GUEST" | "BOT";
  username?: string | null;
  avatar_config?: Partial<AvatarConfig> | null;
};

export type BotDifficulty = "easy" | "medium" | "hard";
export type BotSpeed = "normal" | "fast" | "turbo";
export type DiceMode = "random" | "balanced";

export type RoomState = {
  room_code: string;
  status: "WAITING" | "IN_PROGRESS";
  game_id: string | null;
  is_host: boolean;
  my_color: Color | null;
  config: {
    map_template: "BASE" | "MINI" | "TOURNAMENT";
    vps_to_win: number;
    discard_limit: number;
    friendly_robber: boolean;
    bot_difficulty?: BotDifficulty;
    bot_speed?: BotSpeed;
    dice_mode?: DiceMode;
    created_at?: number;
  };
  seats: RoomSeat[];
};

export type SeatTakeoverInfo = {
  taken_over: boolean;
  reason: "ABANDONED" | "DISCONNECTED" | string | null;
  original_username?: string | null;
  original_display_name?: string | null;
};

export type GameState = {
  tiles: PlacedTile[];
  adjacent_tiles: Record<string, Tile[]>;
  bot_colors: Color[];
  colors: Color[];
  current_color: Color;
  winning_color: Color | null;
  current_prompt: string;
  player_state: Record<string, PlayerState>;
  action_records: GameActionRecord[];
  robber_coordinate: TileCoordinate;
  current_discard_count: number;
  nodes: Record<string, GameNode>;
  edges: GameEdge[];
  current_playable_actions: GameAction[];
  is_initial_build_phase: boolean;
  is_road_building?: boolean;
  is_resolving_trade?: boolean;
  current_trade?: number[];
  acceptees?: boolean[];
  longest_roads_by_player: Partial<Record<Color, number>>;
  edgeActions?: GameAction[];
  nodeActions?: GameAction[];
  state_index: number;
  seat_names?: Partial<Record<Color, string>>;
  seat_avatars?: Partial<Record<Color, SeatAvatarMeta>>;
  room_code?: string;
  bot_speed?: BotSpeed;
  taken_over_colors?: Color[];
  seat_takeover?: Partial<Record<Color, SeatTakeoverInfo>>;

  // Also present, from the state document itself.
  schema_version: number;
  game: {
    id: string;
    vps_to_win: number;
    discard_limit: number;
    friendly_robber: boolean;
    dice_mode?: DiceMode;
  };
  dice_deck_remaining?: number;
  num_turns: number;
  current_player_index: number;
  current_turn_index: number;
  resource_freqdeck: number[];
  development_listdeck: Record<string, number>;
};

const DIRECTIONS = [
  "NORTH",
  "NORTHEAST",
  "SOUTHEAST",
  "SOUTH",
  "SOUTHWEST",
  "NORTHWEST",
  "EAST",
  "WEST",
] as const;

export type Direction = (typeof DIRECTIONS)[number];

export type AccountStats = {
  wins: number;
  losses: number;
  games_played: number;
  win_rate: number;
};

export type LeaderboardEntry = {
  rank: number;
  username: string;
  display_name: string;
  avatar_config?: Partial<AvatarConfig>;
  wins: number;
  losses: number;
  games_played: number;
  win_rate: number;
};

export type MatchParticipant = {
  color: Color;
  seat_kind: "USER" | "GUEST" | "BOT";
  username: string | null;
  player_key: string;
  display_name: string;
  victory_points: number;
  is_winner: boolean;
};

export type MatchRecord = {
  game_id: string;
  room_code?: string | null;
  mode: "SOLO" | "MULTIPLAYER";
  map_template: string;
  vps_to_win: number;
  num_turns: number;
  winning_color: Color;
  winner_name: string;
  winner_username: string | null;
  winner_is_bot: boolean;
  finished_at: number;
  participants: MatchParticipant[];
};

export type GameMessageKind = "CHAT" | "TAUNT";

export type GameMessage = {
  id: number;
  game_id: string;
  color: Color;
  sender_name: string;
  kind: GameMessageKind;
  body: string;
  created_at: number;
};

