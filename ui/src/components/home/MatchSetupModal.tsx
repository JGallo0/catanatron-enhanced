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
  type BotDifficulty,
  type BotSpeed,
  type DiceMode,
  type MapTemplate,
  type PlayerAccount,
  type PlayerEntry,
} from "../../utils/apiClient";
import {
  BOT_AVATAR_PROFILES,
  BOT_DIFFICULTY_OPTIONS,
  BOT_SPEED_OPTIONS,
  formatBotDifficultyLabel,
  formatBotSpeedLabel,
  formatMapTemplateLabel,
  MAP_TEMPLATE_OPTIONS,
  OFFICIAL_BOT_NAMES,
  OPEN_SEAT_LABEL,
  playerKeyForDifficulty,
  type OfficialBotName,
} from "../../config/botCatalog";
import { getSavedGameSpeed, saveGameSpeed } from "../../utils/tabletopPacing";
import PlayerAvatar from "../PlayerAvatar";
import MapTemplatePreview from "./MapTemplatePreview";
import "./MatchSetupModal.scss";

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
  availablePlayers?: PlayerEntry[];
  defaultHostName: string;
  account: PlayerAccount | null;
  onGameCreated: (gameId: string) => void;
  onRoomCreated: (roomCode: string) => void;
};

type SeatSelection = "HOST" | "OPEN" | `BOT:${OfficialBotName}`;

function defaultSeatsForMode(mode: MatchSetupMode): SeatSelection[] {
  return mode === "room"
    ? ["HOST", "OPEN", "BOT:Creitu", "BOT:Felire"]
    : ["HOST", "BOT:Creitu", "BOT:Felire", "BOT:Guiri"];
}

function nextUnusedBot(seats: SeatSelection[], excludeIdx = -1): OfficialBotName {
  const used = new Set<string>();
  seats.forEach((s, idx) => {
    if (idx !== excludeIdx && s.startsWith("BOT:")) {
      used.add(s.slice(4));
    }
  });
  return OFFICIAL_BOT_NAMES.find((name) => !used.has(name)) ?? OFFICIAL_BOT_NAMES[0];
}

