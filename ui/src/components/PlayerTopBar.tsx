import React, { useContext, useState } from "react";
import { Button, Dialog, DialogContent, DialogTitle } from "@mui/material";
import cn from "classnames";

import "./PlayerTopBar.scss";
import type { Color, GameState } from "../utils/api.types";
import { PLAYER_COLOR_META } from "../config/assetRegistry";
import {
  getGuestProfile,
  getSavedAccountAvatarSummary,
} from "../config/avatarCatalog";
import {
  resolvePlayerDisplayName,
  resolveSeatAvatarProps,
} from "../config/botCatalog";
import { store } from "../store";
import { playerKey } from "../utils/stateUtils";
import { HybridIllustration } from "./icons/GameIcons";
import PlayerAvatar from "./PlayerAvatar";

/* -------------------------------------------------------------------------- */
/* Crisp Catan Universe Style Vector Stat Icons                               */
/* -------------------------------------------------------------------------- */

export const SwordStatSvg: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="currentColor"
    aria-hidden="true"
    className="cu-icon"
  >
    {/* Upright medieval sword */}
    <path d="M11 2h2v13h-2z" />
    <polygon points="12,0.5 9.5,3.5 14.5,3.5" />
    <rect x="6.5" y="14" width="11" height="2" rx="0.5" />
    <rect x="11" y="16" width="2" height="4.5" rx="0.5" />
    <circle cx="12" cy="21.5" r="1.5" />
  </svg>
);

export const RoadStatSvg: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="cu-icon"
  >
    {/* S-curve road segment matching Catan Universe */}
    <path d="M7 4 C 7 10, 17 8, 17 14 C 17 18, 12 20, 10 21" />
    <circle cx="7" cy="4" r="1" fill="currentColor" stroke="none" />
    <circle cx="10" cy="21" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const ResourceStatSvg: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="currentColor"
    aria-hidden="true"
    className="cu-icon"
  >
    {/* Playing card outline with center resource seal */}
    <rect
      x="5"
      y="2.5"
      width="14"
      height="19"
      rx="2.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
    <circle cx="12" cy="12" r="3.2" />
  </svg>
);

export const DevCardStatSvg: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="currentColor"
    aria-hidden="true"
    className="cu-icon"
  >
    {/* Development card outline with star/bookmark seal */}
    <rect
      x="5"
      y="2.5"
      width="14"
      height="19"
      rx="2.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
    <polygon points="12,8 13.5,11.5 17,12 14.5,14.5 15,18 12,16.2 9,18 9.5,14.5 7,12 10.5,11.5" />
  </svg>
);

export const TrophyStatSvg: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="currentColor"
    aria-hidden="true"
    className="cu-icon cu-icon--trophy"
  >
    {/* Championship trophy cup */}
    <path d="M6 3h12v4.5c0 3.3-2.7 6-6 6s-6-2.7-6-6V3z" />
    <path
      d="M6 5H3.5C2.7 5 2 5.7 2 6.5c0 2.2 1.8 4 4 4.3V5zM18 5h2.5c.8 0 1.5.7 1.5 1.5 0 2.2-1.8 4-4 4.3V5z"
      fillOpacity="0.85"
    />
    <rect x="10.5" y="13.5" width="3" height="4" />
    <rect x="7" y="17.5" width="10" height="3" rx="1" />
  </svg>
);

const TurnSpinSvg: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 17.5-5.5L21.5 8M22 12.5a10 10 0 0 1-17.5 5.5L2.5 16" />
  </svg>
);

const MiniSettlementIcon: React.FC = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
    <path d="M8 2L2 7v7h12V7L8 2z" />
  </svg>
);

const MiniCityIcon: React.FC = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
    <path d="M2 14V6l3-3 3 3v2h2V4l2-2 2 2v10H2z" />
  </svg>
);

const MiniRoadIcon: React.FC = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
    <rect x="2" y="6.5" width="12" height="3" rx="1.2" transform="rotate(-24 8 8)" />
  </svg>
);

/* -------------------------------------------------------------------------- */
/* Individual Player Card                                                     */
/* -------------------------------------------------------------------------- */

type PlayerSeatStats = {
  color: Color;
  name: string;
  isBot: boolean;
  isActive: boolean;
  isWinner: boolean;
  vps: number;
  resources: number;
  devCards: number;
  knights: number;
  roadLength: number;
  hasArmy: boolean;
  hasRoad: boolean;
  settlementsLeft: number;
  citiesLeft: number;
  roadsLeft: number;
  builtSettlements: number;
  builtCities: number;
  builtRoads: number;
  resolvedAvatar: ReturnType<typeof resolveSeatAvatarProps>;
};

