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
  formatBotDifficultyLabel,
  formatBotSpeedLabel,
  formatMapTemplateLabel,
  getBotDifficultyOptions,
  getBotSpeedOptions,
  getMapTemplateOptions,
  getOpenSeatLabel,
  localizeSeatLabel,
  OFFICIAL_BOT_NAMES,
  OPEN_SEAT_LABEL,
  playerKeyForDifficulty,
  type OfficialBotName,
} from "../../config/botCatalog";
import { getPlayerColorMeta } from "../../config/assetRegistry";
import { localizeGuestDisplayName } from "../../config/avatarCatalog";
import { useLanguage } from "../../i18n";
import { getSavedGameSpeed, saveGameSpeed } from "../../utils/tabletopPacing";
import { getSavedGameSeat, saveGameSeat } from "../../utils/seatStorage";
import { usePieceSkin } from "../../utils/pieceSkin";
import { useBoardSkin } from "../../utils/boardSkin";
import type { Color } from "../../utils/api.types";
import PlayerAvatar from "../PlayerAvatar";
import MapTemplatePreview from "./MapTemplatePreview";
import "./MatchSetupModal.scss";

const PLAYER_COLORS = ["RED", "BLUE", "ORANGE", "WHITE"] as const;

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
  const { language, t } = useLanguage();
  const colorMeta = getPlayerColorMeta(language);
  const mapTemplateOptions = getMapTemplateOptions(language);
  const botDifficultyOptions = getBotDifficultyOptions(language);
  const botSpeedOptions = getBotSpeedOptions(language);
  const openSeatLabel = getOpenSeatLabel(language);

  const [mapTemplate, setMapTemplate] = useState<MapTemplate>("BASE");
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>("medium");
  const [botSpeed, setBotSpeed] = useState<BotSpeed>(() =>
    mode === "solo" ? getSavedGameSpeed() : "normal"
  );
  const [diceMode, setDiceMode] = useState<DiceMode>("random");
  const [vpsToWin, setVpsToWin] = useState(10);
  const [discardLimit, setDiscardLimit] = useState(7);
  const [friendlyRobber, setFriendlyRobber] = useState(true);
  const [hostName, setHostName] = useState(() =>
    account?.display_name ||
    localizeGuestDisplayName(
      localizeSeatLabel(defaultHostName || "Anfitrião", language),
      language
    )
  );
  const [seats, setSeats] = useState<SeatSelection[]>(() =>
    defaultSeatsForMode(mode)
  );
  const { skin: pieceSkin, setSkin: setPieceSkin } = usePieceSkin();
  const { skin: boardSkin, changeSkin: setBoardSkin, skins: boardSkins } = useBoardSkin();
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
    setHostName(
      account?.display_name ||
        localizeGuestDisplayName(
          localizeSeatLabel(defaultHostName || "Anfitrião", language),
          language
        )
    );
  }, [mode, account?.display_name, defaultHostName]);

  useEffect(() => {
    if (!mode || account) return;
    setHostName((prev) =>
      localizeGuestDisplayName(localizeSeatLabel(prev, language), language)
    );
  }, [mode, account, language]);

  const cleanHostLabel = localizeGuestDisplayName(
    localizeSeatLabel(
      hostName.trim() || account?.display_name || defaultHostName || "Anfitrião",
      language
    ),
    language
  );

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
      const cleanName = cleanHostLabel;
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
        if (!getSavedGameSeat(gameId)) {
          const defaultSeatColor: Color =
            hostIdx === 0
              ? "RED"
              : hostIdx === 1
                ? "BLUE"
                : hostIdx === 2
                  ? "ORANGE"
                  : "WHITE";
          saveGameSeat(gameId, defaultSeatColor);
        }
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
            ? t(
                "Não foi possível iniciar a partida.",
                "Could not start the match."
              )
            : t(
                "Não foi possível criar a sala online.",
                "Could not create the online room."
              ))
      );
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTemplateLabel = formatMapTemplateLabel(mapTemplate, language);
  const selectedDifficultyLabel = formatBotDifficultyLabel(botDifficulty, language);
  const selectedSpeedLabel = formatBotSpeedLabel(botSpeed, language);
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
            ? t(
                "🌐 Criar Sala Online (Amigos & Bots)",
                "🌐 Create Online Room (Friends & Bots)"
              )
            : t(
                "⚔️ Configurar Partida Rápida (Solo vs IA)",
                "⚔️ Quick Match Setup (Solo vs AI)"
              )}
        </span>
        <Button
          size="small"
          variant="outlined"
          className="home-modal-close-btn"
          onClick={onClose}
        >
          {t("Fechar", "Close")}
        </Button>
      </DialogTitle>

      <DialogContent className="match-setup-body">
        {isRoom && (
          <div className="match-setup-host-field">
            <label htmlFor="setup-host-name">
              {t("Seu Apelido na Mesa", "Your Table Nickname")}
            </label>
            <input
              id="setup-host-name"
              type="text"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder={t("Seu apelido na sala...", "Your room nickname...")}
              maxLength={24}
            />
          </div>
        )}

        <div className="match-setup-group">
          <div className="match-setup-group__header">
            <span className="match-setup-inline-title">
              {t("Modelo do Mapa", "Map Template")}
              <Tooltip
                title={t(
                  "Padrão sorteia terrenos e portos a cada partida; Mini usa apenas 7 terrenos para jogos rápidos; Torneio mantém o tabuleiro oficial fixo.",
                  "Standard shuffles terrains and harbors every match; Mini uses only 7 terrains for quick games; Tournament keeps the official fixed board."
                )}
                arrow
                enterTouchDelay={0}
                leaveTouchDelay={3000}
              >
                <IconButton
                  size="small"
                  className="match-setup-help-btn"
                  aria-label={t(
                    "Ajuda sobre Modelo do Mapa",
                    "Help about Map Template"
                  )}
                >
                  <HelpOutlineRoundedIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
            </span>
            <strong>{selectedTemplateLabel}</strong>
          </div>
          <div className="match-setup-templates">
            {mapTemplateOptions.map(({ value, label }) => (
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
              <span>{t("Pontos para Vencer", "Victory Points to Win")}</span>
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
                {t("Limite de Cartas (Ladrão)", "Hand Limit (Robber)")}
                <Tooltip
                  title={t(
                    "Ao sair 7 nos dados, jogadores com mais cartas que este limite descartam metade (arredondado para baixo).",
                    "When a 7 is rolled, players holding more cards than this limit discard half (rounded down)."
                  )}
                  arrow
                  enterTouchDelay={0}
                  leaveTouchDelay={3000}
                >
                  <IconButton
                    size="small"
                    className="match-setup-help-btn"
                    aria-label={t(
                      "Ajuda sobre Limite de Cartas (Ladrão)",
                      "Help about Hand Limit (Robber)"
                    )}
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
                {t("Ladrão Amigável", "Friendly Robber")}
                <Tooltip
                  title={t(
                    "Impede colocar o Ladrão em terrenos de jogadores que tenham apenas 2 pontos de vitória.",
                    "Prevents placing the Robber on hexes bordering players who still have only 2 victory points."
                  )}
                  arrow
                  enterTouchDelay={0}
                  leaveTouchDelay={3000}
                >
                  <IconButton
                    size="small"
                    className="match-setup-help-btn"
                    aria-label={t(
                      "Ajuda sobre Ladrão Amigável",
                      "Help about Friendly Robber"
                    )}
                  >
                    <HelpOutlineRoundedIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              </span>
              <strong>
                {friendlyRobber ? t("Ativo", "Active") : t("Inativo", "Off")}
              </strong>
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
              {t("Modo dos Dados", "Dice Mode")}
              <Tooltip
                title={t(
                  "Padrão usa 2 dados clássicos (2d6). Equilibrados usa um baralho de 36 pares embaralhados, reembaralhando ao restarem 5 cartas.",
                  "Standard uses 2 classic dice (2d6). Balanced uses a shuffled 36-pair deck, reshuffling when 5 cards remain."
                )}
                arrow
                enterTouchDelay={0}
                leaveTouchDelay={3000}
              >
                <IconButton
                  size="small"
                  className="match-setup-help-btn"
                  aria-label={t(
                    "Ajuda sobre Modo dos Dados",
                    "Help about Dice Mode"
                  )}
                >
                  <HelpOutlineRoundedIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
            </span>
            <strong>
              {diceMode === "balanced"
                ? t("Equilibrados (Baralho 36)", "Balanced (36-Card Deck)")
                : t("Padrão (2d6)", "Standard (2d6)")}
            </strong>
          </div>
          <div
            className="match-setup-dice-options"
            role="group"
            aria-label={t("Modo dos Dados", "Dice Mode")}
          >
            <Button
              variant="contained"
              aria-pressed={diceMode === "random"}
              onClick={() => setDiceMode("random")}
              className={`match-setup-choice-btn match-setup-dice-btn ${
                diceMode === "random" ? "selected" : ""
              }`}
            >
              🎲 {t("Padrão (2d6)", "Standard (2d6)")}
            </Button>
            <Button
              variant="contained"
              aria-pressed={diceMode === "balanced"}
              onClick={() => setDiceMode("balanced")}
              className={`match-setup-choice-btn match-setup-dice-btn ${
                diceMode === "balanced" ? "selected" : ""
              }`}
            >
              🎴 {t("Equilibrados (Baralho 36)", "Balanced (36-Card Deck)")}
            </Button>
          </div>
        </div>

        <div className="match-setup-group">
          <div className="match-setup-group__header">
            <span className="match-setup-inline-title">
              {t("Dificuldade dos Bots", "Bot Difficulty")}
              <Tooltip
                title={t(
                  "Define o nível estratégico de todos os bots da mesa: Fácil, Moderado ou Difícil.",
                  "Sets the strategic level of all table bots: Easy, Medium, or Hard."
                )}
                arrow
                enterTouchDelay={0}
                leaveTouchDelay={3000}
              >
                <IconButton
                  size="small"
                  className="match-setup-help-btn"
                  aria-label={t(
                    "Ajuda sobre Dificuldade dos Bots",
                    "Help about Bot Difficulty"
                  )}
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
            aria-label={t("Dificuldade dos Bots", "Bot Difficulty")}
          >
            {botDifficultyOptions.map((opt) => (
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
              {t("Velocidade dos Bots", "Bot Speed")}
              <Tooltip
                title={
                  isRoom
                    ? t(
                        "Define o ritmo das animações e jogadas dos bots para todos na sala online (definido antes de iniciar).",
                        "Sets bot animation and move pacing for everyone in the online room (locked before start)."
                      )
                    : t(
                        "Define o ritmo inicial das animações e jogadas dos bots. No modo offline você também pode alterar a qualquer momento durante a partida.",
                        "Sets initial bot animation and move pacing. In offline mode you can also adjust it anytime during the match."
                      )
                }
                arrow
                enterTouchDelay={0}
                leaveTouchDelay={3000}
              >
                <IconButton
                  size="small"
                  className="match-setup-help-btn"
                  aria-label={t(
                    "Ajuda sobre Velocidade dos Bots",
                    "Help about Bot Speed"
                  )}
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
            aria-label={t("Velocidade dos Bots", "Bot Speed")}
          >
            {botSpeedOptions.map((opt) => (
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
            <span>{t("Estilo do Tabuleiro", "Board Style")}</span>
          </div>
          <div
            className="match-setup-templates"
            role="group"
            aria-label={t("Estilo do Tabuleiro", "Board Style")}
          >
            {Object.values(boardSkins).map((option) => (
              <Button
                key={option.id}
                variant="contained"
                aria-pressed={boardSkin === option.id}
                onClick={() => setBoardSkin(option.id)}
                title={t(option.descriptionPt, option.descriptionEn)}
                className={`match-setup-choice-btn match-setup-skin-btn ${boardSkin === option.id ? "selected" : ""}`}
              >
                {t(option.namePt, option.nameEn)}
                {option.isDefault && ` (${t(option.badgePt, option.badgeEn)})`}
              </Button>
            ))}
          </div>
        </div>

        <div className="match-setup-group">
          <div className="match-setup-group__header">
            <span className="match-setup-inline-title">
              {t("Estilo das Peças", "Piece Style")}
              <Tooltip
                title={t(
                  "Escolha entre o visual oficial de Alto Contraste (máxima legibilidade de aldeias, cidades e estradas) ou Vilarejo Detalhado.",
                  "Choose between official High Contrast (maximum legibility for settlements, cities, and roads) or Detailed Cottage."
                )}
                arrow
                enterTouchDelay={0}
                leaveTouchDelay={3000}
              >
                <IconButton
                  size="small"
                  className="match-setup-help-btn"
                  aria-label={t(
                    "Ajuda sobre Estilo das Peças",
                    "Help about Piece Style"
                  )}
                >
                  <HelpOutlineRoundedIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
            </span>
            <strong>
              {pieceSkin === "contrast"
                ? t("Alto Contraste (Padrão)", "High Contrast (Default)")
                : t("Vilarejo Detalhado (Variante)", "Detailed Cottage (Variant)")}
            </strong>
          </div>
          <div
            className="match-setup-dice-options"
            role="group"
            aria-label={t("Estilo das Peças", "Piece Style")}
          >
            <Button
              variant="contained"
              aria-pressed={pieceSkin === "contrast"}
              onClick={() => setPieceSkin("contrast")}
              className={`match-setup-choice-btn match-setup-skin-btn ${
                pieceSkin === "contrast" ? "selected" : ""
              }`}
            >
              🏰 {t("Alto Contraste (Padrão)", "High Contrast (Default)")}
            </Button>
            <Button
              variant="contained"
              aria-pressed={pieceSkin === "cottage"}
              onClick={() => setPieceSkin("cottage")}
              className={`match-setup-choice-btn match-setup-skin-btn ${
                pieceSkin === "cottage" ? "selected" : ""
              }`}
            >
              🏡 {t("Vilarejo Detalhado (Variante)", "Detailed Cottage (Variant)")}
            </Button>
          </div>
        </div>

        <div className="match-setup-group">
          <div className="match-setup-group__header">
            <span>{t("Jogadores na Mesa", "Players at Table")}</span>
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
                    <span>{t(`Jogador ${index + 1}`, `Player ${index + 1}`)}</span>
                    <span
                      className={`match-setup-color-chip ${colorKey.toLowerCase()}`}
                    >
                      {colorMeta[colorKey].label.toUpperCase()}
                    </span>
                  </div>
                  <Select
                    size="small"
                    fullWidth
                    SelectDisplayProps={{
                      "aria-label": t(
                        `Jogador ${index + 1}`,
                        `Player ${index + 1}`
                      ),
                    }}
                    value={displaySeatValue}
                    onChange={(event) =>
                      handleSeatChange(index, event.target.value as SeatSelection)
                    }
                  >
                    <MenuItem value="HOST">
                      <span className="match-setup-select-option">
                        <span>
                          👤 {cleanHostLabel} ({t("Você", "You")})
                        </span>
                      </span>
                    </MenuItem>
                    {isRoom && (
                      <MenuItem value="OPEN">
                        <span className="match-setup-select-option">
                          <span>🪑 {openSeatLabel}</span>
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
                                ({t("na mesa", "at table")})
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
                    {t("Remover", "Remove")}
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
            {t("+ Adicionar Jogador", "+ Add Player")}
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
          {t("Cancelar", "Cancel")}
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
            ? t("Preparando mesa...", "Setting up table...")
            : isRoom
              ? t("🔗 Criar Sala e Gerar Link", "🔗 Create Room & Generate Link")
              : t("⚔️ Iniciar Partida", "⚔️ Start Match")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
