import cn from "classnames";
import { PLAYER_COLOR_META } from "../config/assetRegistry";
import {
  getGuestProfile,
  getSavedAccountAvatarSummary,
} from "../config/avatarCatalog";
import {
  isTakenOverSeat,
  resolvePlayerDisplayName,
  resolveSeatAvatarProps,
} from "../config/botCatalog";
import type { Color, GameState } from "../utils/api.types";
import { INTRO_SPLASH_MS } from "../utils/tabletopPacing";
import PlayerAvatar from "./PlayerAvatar";
import "./MatchIntroOverlay.scss";

export type MatchIntroOverlayProps = {
  open: boolean;
  gameState: GameState;
  perspective: Color | null;
  onDismiss: () => void;
};

export default function MatchIntroOverlay({
  open,
  gameState,
  perspective,
  onDismiss,
}: MatchIntroOverlayProps) {
  if (!open) return null;

  const savedAcct = getSavedAccountAvatarSummary();
  const guestProfile = !savedAcct ? getGuestProfile() : null;
  const humanColors = gameState.colors.filter(
    (c) => !gameState.bot_colors.includes(c)
  );
  const vpsToWin = gameState.game?.vps_to_win ?? 10;

  return (
    <div
      className="match-intro-overlay"
      role="dialog"
      aria-modal="false"
      aria-label="Apresentação da partida: Boa Guerra"
      onClick={onDismiss}
    >
      <div
        className="match-intro-overlay__card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="match-intro-overlay__crest" aria-hidden="true">
          ⚔️⛵⚔️
        </div>
        <h2 className="match-intro-overlay__title">Boa Guerra</h2>
        <p className="match-intro-overlay__subtitle">
          Rule the Isle • Meta: <strong>{vpsToWin} Pontos de Vitória</strong>
        </p>

        <div className="match-intro-overlay__seats">
          {gameState.colors.map((color, idx) => {
            const meta = PLAYER_COLOR_META[color];
            const isBot = gameState.bot_colors.includes(color);
            const isTakenOver = isTakenOverSeat(gameState, color);
            const name = resolvePlayerDisplayName(gameState, color, meta.label);
            const seatAvatar = gameState.seat_avatars?.[color];
            const originalUsername =
              gameState.seat_takeover?.[color]?.original_username ??
              seatAvatar?.username ??
              null;
            const isMySeat =
              (!isBot || isTakenOver) &&
              (perspective !== null
                ? perspective === color
                : savedAcct
                  ? (seatAvatar?.seat_kind === "USER" &&
                      seatAvatar.username === savedAcct.username) ||
                    originalUsername === savedAcct.username
                  : !isBot && humanColors.length === 1);
            const resolved = resolveSeatAvatarProps({
              color,
              isBot,
              isTakenOver,
              seatIndex: idx,
              seatName: name,
              seatAvatar,
              originalUsername,
              isMySeat,
              accountAvatar: savedAcct?.avatar_config,
              accountUsername: savedAcct?.username,
              guestCustomAvatar: guestProfile?.customized
                ? guestProfile.avatar_config
                : undefined,
            });
            const isStarter = gameState.current_color === color;

            return (
              <div
                key={color}
                className={cn("match-intro-overlay__seat", {
                  "is-starter": isStarter,
                  "is-me": isMySeat,
                })}
                style={{ "--seat-color": meta.primary } as React.CSSProperties}
              >
                <div className="match-intro-overlay__avatar">
                  <PlayerAvatar
                    config={resolved.config}
                    username={resolved.username}
                    size={54}
                  />
                </div>
                <span className="match-intro-overlay__seat-name">{name}</span>
                <span className="match-intro-overlay__seat-tag">
                  {isStarter ? "🎲 Inicia" : meta.label}
                </span>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="match-intro-overlay__cta"
          onClick={onDismiss}
        >
          Zarpar para a Ilha
        </button>

        <div
          className="match-intro-overlay__timer-track"
          aria-hidden="true"
          style={{ "--intro-ms": `${INTRO_SPLASH_MS}ms` } as React.CSSProperties}
        >
          <div className="match-intro-overlay__timer-bar" />
        </div>
      </div>
    </div>
  );
}
