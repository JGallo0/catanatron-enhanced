import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Checkbox,
  IconButton,
  MenuItem,
  Select,
  Slider,
  Tooltip,
} from "@mui/material";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import { GridLoader } from "react-spinners";
import {
  createGame,
  createRoom,
  getPlayers,
  type MapTemplate,
  type PlayerEntry,
  type PlayerKey,
} from "../utils/apiClient";

import "./HomePage.scss";

const MAP_TEMPLATES: MapTemplate[] = ["BASE", "MINI", "TOURNAMENT"];
const PLAYER_COLORS = ["RED", "BLUE", "ORANGE", "WHITE"] as const;

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [mapTemplate, setMapTemplate] = useState<MapTemplate>("BASE");
  const [vpsToWin, setVpsToWin] = useState(10);
  const [discardLimit, setDiscardLimit] = useState(7);
  const [friendlyRobber, setFriendlyRobber] = useState(true);
  const [players, setPlayers] = useState<PlayerKey[]>([
    "HUMAN",
    "CATANATRON",
    "CATANATRON",
    "CATANATRON",
  ]);
  const [available, setAvailable] = useState<PlayerEntry[]>([]);
  const [hostName, setHostName] = useState(
    () => localStorage.getItem("catan_player_name") || "Anfitrião"
  );
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    getPlayers()
      .then(setAvailable)
      .catch(() => setAvailable([]));
  }, []);

  const handlePlayerChange = (index: number, value: PlayerKey) => {
    setPlayers((current) =>
      current.map((player, playerIndex) =>
        playerIndex === index ? value : player
      )
    );
  };

  const handleAddPlayer = () => {
    setPlayers((current) =>
      current.length >= 4 ? current : [...current, "CATANATRON"]
    );
  };

  const handleRemovePlayer = (index: number) => {
    setPlayers((current) =>
      current.length <= 2
        ? current
        : current.filter((_, playerIndex) => playerIndex !== index)
    );
  };

  const handleCreateGame = async () => {
    setLoading(true);
    const gameId = await createGame({
      players,
      mapTemplate,
      vpsToWin,
      discardLimit,
      friendlyRobber,
    });
    setLoading(false);
    navigate("/games/" + gameId);
  };

  const handleCreatePrivateRoom = async () => {
    setLoading(true);
    try {
      const cleanName = hostName.trim() || "Anfitrião";
      localStorage.setItem("catan_player_name", cleanName);
      // Ensure at least 2 human seats if user only had 1 human selected when creating a room for friends
      const humanSeats = players.filter((p) => p === "HUMAN").length;
      const roomPlayers =
        humanSeats >= 2
          ? players
          : ["HUMAN", "HUMAN", ...players.slice(2)];

      const res = await createRoom({
        hostName: cleanName,
        players: roomPlayers,
        mapTemplate,
        vpsToWin,
        discardLimit,
        friendlyRobber,
      });
      localStorage.setItem(
        `catan_room_token_${res.room_code.toUpperCase()}`,
        res.seat_token
      );
      setLoading(false);
      navigate(`/rooms/${res.room_code}`);
    } catch {
      setLoading(false);
    }
  };

  const handleJoinRoomByCode = () => {
    const code = joinCodeInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length >= 4) {
      navigate(`/rooms/${code}`);
    }
  };

  return (
    <div className="home-page">
      <div className="home-page__inner">
        <h1 className="logo">Catanatron</h1>
        {!loading ? (
          <div className="setup-card">
            <p className="setup-note">Open hands. Random discard choice.</p>

            {/* Multiplayer Quick Bar: Create Invite Link or Join by Code */}
            <div className="multiplayer-banner-box">
              <div className="multiplayer-banner-box__header">
                <span>🌐 Jogar com Amigos Online + Bots</span>
                <small>
                  Crie uma sala privada, gere um link de convite e preencha as vagas restantes com IAs fortes
                </small>
              </div>
              <div className="multiplayer-banner-box__controls">
                <input
                  type="text"
                  className="multiplayer-input"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder="Seu nome na sala..."
                  maxLength={24}
                />
                <Button
                  variant="contained"
                  className="create-room-link-btn"
                  onClick={handleCreatePrivateRoom}
                >
                  🔗 Criar Sala Privada (Gerar Link)
                </Button>
              </div>
              <div className="multiplayer-banner-box__join-row">
                <input
                  type="text"
                  className="multiplayer-input multiplayer-input--code"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  placeholder="Código da sala (ex: K7M4P9)"
                  maxLength={10}
                />
                <Button
                  variant="outlined"
                  className="join-room-code-btn"
                  disabled={joinCodeInput.trim().length < 4}
                  onClick={handleJoinRoomByCode}
                >
                  Entrar com Código
                </Button>
              </div>
            </div>

            <div className="control-group">
              <div className="control-header">
                <span>Map Template</span>
                <strong>{mapTemplate}</strong>
              </div>
              <div className="map-template-buttons">
                {MAP_TEMPLATES.map((value) => (
                  <Button
                    key={value}
                    variant="contained"
                    onClick={() => setMapTemplate(value)}
                    className={`choice-button ${
                      mapTemplate === value ? "selected" : ""
                    }`}
                  >
                    {value}
                  </Button>
                ))}
              </div>
            </div>

            <div className="control-row">
              <div className="control-group compact-control">
                <div className="control-header">
                  <span>Points to Win</span>
                  <strong>{vpsToWin}</strong>
                </div>
                <Slider
                  value={vpsToWin}
                  min={3}
                  max={20}
                  step={1}
                  marks
                  valueLabelDisplay="auto"
                  onChange={(_, value) => setVpsToWin(value as number)}
                />
              </div>

              <div className="control-group compact-control">
                <div className="control-header">
                  <span>Card Discard Limit</span>
                  <strong>{discardLimit}</strong>
                </div>
                <Slider
                  value={discardLimit}
                  min={5}
                  max={20}
                  step={1}
                  marks
                  valueLabelDisplay="auto"
                  onChange={(_, value) => setDiscardLimit(value as number)}
                />
              </div>

              <div className="control-group compact-control switch-control">
                <div className="control-header">
                  <span className="inline-title">
                    Friendly Robber
                    <Tooltip
                      title="Prevent robber placement on tiles touching opponents with 2 victory points."
                      arrow
                      enterTouchDelay={0}
                      leaveTouchDelay={3000}
                    >
                      <IconButton
                        size="small"
                        className="help-button"
                        aria-label="Friendly Robber help"
                      >
                        <HelpOutlineRoundedIcon fontSize="inherit" />
                      </IconButton>
                    </Tooltip>
                  </span>
                  <strong>{friendlyRobber ? "On" : "Off"}</strong>
                </div>
                <Checkbox
                  className="inline-switch"
                  checked={friendlyRobber}
                  onChange={(event) => setFriendlyRobber(event.target.checked)}
                />
              </div>
            </div>

            <div className="control-group">
              <div className="control-header">
                <span>Players</span>
                <strong>{players.length}/4</strong>
              </div>
              <div className="players-list">
                {players.map((player, index) => (
                  <div className="player-row" key={`${player}-${index}`}>
                    <div className="player-meta">
                      <span className="player-label">Player {index + 1}</span>
                      <span
                        className={`player-color-chip ${PLAYER_COLORS[index].toLowerCase()}`}
                      >
                        {PLAYER_COLORS[index]}
                      </span>
                    </div>
                    <Select
                      size="small"
                      fullWidth
                      value={player}
                      onChange={(event) =>
                        handlePlayerChange(
                          index,
                          event.target.value as PlayerKey
                        )
                      }
                    >
                      {available.map((option) => (
                        <MenuItem key={option.key} value={option.key}>
                          {option.is_bot ? `🤖 ${option.name}` : `👤 ${option.name}`}
                        </MenuItem>
                      ))}
                    </Select>
                    <Button
                      variant="text"
                      className="remove-player-btn"
                      disabled={players.length <= 2}
                      onClick={() => handleRemovePlayer(index)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                variant="contained"
                className="add-player-btn"
                disabled={players.length >= 4}
                onClick={handleAddPlayer}
              >
                Add Player
              </Button>
            </div>

            <Button
              variant="contained"
              color="primary"
              className="start-btn"
              onClick={handleCreateGame}
            >
              Start
            </Button>
          </div>
        ) : (
          <GridLoader className="loader" color="#FACC15" size={60} />
        )}
        <div className="page-end-spacer" aria-hidden="true" />
      </div>
    </div>
  );
}
