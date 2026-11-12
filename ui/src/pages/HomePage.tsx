import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@mui/material";
import {
  DEFAULT_PLAYERS,
  closeRoom,
  fetchCurrentAccount,
  getAuthConfig,
  getPlayers,
  getSavedAccount,
  leaveRoom,
  listActiveRooms,
  logoutAccount,
  saveGameRoomCode,
  type AuthConfig,
  type PlayerAccount,
  type PlayerEntry,
} from "../utils/apiClient";
import { saveGameSeat } from "../utils/seatStorage";
import type { Color, RoomState } from "../utils/api.types";
import {
  getFrameLabel,
  getGuestProfile,
  localizeGuestDisplayName,
  resolveAvatarConfig,
  type GuestProfile,
} from "../config/avatarCatalog";
import { useLanguage } from "../i18n";
import LanguageToggle from "../components/LanguageToggle";
import LeaderboardModal from "../components/LeaderboardModal";
import PlayerAvatar from "../components/PlayerAvatar";
import AvatarStudioModal from "../components/AvatarStudioModal";
import AlmanacModal from "../components/AlmanacModal";
import AuthModal from "../components/home/AuthModal";
import MatchSetupModal, {
  type MatchSetupMode,
} from "../components/home/MatchSetupModal";
import OpenLobbyModal from "../components/home/OpenLobbyModal";

import "./HomePage.scss";

const LazyAvatar3DCanvas = lazy(
  () => import("../components/avatar3d/Avatar3DCanvas")
);