function computeSeatStats(
  gameState: GameState,
  color: Color,
  perspective: Color | null
): PlayerSeatStats {
  const key = playerKey(gameState, color);
  const ps = gameState.player_state;
  const meta = PLAYER_COLOR_META[color];
  const isBot = gameState.bot_colors.includes(color);
  const isActive = gameState.current_color === color;
  const isWinner = gameState.winning_color === color;
  const name = resolvePlayerDisplayName(gameState, color, meta.label);
  const seatIndex = Math.max(0, gameState.colors.indexOf(color));

  const vps = ps[`${key}_ACTUAL_VICTORY_POINTS`] ?? ps[`${key}_VICTORY_POINTS`] ?? 0;
  const resources = ps[`${key}_NUM_RESOURCES_IN_HAND`] ?? 0;
  const devCards = ps[`${key}_NUM_DEVELOPMENT_CARDS_IN_HAND`] ?? 0;
  const knights = ps[`${key}_PLAYED_KNIGHT`] ?? 0;
  const roadLength = ps[`${key}_LONGEST_ROAD_LENGTH`] ?? 0;
  const hasArmy = Boolean(ps[`${key}_HAS_ARMY`]);
  const hasRoad = Boolean(ps[`${key}_HAS_ROAD`]);

  const settlementsLeft = ps[`${key}_SETTLEMENTS_AVAILABLE`] ?? 5;
  const citiesLeft = ps[`${key}_CITIES_AVAILABLE`] ?? 4;
  const roadsLeft = ps[`${key}_ROADS_AVAILABLE`] ?? 15;
  const builtSettlements = Math.max(0, 5 - settlementsLeft);
  const builtCities = Math.max(0, 4 - citiesLeft);
  const builtRoads = Math.max(0, 15 - roadsLeft);

  const seatAvatar = gameState.seat_avatars?.[color];
  const savedAcct = getSavedAccountAvatarSummary();
  const guestProfile = !savedAcct ? getGuestProfile() : null;
  const humanColors = gameState.colors.filter(
    (c) => !gameState.bot_colors.includes(c)
  );
  const isMySeat =
    !isBot &&
    (perspective !== null
      ? perspective === color
      : savedAcct
        ? seatAvatar?.seat_kind === "USER" &&
          seatAvatar.username === savedAcct.username
        : humanColors.length === 1);
  const resolvedAvatar = resolveSeatAvatarProps({
    color,
    isBot,
    seatIndex,
    seatName: name,
    seatAvatar,
    isMySeat,
    accountAvatar: savedAcct?.avatar_config,
    accountUsername: savedAcct?.username,
    guestCustomAvatar: guestProfile?.customized
      ? guestProfile.avatar_config
      : undefined,
  });

  return {
    color,
    name,
    isBot,
    isActive,
    isWinner,
    vps,
    resources,
    devCards,
    knights,
    roadLength,
    hasArmy,
    hasRoad,
    settlementsLeft,
    citiesLeft,
    roadsLeft,
    builtSettlements,
    builtCities,
    builtRoads,
    resolvedAvatar,
  };
}