export default function MatchSetupModal({
  mode,
  onClose,
  defaultHostName,
  account,
  onGameCreated,
  onRoomCreated,
}: MatchSetupModalProps) {
  const [mapTemplate, setMapTemplate] = useState<MapTemplate>("BASE");
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>("medium");
  const [botSpeed, setBotSpeed] = useState<BotSpeed>(() =>
    mode === "solo" ? getSavedGameSpeed() : "normal"
  );
  const [diceMode, setDiceMode] = useState<DiceMode>("random");
  const [vpsToWin, setVpsToWin] = useState(10);
  const [discardLimit, setDiscardLimit] = useState(7);
  const [friendlyRobber, setFriendlyRobber] = useState(true);
  const [hostName, setHostName] = useState(
    () => account?.display_name || defaultHostName || "Anfitrião"
  );
  const [seats, setSeats] = useState<SeatSelection[]>(() =>
    defaultSeatsForMode(mode)
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!mode) return;
    setErrorMsg("");
    setSubmitting(false);
    setSeats(defaultSeatsForMode(mode));
    setBotDifficulty("medium");
    setBotSpeed(mode === "solo" ? getSavedGameSpeed() : "normal");
    setDiceMode("random");
  }, [mode]);

  useEffect(() => {
    if (!mode) return;
    setHostName(account?.display_name || defaultHostName || "Anfitrião");
  }, [mode, account?.display_name, defaultHostName]);

  const cleanHostLabel =
    hostName.trim() || account?.display_name || defaultHostName || "Anfitrião";

  const handleSeatChange = (index: number, value: SeatSelection) => {
    setSeats((current) => {
      const currentSeat = current[index];
      if (value === currentSeat) return current;

      if (value === "HOST") {
        const oldHostIdx = current.indexOf("HOST");
        return current.map((s, idx) => {
          if (idx === index) return "HOST";
          if (idx === oldHostIdx) {
            if (currentSeat.startsWith("BOT:")) return currentSeat;
            return mode === "room"
              ? "OPEN"
              : (`BOT:${nextUnusedBot(current, idx)}` as SeatSelection);
          }
          return s;
        });
      }

      if (currentSeat === "HOST") {
        if (mode === "room" && value === "OPEN") {
          const openIdx = current.findIndex((s, idx) => idx !== index && s === "OPEN");
          if (openIdx >= 0) {
            return current.map((s, idx) =>
              idx === index ? "OPEN" : idx === openIdx ? "HOST" : s
            );
          }
          return current;
        }
        const fallbackHostIdx = current.findIndex(
          (s, idx) => idx !== index && s === "OPEN"
        );
        if (fallbackHostIdx < 0) {
          return current;
        }
        return current.map((s, idx) => {
          if (idx === index) return value;
          if (idx === fallbackHostIdx) return "HOST";
          return s;
        });
      }

      if (value.startsWith("BOT:")) {
        const dupIdx = current.findIndex((s, idx) => idx !== index && s === value);
        if (dupIdx >= 0) {
          return current;
        }
      }

      return current.map((s, idx) => (idx === index ? value : s));
    });
  };

  const handleAddPlayer = () => {
    setSeats((current) => {
      if (current.length >= 4) return current;
      const bot = nextUnusedBot(current);
      return [...current, `BOT:${bot}`];
    });
  };

  const handleRemovePlayer = (index: number) => {
    setSeats((current) => {
      if (current.length <= 2 || current[index] === "HOST") return current;
      return current.filter((_, seatIndex) => seatIndex !== index);
    });
  };

  const handleSubmit = async () => {
    if (!mode) return;
    setSubmitting(true);
    setErrorMsg("");
    try {
      const cleanName =
        hostName.trim() || account?.display_name || defaultHostName || "Anfitrião";
      const botKey = playerKeyForDifficulty(botDifficulty);

      if (mode === "solo") {
        saveGameSpeed(botSpeed);
        const hostIdx = Math.max(0, seats.indexOf("HOST"));
        const players = seats.map((s) =>
          s === "HOST" || s === "OPEN" ? "HUMAN" : botKey
        );
        const seatNamesList = seats.map((s) =>
          s.startsWith("BOT:") ? s.slice(4) : cleanName
        );
        const gameId = await createGame({
          players,
          mapTemplate,
          vpsToWin,
          discardLimit,
          friendlyRobber,
          diceMode,
          seatNamesList,
          hostName: cleanName,
          hostSeatIndex: hostIdx,
        });
        onGameCreated(gameId);
      } else {
        localStorage.setItem("catan_player_name", cleanName);
        const roomSeats = seats.map((s) => {
          if (s === "HOST") {
            return {
              player_key: "HUMAN",
              player_name: cleanName,
              is_host: true,
            };
          }
          if (s === "OPEN") {
            return {
              player_key: "HUMAN",
              player_name: OPEN_SEAT_LABEL,
              is_host: false,
            };
          }
          return {
            player_key: botKey,
            player_name: s.slice(4),
            is_host: false,
          };
        });

        const res = await createRoom({
          hostName: cleanName,
          players: roomSeats.map((s) => s.player_key),
          seats: roomSeats,
          botDifficulty,
          botSpeed,
          mapTemplate,
          vpsToWin,
          discardLimit,
          friendlyRobber,
          diceMode,
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

  const selectedTemplateLabel = formatMapTemplateLabel(mapTemplate);
  const selectedDifficultyLabel = formatBotDifficultyLabel(botDifficulty);
  const selectedSpeedLabel = formatBotSpeedLabel(botSpeed);
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
            <span className="match-setup-inline-title">
              Modelo do Mapa
              <Tooltip
                title="Padrão sorteia terrenos e portos a cada partida; Mini usa apenas 7 terrenos para jogos rápidos; Torneio mantém o tabuleiro oficial fixo."
                arrow
                enterTouchDelay={0}
                leaveTouchDelay={3000}
              >
                <IconButton
                  size="small"
                  className="match-setup-help-btn"
                  aria-label="Ajuda sobre Modelo do Mapa"
                >
                  <HelpOutlineRoundedIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
            </span>
            <strong>{selectedTemplateLabel}</strong>
          </div>
          <div className="match-setup-templates">
            {MAP_TEMPLATE_OPTIONS.map(({ value, label }) => (
              <Button
                key={value}
                variant="contained"
                aria-pressed={mapTemplate === value}
                onClick={() => setMapTemplate(value)}
                className={`match-setup-choice-btn ${
                  mapTemplate === value ? "selected" : ""
                }`}
              >
                {label}
              </Button>
            ))}
          </div>
          <MapTemplatePreview template={mapTemplate} />
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
              <span className="match-setup-inline-title">
                Limite de Cartas (Ladrão)
                <Tooltip
                  title="Ao sair 7 nos dados, jogadores com mais cartas que este limite descartam metade (arredondado para baixo)."
                  arrow
                  enterTouchDelay={0}
                  leaveTouchDelay={3000}
                >
                  <IconButton
                    size="small"
                    className="match-setup-help-btn"
                    aria-label="Ajuda sobre Limite de Cartas (Ladrão)"
                  >
                    <HelpOutlineRoundedIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              </span>
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
            <span className="match-setup-inline-title">
              Modo dos Dados
              <Tooltip
                title="Padrão usa 2 dados clássicos (2d6). Equilibrados usa um baralho de 36 pares embaralhados, reembaralhando ao restarem 5 cartas."
                arrow
                enterTouchDelay={0}
                leaveTouchDelay={3000}
              >
                <IconButton
                  size="small"
                  className="match-setup-help-btn"
                  aria-label="Ajuda sobre Modo dos Dados"
                >
                  <HelpOutlineRoundedIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
            </span>
            <strong>
              {diceMode === "balanced"
                ? "Equilibrados (Baralho 36)"
                : "Padrão (2d6)"}
            </strong>
          </div>
          <div
            className="match-setup-dice-options"
            role="group"
            aria-label="Modo dos Dados"
          >
            <Button
              variant="contained"
              aria-pressed={diceMode === "random"}
              onClick={() => setDiceMode("random")}
              className={`match-setup-choice-btn match-setup-dice-btn ${
                diceMode === "random" ? "selected" : ""
              }`}
            >
              🎲 Padrão (2d6)
            </Button>
            <Button
              variant="contained"
              aria-pressed={diceMode === "balanced"}
              onClick={() => setDiceMode("balanced")}
              className={`match-setup-choice-btn match-setup-dice-btn ${
                diceMode === "balanced" ? "selected" : ""
              }`}
            >
              🎴 Equilibrados (Baralho 36)
            </Button>
          </div>
        </div>

        <div className="match-setup-group">
          <div className="match-setup-group__header">
            <span className="match-setup-inline-title">
              Dificuldade dos Bots
              <Tooltip
                title="Define o nível estratégico de todos os bots da mesa: Fácil, Moderado ou Difícil."
                arrow
                enterTouchDelay={0}
                leaveTouchDelay={3000}
              >
                <IconButton
                  size="small"
                  className="match-setup-help-btn"
                  aria-label="Ajuda sobre Dificuldade dos Bots"
                >
                  <HelpOutlineRoundedIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
            </span>
            <strong>{selectedDifficultyLabel}</strong>
          </div>
          <div
            className="match-setup-templates"
            role="group"
            aria-label="Dificuldade dos Bots"
          >
            {BOT_DIFFICULTY_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant="contained"
                aria-pressed={botDifficulty === opt.value}
                onClick={() => setBotDifficulty(opt.value)}
                title={opt.description}
                className={`match-setup-choice-btn match-setup-diff-btn ${
                  botDifficulty === opt.value ? "selected" : ""
                }`}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="match-setup-group">
          <div className="match-setup-group__header">
            <span className="match-setup-inline-title">
              Velocidade dos Bots
              <Tooltip
                title={
                  isRoom
                    ? "Define o ritmo das animações e jogadas dos bots para todos na sala online (definido antes de iniciar)."
                    : "Define o ritmo inicial das animações e jogadas dos bots. No modo offline você também pode alterar a qualquer momento durante a partida."
                }
                arrow
                enterTouchDelay={0}
                leaveTouchDelay={3000}
              >
                <IconButton
                  size="small"
                  className="match-setup-help-btn"
                  aria-label="Ajuda sobre Velocidade dos Bots"
                >
                  <HelpOutlineRoundedIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
            </span>
            <strong>{selectedSpeedLabel}</strong>
          </div>
          <div
            className="match-setup-templates"
            role="group"
            aria-label="Velocidade dos Bots"
          >
            {BOT_SPEED_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant="contained"
                aria-pressed={botSpeed === opt.value}
                onClick={() => setBotSpeed(opt.value)}
                title={opt.description}
                className={`match-setup-choice-btn match-setup-speed-btn ${
                  botSpeed === opt.value ? "selected" : ""
                }`}
              >
                {opt.icon} {opt.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="match-setup-group">
          <div className="match-setup-group__header">
            <span>Jogadores na Mesa</span>
            <strong>{seats.length}/4</strong>
          </div>
          <div className="match-setup-players">
            {seats.map((seat, index) => {
              const colorKey = PLAYER_COLORS[index];
              const isHostSeat = seat === "HOST";
              const canRemove = seats.length > 2 && !isHostSeat;
              const displaySeatValue =
                !isRoom && seat === "OPEN"
                  ? (`BOT:${nextUnusedBot(seats, index)}` as SeatSelection)
                  : seat;
              return (
                <div className="match-setup-player-row" key={`${colorKey}-${index}`}>
                  <div className="match-setup-player-meta">
                    <span>Jogador {index + 1}</span>
                    <span
                      className={`match-setup-color-chip ${colorKey.toLowerCase()}`}
                    >
                      {COLOR_LABELS_PT[colorKey]}
                    </span>
                  </div>
                  <Select
                    size="small"
                    fullWidth
                    SelectDisplayProps={{
                      "aria-label": `Jogador ${index + 1}`,
                    }}
                    value={displaySeatValue}
                    onChange={(event) =>
                      handleSeatChange(index, event.target.value as SeatSelection)
                    }
                  >
                    <MenuItem value="HOST">
                      <span className="match-setup-select-option">
                        <span>👤 {cleanHostLabel} (Você)</span>
                      </span>
                    </MenuItem>
                    {isRoom && (
                      <MenuItem value="OPEN">
                        <span className="match-setup-select-option">
                          <span>🪑 {OPEN_SEAT_LABEL}</span>
                        </span>
                      </MenuItem>
                    )}
                    {OFFICIAL_BOT_NAMES.map((botName) => {
                      const botVal = `BOT:${botName}` as SeatSelection;
                      const takenElsewhere = seats.some(
                        (other, otherIdx) => otherIdx !== index && other === botVal
                      );
                      return (
                        <MenuItem
                          key={botVal}
                          value={botVal}
                          disabled={takenElsewhere}
                        >
                          <span className="match-setup-select-option">
                            <PlayerAvatar
                              config={BOT_AVATAR_PROFILES[botName]}
                              username={botName}
                              size={22}
                            />
                            <span>{botName}</span>
                            {takenElsewhere && (
                              <span className="match-setup-option-hint">
                                (na mesa)
                              </span>
                            )}
                          </span>
                        </MenuItem>
                      );
                    })}
                  </Select>
                  <Button
                    variant="text"
                    className="match-setup-remove-btn"
                    disabled={!canRemove}
                    onClick={() => handleRemovePlayer(index)}
                  >
                    Remover
                  </Button>
                </div>
              );
            })}
          </div>
          <Button
            variant="outlined"
            className="match-setup-add-btn"
            disabled={seats.length >= 4}
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