export default function HomePage() {
  const { language, t } = useLanguage();
  const [available, setAvailable] = useState<PlayerEntry[]>(DEFAULT_PLAYERS);
  const [account, setAccount] = useState<PlayerAccount | null>(() =>
    getSavedAccount()
  );
  const [guestProfile, setGuestProfile] = useState<GuestProfile>(() =>
    getGuestProfile()
  );
  const [authConfig, setAuthConfig] = useState<AuthConfig>({
    google_enabled: false,
    google_client_id: null,
  });
  const [activeRooms, setActiveRooms] = useState<RoomState[]>([]);

  const [setupMode, setSetupMode] = useState<MatchSetupMode>(null);
  const [openLobbyOpen, setOpenLobbyOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [avatarStudioOpen, setAvatarStudioOpen] = useState(false);
  const [almanacOpen, setAlmanacOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authPromptBanner, setAuthPromptBanner] = useState<string | undefined>(
    undefined
  );

  const [hostName, setHostName] = useState(
    () =>
      getSavedAccount()?.display_name ||
      getGuestProfile().display_name ||
      localStorage.getItem("catan_player_name") ||
      "Anfitrião"
  );

  const navigate = useNavigate();

  const refreshRooms = useCallback(() => {
    listActiveRooms(account?.auth_token)
      .then(setActiveRooms)
      .catch(() => {});
  }, [account?.auth_token]);

  const handleCloseRoom = useCallback(
    async (roomCode: string) => {
      try {
        await closeRoom(roomCode);
      } catch (err: any) {
        if (err?.response?.status !== 404) {
          throw err;
        }
      }
      const clean = roomCode.trim().toUpperCase();
      setActiveRooms((prev) => prev.filter((r) => r.room_code !== clean));
      refreshRooms();
    },
    [refreshRooms]
  );

  const handleLeaveRoom = useCallback(
    async (roomCode: string) => {
      try {
        await leaveRoom(roomCode);
      } catch (err: any) {
        if (err?.response?.status !== 404) {
          throw err;
        }
      }
      refreshRooms();
    },
    [refreshRooms]
  );

  useEffect(() => {
    getPlayers()
      .then((list) => {
        if (list.length > 0) setAvailable(list);
      })
      .catch(() => setAvailable(DEFAULT_PLAYERS));

    getAuthConfig()
      .then(setAuthConfig)
      .catch(() => {});

    fetchCurrentAccount()
      .then((acc) => {
        if (acc) {
          setAccount(acc);
          setHostName(acc.display_name);
        } else {
          setAccount(null);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshRooms();
    const timer = setInterval(refreshRooms, 5000);
    return () => clearInterval(timer);
  }, [refreshRooms]);

  const handleLogout = async () => {
    setAvatarStudioOpen(false);
    await logoutAccount();
    setAccount(null);
    const gp = getGuestProfile();
    setGuestProfile(gp);
    setHostName(gp.display_name);
    refreshRooms();
  };

  const handleOpenAuth = (banner?: string) => {
    setAuthPromptBanner(banner);
    setAuthModalOpen(true);
  };

  const handleOpenAvatarStudio = () => {
    setAvatarStudioOpen(true);
  };

  const resolvedFrame = account
    ? resolveAvatarConfig(account.avatar_config, account.username).frame
    : "wood";
  const frameLabel = getFrameLabel(resolvedFrame, language);
  const displayGuestName = localizeGuestDisplayName(
    guestProfile.display_name,
    language
  );
  const effectiveDefaultHostName = account
    ? hostName
    : localizeGuestDisplayName(hostName, language);
  const effectiveHeroUsername = account ? account.username : displayGuestName;
  const activeHeroConfig = useMemo(
    () =>
      resolveAvatarConfig(
        account
          ? account.avatar_config
          : guestProfile.customized
            ? guestProfile.avatar_config
            : undefined,
        effectiveHeroUsername
      ),
    [account, guestProfile, effectiveHeroUsername]
  );

  return (
    <div className="home-page home-page--stage">
      {/* Cabeçalho Simétrico em 3 Colunas (A2) */}
      <header className="home-topbar">
        <div className="home-topbar__left">
          {account ? (
            <div className="home-identity-pill">
              <button
                type="button"
                className="home-identity-pill__avatar-btn"
                onClick={handleOpenAvatarStudio}
                title={t("Personalizar seu avatar", "Customize your avatar")}
              >
                <PlayerAvatar
                  config={account.avatar_config}
                  username={account.username}
                  size={56}
                />
              </button>
              <div className="home-identity-pill__meta">
                <strong>{account.display_name}</strong>
                <small>@{account.username}</small>
                <span className="home-identity-pill__frame">{frameLabel}</span>
              </div>
            </div>
          ) : (
            <div className="home-identity-pill home-identity-pill--guest">
              <button
                type="button"
                className="home-identity-pill__avatar-btn"
                onClick={handleOpenAvatarStudio}
                title={t(
                  "Personalizar avatar de visitante",
                  "Customize guest avatar"
                )}
              >
                <PlayerAvatar
                  config={
                    guestProfile.customized ? guestProfile.avatar_config : undefined
                  }
                  username={displayGuestName}
                  size={56}
                />
              </button>
              <div className="home-identity-pill__meta">
                <strong>{displayGuestName}</strong>
                <small>
                  {guestProfile.customized
                    ? t("Avatar personalizado (visitante)", "Custom avatar (guest)")
                    : t("Modo visitante", "Guest mode")}
                </small>
                <button
                  type="button"
                  className="home-identity-pill__inline-link"
                  onClick={() => handleOpenAuth()}
                >
                  {t("Entrar na conta →", "Sign in →")}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="home-topbar__center">
          <h1 className="logo">Rule the Isle</h1>
          <p className="home-hero-subtitle">
            {t(
              "Confrontos online entre amigos e offline com bots que não travam",
              "Online matches with friends & offline games with bots that never stall"
            )}
          </p>
        </div>

        <div className="home-topbar__right">
          {account ? (
            <div className="home-rank-pill">
              <div className="home-rank-pill__stats">
                <span className="home-rank-pill__rank">
                  🏆{" "}
                  {typeof account.leaderboard_rank === "number"
                    ? `#${account.leaderboard_rank} ${t("no Ranking", "Ranked")}`
                    : t("Ranking Ativo", "Ranked Active")}
                </span>
                <small>
                  {account.stats?.wins ?? 0}{" "}
                  {t(
                    (account.stats?.wins ?? 0) === 1 ? "vitória" : "vitórias",
                    (account.stats?.wins ?? 0) === 1 ? "win" : "wins"
                  )}{" "}
                  • {account.stats?.games_played ?? 0}{" "}
                  {t(
                    (account.stats?.games_played ?? 0) === 1
                      ? "partida"
                      : "partidas",
                    (account.stats?.games_played ?? 0) === 1 ? "match" : "matches"
                  )}{" "}
                  • {account.stats?.win_rate ?? 0}%
                </small>
              </div>
              <Button
                size="small"
                variant="outlined"
                className="home-logout-btn"
                onClick={handleLogout}
              >
                {t("Sair", "Sign Out")}
              </Button>
            </div>
          ) : (
            <div className="home-rank-pill home-rank-pill--guest">
              <div className="home-rank-pill__stats">
                <span className="home-rank-pill__rank">
                  🏆 {t("Ranking Global", "Global Ranking")}
                </span>
                <small>
                  {t(
                    "Salve vitórias e desbloqueie molduras",
                    "Save wins & unlock frames"
                  )}
                </small>
              </div>
              <Button
                size="small"
                variant="contained"
                className="home-login-cta-btn"
                onClick={() => handleOpenAuth()}
              >
                👤 {t("Entrar / Criar Conta", "Sign In / Sign Up")}
              </Button>
            </div>
          )}
          <LanguageToggle compact />
        </div>
      </header>

      {/* Palco Central com o Herói 3D de corpo inteiro sobre lobby_hero.webp */}
      <main className="home-stage-window">
        <div className="home-hero-stage" data-testid="home-hero-stage">
          <div className="home-hero-stage__canvas">
            <Suspense
              fallback={
                <div className="home-hero-stage__suspense" aria-hidden="true">
                  <PlayerAvatar
                    config={activeHeroConfig}
                    username={effectiveHeroUsername}
                    size={136}
                    testId="home-hero-stage-suspense"
                  />
                </div>
              }
            >
              <LazyAvatar3DCanvas
                config={activeHeroConfig}
                username={effectiveHeroUsername}
                mode="hero"
                backgroundMode="transparent"
                cameraFocus="full"
                interactive={true}
                fallbackSize={136}
                fallbackTestId="home-hero-stage-fallback"
              />
            </Suspense>
          </div>
          <div className="home-hero-stage__footer">
            <span
              className="home-hero-stage__orbit-hint"
              title={t(
                "Arraste para girar o herói em 360°",
                "Drag to rotate 3D hero"
              )}
            >
              ↻ 360°
            </span>
            <button
              type="button"
              className="home-hero-stage__studio-pill"
              onClick={handleOpenAvatarStudio}
            >
              ✨ {t("Estúdio 3D", "3D Studio")}
            </button>
          </div>
        </div>
      </main>

      {/* Doca Inferior Flutuante com os 5 Modos Dedicados + Rodapé Legal */}
      <section className="home-dock-wrap">
        <nav
          className="home-mode-dock"
          aria-label={t("Modos de jogo e perfil", "Game modes and profile")}
        >
          <Button
            variant="contained"
            className="home-dock-btn home-dock-btn--solo"
            onClick={() => setSetupMode("solo")}
          >
            ⚔️ {t("Partida Rápida (Solo/IA)", "Quick Match (Solo/AI)")}
          </Button>
          <Button
            variant="contained"
            className="home-dock-btn home-dock-btn--room"
            onClick={() => setSetupMode("room")}
          >
            🌐 {t("Criar Sala Online", "Create Online Room")}
          </Button>
          <Button
            variant="outlined"
            className="home-dock-btn home-dock-btn--lobby"
            onClick={() => {
              refreshRooms();
              setOpenLobbyOpen(true);
            }}
          >
            {activeRooms.length > 0
              ? t(
                  `🧭 Salas Abertas (${activeRooms.length})`,
                  `🧭 Open Lobbies (${activeRooms.length})`
                )
              : t("🧭 Salas Abertas", "🧭 Open Lobbies")}
          </Button>
          <Button
            variant="outlined"
            className="home-dock-btn home-dock-btn--ranking"
            onClick={() => setLeaderboardOpen(true)}
          >
            🏆 {t("Ranking & Histórico", "Ranking & History")}
          </Button>
          <Button
            variant="outlined"
            className="home-dock-btn home-dock-btn--avatar"
            onClick={handleOpenAvatarStudio}
          >
            🎨 {t("Personalizar Avatar", "Customize Avatar")}
          </Button>
          <Button
            variant="outlined"
            className="home-dock-btn home-dock-btn--almanac"
            onClick={() => setAlmanacOpen(true)}
          >
            📖 {t("Almanaque", "Almanac")}
          </Button>
        </nav>

        <footer className="home-page__legal-footer">
          <strong>Rule the Isle</strong> •{" "}
          {t(
            "Versão modificada em português baseada no motor",
            "Localized edition powered by the"
          )}{" "}
          <a
            href="https://github.com/bcollazo/catanatron"
            target="_blank"
            rel="noreferrer"
          >
            Catanatron
          </a>{" "}
          {t(
            "(Bryan Collazo) • Licença GNU GPL-3.0",
            "engine (Bryan Collazo) • GNU GPL-3.0 License"
          )}
        </footer>
      </section>

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        authConfig={authConfig}
        promptBanner={authPromptBanner}
        onAuthenticated={(logged) => {
          setAccount(logged);
          setHostName(logged.display_name);
          refreshRooms();
        }}
      />

      <MatchSetupModal
        mode={setupMode}
        onClose={() => setSetupMode(null)}
        availablePlayers={available}
        defaultHostName={effectiveDefaultHostName}
        account={account}
        onGameCreated={(gameId) => {
          setSetupMode(null);
          navigate("/games/" + gameId);
        }}
        onRoomCreated={(roomCode) => {
          setSetupMode(null);
          navigate(`/rooms/${roomCode}`);
        }}
      />

      <OpenLobbyModal
        open={openLobbyOpen}
        onClose={() => setOpenLobbyOpen(false)}
        rooms={activeRooms}
        onJoinRoom={(roomCode) => {
          setOpenLobbyOpen(false);
          navigate(`/rooms/${roomCode}`);
        }}
        onOpenMatch={(gameId: string, myColor: Color | null) => {
          setOpenLobbyOpen(false);
          saveGameSeat(gameId, myColor);
          const matchedRoom = activeRooms.find((r) => r.game_id === gameId);
          if (matchedRoom?.room_code) {
            saveGameRoomCode(gameId, matchedRoom.room_code);
          }
          const q = myColor ? `?seat=${myColor}` : "";
          navigate(`/games/${gameId}${q}`);
        }}
        onCreateRoomClick={() => {
          setOpenLobbyOpen(false);
          setSetupMode("room");
        }}
        onRefresh={refreshRooms}
        onCloseRoom={handleCloseRoom}
        onLeaveRoom={handleLeaveRoom}
      />

      <LeaderboardModal
        open={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
        currentUsername={account?.username}
      />

      <AvatarStudioModal
        open={avatarStudioOpen}
        onClose={() => setAvatarStudioOpen(false)}
        account={account}
        guestProfile={guestProfile}
        onSaved={(updated) => {
          setAccount((prev) =>
            prev
              ? {
                  ...prev,
                  ...updated,
                  leaderboard_rank:
                    updated.leaderboard_rank ?? prev.leaderboard_rank ?? null,
                }
              : updated
          );
          setHostName(updated.display_name);
          refreshRooms();
        }}
        onGuestSaved={(saved) => {
          setGuestProfile(saved);
          setHostName(saved.display_name);
        }}
      />

      <AlmanacModal
        open={almanacOpen}
        onClose={() => setAlmanacOpen(false)}
      />
    </div>
  );
}
