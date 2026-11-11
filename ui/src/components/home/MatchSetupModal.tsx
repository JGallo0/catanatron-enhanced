import { useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Select,
  Slider,
  Tooltip,
} from "@mui/material";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import {
  createGame,
  createRoom,
  type MapTemplate,
  type PlayerAccount,
  type PlayerEntry,
  type PlayerKey,
} from "../../utils/apiClient";
import "./MatchSetupModal.scss";

const MAP_TEMPLATES: Array<{ value: MapTemplate; label: string }> = [
  { value: "BASE", label: "PADRÃO (BASE)" },
  { value: "MINI", label: "MINI (RÁPIDO)" },
  { value: "TOURNAMENT", label: "TORNEIO" },
];

const PLAYER_COLORS = ["RED", "BLUE", "ORANGE", "WHITE"] as const;
const COLOR_LABELS_PT: Record<(typeof PLAYER_COLORS)[number], string> = {
  RED: "VERMELHO",
  BLUE: "AZUL",
  ORANGE: "LARANJA",
  WHITE: "BRANCO",
};

export type MatchSetupMode = "solo" | "room" | null;

export type MatchSetupModalProps = {
  mode: MatchSetupMode;
  onClose: () => void;
  availablePlayers: PlayerEntry[];
  defaultHostName: string;
  account: PlayerAccount | null;
  onGameCreated: (gameId: string) => void;
  onRoomCreated: (roomCode: string) => void;
};

function defaultPlayersForMode(mode: MatchSetupMode): PlayerKey[] {
  return mode === "room"
    ? ["HUMAN", "HUMAN", "CATANATRON", "CATANATRON"]
    : ["HUMAN", "CATANATRON", "CATANATRON", "CATANATRON"];
}