function PlayerCard({
  seat,
  isInspected,
  onInspect,
}: {
  seat: PlayerSeatStats;
  isInspected: boolean;
  onInspect: (color: Color) => void;
}) {
  const meta = PLAYER_COLOR_META[seat.color];

  return (
    <div
      className={cn("cu-player-card", seat.color, {
        "cu-player-card--active": seat.isActive,
        "cu-player-card--winner": seat.isWinner,
      })}
      style={
        {
          "--cu-color": meta.primary,
          "--cu-secondary": meta.secondary,
          "--cu-glow": meta.glow,
        } as React.CSSProperties
      }
      onClick={() => onInspect(seat.color)}
      title={`${seat.name} • Peças: ${seat.builtSettlements}/5 Aldeias, ${seat.builtCities}/4 Cidades, ${seat.builtRoads}/15 Estradas`}
    >
      <button
        type="button"
        className="cu-player-card__inspect-trigger"
        aria-label={`Inspecionar ${seat.name}`}
        aria-expanded={isInspected}
        onClick={(e) => {
          e.stopPropagation();
          onInspect(seat.color);
        }}
      />

      {/* LEFT HALF: Player Portrait & Name on Solid Color */}
      <div className="cu-player-card__portrait-col">
        <div className="cu-player-card__name-bar">
          {seat.isActive && (
            <span
              className="cu-player-card__turn-badge"
              title="Jogador Ativo — É a vez deste jogador!"
            >
              <TurnSpinSvg />
            </span>
          )}
          <span className="cu-player-card__name" title={seat.name}>
            {seat.name}
          </span>
        </div>
        <div
          className={cn("cu-player-card__avatar-wrap", {
            "cu-player-card__avatar-wrap--custom":
              seat.resolvedAvatar.isCustomUserOrGuest,
          })}
        >
          <PlayerAvatar
            config={seat.resolvedAvatar.config}
            username={seat.resolvedAvatar.username}
            size={58}
            className="cu-player-card__custom-avatar"
          />
        </div>
      </div>

      {/* RIGHT HALF: Crisp 2x3 Stat Grid on Dark Slate */}
      <div className="cu-player-card__stats-col">
        {/* Row 1: Knights & Longest Road */}
        <div className="cu-stat-row cu-stat-row--awards">
          <div
            className={cn("cu-stat", { "cu-stat--awarded": seat.hasArmy })}
            title={
              seat.hasArmy ? "Maior Exército (+2 PV)" : "Cavaleiros Jogados"
            }
          >
            <span className="cu-stat__num">{seat.knights}</span>
            {seat.hasArmy ? (
              <span className="cu-stat__medallion">
                <HybridIllustration
                  src="/assets/illustrations/ui/largest_army.webp"
                  alt="Maior Exército"
                  fallback={<SwordStatSvg />}
                />
              </span>
            ) : (
              <SwordStatSvg />
            )}
          </div>
          <div
            className={cn("cu-stat", { "cu-stat--awarded": seat.hasRoad })}
            title={
              seat.hasRoad ? "Maior Estrada (+2 PV)" : "Sequência de Estrada"
            }
          >
            <span className="cu-stat__num">{seat.roadLength}</span>
            {seat.hasRoad ? (
              <span className="cu-stat__medallion">
                <HybridIllustration
                  src="/assets/illustrations/ui/longest_road.webp"
                  alt="Maior Estrada"
                  fallback={<RoadStatSvg />}
                />
              </span>
            ) : (
              <RoadStatSvg />
            )}
          </div>
        </div>

        {/* Row 2: Resources & Dev Cards */}
        <div className="cu-stat-row cu-stat-row--cards">
          <div
            className={cn("cu-stat cu-stat--resources", {
              "cu-stat--danger": seat.resources > 7,
            })}
            title={
              seat.resources > 7
                ? `Atenção: ${seat.resources} cartas! Perderá metade se rolar 7.`
                : "Cartas de Recurso na mão"
            }
          >
            <span className="cu-stat__num">{seat.resources}</span>
            <ResourceStatSvg />
          </div>
          <div
            className="cu-stat cu-stat--devcards"
            title="Cartas de Desenvolvimento na mão"
          >
            <span className="cu-stat__num">{seat.devCards}</span>
            <DevCardStatSvg />
          </div>
        </div>

        {/* Row 3: Victory Points + Built Pieces Summary */}
        <div className="cu-stat-row cu-stat-row--vp">
          <div className="cu-stat cu-stat--vp" title="Victory Points">
            <span className="cu-stat__num cu-stat__num--vp">{seat.vps}</span>
            <TrophyStatSvg />
          </div>

          {(seat.hasArmy || seat.hasRoad) && (
            <div className="cu-mobile-award-badges" aria-hidden="true">
              {seat.hasArmy && <span title="Maior Exército">⚔️</span>}
              {seat.hasRoad && <span title="Maior Estrada">🛤️</span>}
            </div>
          )}

          <div
            className="cu-pieces-mini"
            title={`Peças no mapa: ${seat.builtSettlements}/5 Aldeias · ${seat.builtCities}/4 Cidades · ${seat.builtRoads}/15 Estradas`}
          >
            <span
              className="cu-piece-chip"
              title={`${seat.builtSettlements} Aldeia(s) construída(s) (${seat.settlementsLeft} restante(s))`}
            >
              <MiniSettlementIcon />
              <span>{seat.builtSettlements}</span>
            </span>
            <span
              className="cu-piece-chip"
              title={`${seat.builtCities} Cidade(s) construída(s) (${seat.citiesLeft} restante(s))`}
            >
              <MiniCityIcon />
              <span>{seat.builtCities}</span>
            </span>
            <span
              className="cu-piece-chip"
              title={`${seat.builtRoads} Estrada(s) construída(s) (${seat.roadsLeft} restante(s))`}
            >
              <MiniRoadIcon />
              <span>{seat.builtRoads}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main Bar Component & Tap-to-Inspect Dialog                                 */
/* -------------------------------------------------------------------------- */

export default function PlayerTopBar({ gameState }: { gameState: GameState }) {
  const { state } = useContext(store);
  const [inspectedColor, setInspectedColor] = useState<Color | null>(null);

  const seats = gameState.colors.map((color) =>
    computeSeatStats(gameState, color, state.perspective)
  );
  const inspectedSeat =
    seats.find((s) => s.color === inspectedColor) ?? null;

  return (
    <>
      <header className="cu-player-top-bar" aria-label="Jogadores">
        {seats.map((seat) => (
          <PlayerCard
            key={seat.color}
            seat={seat}
            isInspected={inspectedColor === seat.color}
            onInspect={setInspectedColor}
          />
        ))}
      </header>

      <Dialog
        open={Boolean(inspectedSeat)}
        onClose={() => setInspectedColor(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          className: "catan-modal-paper cu-player-inspect-paper",
        }}
      >
        {inspectedSeat && (
          <>
            <DialogTitle className="cu-player-inspect-header">
              <div className="cu-player-inspect-header__left">
                <PlayerAvatar
                  config={inspectedSeat.resolvedAvatar.config}
                  username={inspectedSeat.resolvedAvatar.username}
                  size={52}
                />
                <div className="cu-player-inspect-header__meta">
                  <strong>{inspectedSeat.name}</strong>
                  <div className="cu-player-inspect-header__tags">
                    <span
                      className="cu-inspect-tag"
                      style={{
                        borderColor: PLAYER_COLOR_META[inspectedSeat.color].primary,
                      }}
                    >
                      {PLAYER_COLOR_META[inspectedSeat.color].label}
                    </span>
                    <span className="cu-inspect-tag">
                      {inspectedSeat.isBot ? "Bot IA" : "Jogador"}
                    </span>
                    {inspectedSeat.isActive && (
                      <span className="cu-inspect-tag cu-inspect-tag--active">
                        Vez atual
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Button
                size="small"
                variant="outlined"
                className="cu-player-inspect-close"
                onClick={() => setInspectedColor(null)}
              >
                Fechar
              </Button>
            </DialogTitle>

            <DialogContent className="cu-player-inspect-body">
              <div className="cu-inspect-stats-grid">
                <div className="cu-inspect-stat-box cu-inspect-stat-box--vp">
                  <span>Pontos de Vitória</span>
                  <strong>🏆 {inspectedSeat.vps} PV</strong>
                </div>
                <div
                  className={cn("cu-inspect-stat-box", {
                    "cu-inspect-stat-box--warn": inspectedSeat.resources > 7,
                  })}
                >
                  <span>Cartas de Recurso</span>
                  <strong>🃏 {inspectedSeat.resources}</strong>
                </div>
                <div className="cu-inspect-stat-box">
                  <span>Cartas Dev</span>
                  <strong>📜 {inspectedSeat.devCards}</strong>
                </div>
                <div
                  className={cn("cu-inspect-stat-box", {
                    "cu-inspect-stat-box--award": inspectedSeat.hasArmy,
                  })}
                >
                  <span>Cavaleiros</span>
                  <strong>
                    ⚔️ {inspectedSeat.knights}
                    {inspectedSeat.hasArmy ? " • Maior Exército" : ""}
                  </strong>
                </div>
                <div
                  className={cn("cu-inspect-stat-box cu-inspect-stat-box--full", {
                    "cu-inspect-stat-box--award": inspectedSeat.hasRoad,
                  })}
                >
                  <span>Maior Estrada</span>
                  <strong>
                    🛤️ {inspectedSeat.roadLength} segmentos
                    {inspectedSeat.hasRoad ? " • +2 PV Ativo" : ""}
                  </strong>
                </div>
              </div>

              <div className="cu-inspect-pieces-card">
                <h4>Peças no Tabuleiro</h4>
                <div className="cu-inspect-pieces-row">
                  <div>
                    <small>Aldeias</small>
                    <strong>{inspectedSeat.builtSettlements}/5</strong>
                    <span>{inspectedSeat.settlementsLeft} rest.</span>
                  </div>
                  <div>
                    <small>Cidades</small>
                    <strong>{inspectedSeat.builtCities}/4</strong>
                    <span>{inspectedSeat.citiesLeft} rest.</span>
                  </div>
                  <div>
                    <small>Estradas</small>
                    <strong>{inspectedSeat.builtRoads}/15</strong>
                    <span>{inspectedSeat.roadsLeft} rest.</span>
                  </div>
                </div>
              </div>
            </DialogContent>
          </>
        )}
      </Dialog>
    </>
  );
}
