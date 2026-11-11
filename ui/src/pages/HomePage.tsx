import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@mui/material";
import {
  DEFAULT_PLAYERS,
  fetchCurrentAccount,
  getAuthConfig,
  getPlayers,
  getSavedAccount,
  listActiveRooms,
  logoutAccount,
  saveGameRoomCode,
  type AuthConfig,
  type PlayerAccount,
  type PlayerEntry,
} from "../utils/apiClient";
import { saveGameSeat } from "./RoomLobbyPage";
import type { Color, RoomState } from "../utils/api.types";
import {
  AVATAR_FRAME_OPTIONS,
  getGuestProfile,
  resolveAvatarConfig,
  type GuestProfile,
} from "../config/avatarCatalog";
import LeaderboardModal from "../components/LeaderboardModal";
import PlayerAvatar from "../components/PlayerAvatar";
import AvatarStudioModal from "../components/AvatarStudioModal";
import AuthModal from "../components/home/AuthModal";
import MatchSetupModal, {
  type MatchSetupMode,
} from "../components/home/MatchSetupModal";
import OpenLobbyModal from "../components/home/OpenLobbyModal";

import "./HomePage.scss";

export default function HomePage() {
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
  const frameLabel =
    AVATAR_FRAME_OPTIONS.find((f) => f.value === resolvedFrame)?.label ||
    "Madeira de Colono";

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
                title="Personalizar seu avatar"
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
                title="Personalizar avatar de visitante"
              >
                <PlayerAvatar
                  config={
                    guestProfile.customized ? guestProfile.avatar_config : undefined
                  }
                  username={guestProfile.display_name}
                  size={56}
                />
              </button>
              <div className="home-identity-pill__meta">
                <strong>{guestProfile.display_name}</strong>
                <small>
                  {guestProfile.customized
                    ? "Avatar personalizado (visitante)"
                    : "Modo visitante"}
                </small>
                <button
                  type="button"
                  className="home-identity-pill__inline-link"
                  onClick={() => handleOpenAuth()}
                >
                  Entrar na conta →
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="home-topbar__center">
          <h1 className="logo">Rule the Isle</h1>
          <p className="home-hero-subtitle">
            Mãos Privadas no Multiplayer • Estratégia em Português
          </p>
        </div>

        <div className="home-topbar__right">
          {account ? (
            <div className="home-rank-pill">
              <div className="home-rank-pill__stats">
                <span className="home-rank-pill__rank">
                  🏆{" "}
                  {typeof account.leaderboard_rank === "number"
                    ? `#${account.leaderboard_rank} no Ranking`
                    : "Ranking Ativo"}
                </span>
                <small>
                  {account.stats?.wins ?? 0} vitórias •{" "}
                  {account.stats?.games_played ?? 0} partidas •{" "}
                  {account.stats?.win_rate ?? 0}%
                </small>
              </div>
              <Button
                size="small"
                variant="outlined"
                className="home-logout-btn"
                onClick={handleLogout}
              >
                Sair
              </Button>
            </div>
          ) : (
            <div className="home-rank-pill home-rank-pill--guest">
              <div className="home-rank-pill__stats">
                <span className="home-rank-pill__rank">🏆 Ranking Global</span>
                <small>Salve vitórias e desbloqueie molduras</small>
              </div>
              <Button
                size="small"
                variant="contained"
                className="home-login-cta-btn"
                onClick={() => handleOpenAuth()}
              >
                👤 Entrar / Criar Conta
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Centro 100% Aberto destacando a ilha de lobby_hero.webp */}
      <main className="home-stage-window" aria-hidden="true" />

      {/* Doca Inferior Flutuante com os 5 Modos Dedicados + Rodapé Legal */}
      <section className="home-dock-wrap">
        <nav className="home-mode-dock" aria-label="Modos de jogo e perfil">
          <Button
            variant="contained"
            className="home-dock-btn home-dock-btn--solo"
            onClick={() => setSetupMode("solo")}
          >
            ⚔️ Partida Rápida (Solo/IA)
          </Button>
          <Button
            variant="contained"
            className="home-dock-btn home-dock-btn--room"
            onClick={() => setSetupMode("room")}
          >
            🌐 Criar Sala Online
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
              ? `🧭 Salas Abertas (${activeRooms.length})`
              : "🧭 Salas Abertas"}
          </Button>
          <Button
            variant="outlined"
            className="home-dock-btn home-dock-btn--ranking"
            onClick={() => setLeaderboardOpen(true)}
          >
            🏆 Ranking & Histórico
          </Button>
          <Button
            variant="outlined"
            className="home-dock-btn home-dock-btn--avatar"
            onClick={handleOpenAvatarStudio}
          >
            🎨 Personalizar Avatar
          </Button>
        </nav>

        <footer className="home-page__legal-footer">
          <strong>Rule the Isle</strong> • Versão modificada em português baseada no motor{" "}
          <a
            href="https://github.com/bcollazo/catanatron"
            target="_blank"
            rel="noreferrer"
          >
            Catanatron
          </a>{" "}
          (Bryan Collazo) • Licença GNU GPL-3.0
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
        defaultHostName={hostName}
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
    </div>
  );
}