export default function MatchSetupModal({
  mode,
  onClose,
  availablePlayers,
  defaultHostName,
  account,
  onGameCreated,
  onRoomCreated,
}: MatchSetupModalProps) {
  const [mapTemplate, setMapTemplate] = useState<MapTemplate>("BASE");
  const [vpsToWin, setVpsToWin] = useState(10);
  const [discardLimit, setDiscardLimit] = useState(7);
  const [friendlyRobber, setFriendlyRobber] = useState(true);
  const [hostName, setHostName] = useState(
    () => account?.display_name || defaultHostName || "Anfitrião"
  );
  const [players, setPlayers] = useState<PlayerKey[]>(() =>
    defaultPlayersForMode(mode)
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!mode) return;
    setErrorMsg("");
    setSubmitting(false);
    setPlayers(defaultPlayersForMode(mode));
  }, [mode]);

  useEffect(() => {
    if (!mode) return;
    setHostName(account?.display_name || defaultHostName || "Anfitrião");
  }, [mode, account?.display_name, defaultHostName]);

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

  const handleSubmit = async () => {
    if (!mode) return;
    setSubmitting(true);
    setErrorMsg("");
    try {
      if (mode === "solo") {
        const gameId = await createGame({
          players,
          mapTemplate,
          vpsToWin,
          discardLimit,
          friendlyRobber,
        });
        onGameCreated(gameId);
      } else {
        const cleanName =
          hostName.trim() || account?.display_name || "Anfitrião";
        localStorage.setItem("catan_player_name", cleanName);
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
          token: account?.auth_token,
        });
        localStorage.setItem(
          `catan_room_token_${res.room_code.toUpperCase()}`,
          res.seat_token
        );
        onRoomCreated(res.room_code);
      }
    } catch (err: any) {
      setErrorMsg(
        err?.response?.data?.description ||
          (mode === "solo"
            ? "Não foi possível iniciar a partida."
            : "Não foi possível criar a sala online.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTemplateLabel =
    MAP_TEMPLATES.find((t) => t.value === mapTemplate)?.label || mapTemplate;
  const isRoom = mode === "room";

  return (
    <Dialog
      open={Boolean(mode)}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ className: "catan-modal-paper match-setup-paper" }}
    >
      <DialogTitle className="match-setup-header">
        <span>
          {isRoom
            ? "🌐 Criar Sala Online (Amigos & Bots)"
            : "⚔️ Configurar Partida Rápida (Solo vs IA)"}
        </span>
        <Button
          size="small"
          variant="outlined"
          className="home-modal-close-btn"
          onClick={onClose}
        >
          Fechar
        </Button>
      </DialogTitle>

      <DialogContent className="match-setup-body">
        {isRoom && (
          <div className="match-setup-host-field">
            <label htmlFor="setup-host-name">Seu Apelido na Mesa</label>
            <input
              id="setup-host-name"
              type="text"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder="Seu apelido na sala..."
              maxLength={24}
            />
          </div>
        )}

        <div className="match-setup-group">
          <div className="match-setup-group__header">
            <span>Modelo do Mapa</span>
            <strong>{selectedTemplateLabel}</strong>
          </div>
          <div className="match-setup-templates">
            {MAP_TEMPLATES.map(({ value, label }) => (
              <Button
                key={value}
                variant="contained"
                onClick={() => setMapTemplate(value)}
                className={`match-setup-choice-btn ${
                  mapTemplate === value ? "selected" : ""
                }`}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        <div className="match-setup-sliders-row">
          <div className="match-setup-compact-box">
            <div className="match-setup-group__header">
              <span>Pontos para Vencer</span>
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

          <div className="match-setup-compact-box">
            <div className="match-setup-group__header">
              <span>Limite de Cartas (Ladrão)</span>
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

          <div className="match-setup-compact-box match-setup-compact-box--switch">
            <div className="match-setup-group__header">
              <span className="match-setup-inline-title">
                Ladrão Amigável
                <Tooltip
                  title="Impede colocar o Ladrão em terrenos de jogadores que tenham apenas 2 pontos de vitória."
                  arrow
                  enterTouchDelay={0}
                  leaveTouchDelay={3000}
                >
                  <IconButton
                    size="small"
                    className="match-setup-help-btn"
                    aria-label="Ajuda sobre Ladrão Amigável"
                  >
                    <HelpOutlineRoundedIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              </span>
              <strong>{friendlyRobber ? "Ativo" : "Inativo"}</strong>
            </div>
            <Checkbox
              className="match-setup-checkbox"
              checked={friendlyRobber}
              onChange={(event) => setFriendlyRobber(event.target.checked)}
            />
          </div>
        </div>

        <div className="match-setup-group">
          <div className="match-setup-group__header">
            <span>Jogadores na Mesa</span>
            <strong>{players.length}/4</strong>
          </div>
          <div className="match-setup-players">
            {players.map((player, index) => (
              <div className="match-setup-player-row" key={`${player}-${index}`}>
                <div className="match-setup-player-meta">
                  <span>Jogador {index + 1}</span>
                  <span
                    className={`match-setup-color-chip ${PLAYER_COLORS[
                      index
                    ].toLowerCase()}`}
                  >
                    {COLOR_LABELS_PT[PLAYER_COLORS[index]]}
                  </span>
                </div>
                <Select
                  size="small"
                  fullWidth
                  value={player}
                  onChange={(event) =>
                    handlePlayerChange(index, event.target.value as PlayerKey)
                  }
                >
                  {availablePlayers.map((option) => (
                    <MenuItem key={option.key} value={option.key}>
                      {option.is_bot ? `🤖 ${option.name}` : `👤 ${option.name}`}
                    </MenuItem>
                  ))}
                </Select>
                <Button
                  variant="text"
                  className="match-setup-remove-btn"
                  disabled={players.length <= 2}
                  onClick={() => handleRemovePlayer(index)}
                >
                  Remover
                </Button>
              </div>
            ))}
          </div>
          <Button
            variant="outlined"
            className="match-setup-add-btn"
            disabled={players.length >= 4}
            onClick={handleAddPlayer}
          >
            + Adicionar Jogador
          </Button>
        </div>

        {errorMsg && <div className="match-setup-error">{errorMsg}</div>}
      </DialogContent>

      <DialogActions className="match-setup-actions">
        <Button
          variant="outlined"
          className="match-setup-cancel-btn"
          onClick={onClose}
        >
          Cancelar
        </Button>
        <Button
          variant="contained"
          className={
            isRoom ? "match-setup-submit-btn--room" : "match-setup-submit-btn--solo"
          }
          disabled={submitting}
          onClick={handleSubmit}
        >
          {submitting
            ? "Preparando mesa..."
            : isRoom
              ? "🔗 Criar Sala e Gerar Link"
              : "⚔️ Iniciar Partida"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
