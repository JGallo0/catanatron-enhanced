import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tab,
  Tabs,
} from "@mui/material";
import type { AvatarConfig } from "../utils/api.types";
import { updateProfile, type PlayerAccount } from "../utils/apiClient";
import {
  AVATAR_BACKGROUND_OPTIONS,
  AVATAR_BEARD_OPTIONS,
  AVATAR_EYES_OPTIONS,
  AVATAR_FRAME_OPTIONS,
  AVATAR_HAIR_COLOR_OPTIONS,
  AVATAR_HAIR_OPTIONS,
  AVATAR_HAT_OPTIONS,
  AVATAR_OUTFIT_COLOR_OPTIONS,
  AVATAR_OUTFIT_OPTIONS,
  AVATAR_PRESETS,
  AVATAR_SKIN_OPTIONS,
  getAvatarItemRequirement,
  isAvatarItemUnlocked,
  randomizeUnlockedAvatar,
  resolveAvatarConfig,
  type AvatarOption,
} from "../config/avatarCatalog";
import PlayerAvatar from "./PlayerAvatar";
import "./AvatarStudioModal.scss";

type StudioTab = "face" | "hair" | "accessories" | "outfit" | "frames";

function safeResolveConfig(
  raw?: Partial<AvatarConfig> | Record<string, unknown> | null,
  username?: string | null
): AvatarConfig {
  const r = resolveAvatarConfig(raw, username);
  return {
    skin: r.skin ?? "warm",
    eyes: r.eyes ?? "calm",
    hair: r.hair ?? "short",
    hairColor: r.hairColor ?? "brown",
    beard: r.beard ?? "none",
    hat: r.hat ?? "none",
    outfit: r.outfit ?? "settler",
    outfitColor: r.outfitColor ?? "royal",
    background: r.background ?? "ocean",
    frame: r.frame ?? "wood",
  };
}

export default function AvatarStudioModal({
  open,
  onClose,
  account,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  account: PlayerAccount;
  onSaved: (updated: PlayerAccount) => void;
}) {
  const [tab, setTab] = useState<StudioTab>("face");
  const [displayName, setDisplayName] = useState(account.display_name);
  const [draftConfig, setDraftConfig] = useState<AvatarConfig>(() =>
    safeResolveConfig(account.avatar_config, account.username)
  );
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const wins = account.stats?.wins ?? 0;
  const winRate = account.stats?.win_rate ?? 0;

  useEffect(() => {
    if (!open) return;
    setDisplayName(account.display_name);
    setDraftConfig(safeResolveConfig(account.avatar_config, account.username));
    setErrorMsg("");
  }, [open, account]);

  const setField = <K extends keyof AvatarConfig>(
    field: K,
    value: AvatarConfig[K]
  ) => {
    if (!isAvatarItemUnlocked(field, value, wins)) return;
    setDraftConfig((prev) => ({ ...prev, [field]: value }));
  };

  const renderOptionGrid = <K extends keyof AvatarConfig>(
    title: string,
    field: K,
    options: readonly AvatarOption<AvatarConfig[K]>[]
  ) => (
    <div className="avatar-section-block">
      <h4>{title}</h4>
      <div className="avatar-options-grid">
        {options.map((opt) => {
          const req = getAvatarItemRequirement(field, opt.value);
          const unlocked = isAvatarItemUnlocked(field, opt.value, wins);
          const remaining = Math.max(0, req - wins);
          const lockCopy =
            remaining === 1
              ? "Falta 1 vitória"
              : `Faltam ${remaining} vitórias`;
          const isSelected = draftConfig[field] === opt.value;

          return (
            <button
              key={opt.value}
              type="button"
              disabled={!unlocked}
              aria-label={
                unlocked ? opt.label : `${opt.label} (Bloqueado: ${lockCopy})`
              }
              className={`avatar-option-btn ${isSelected ? "selected" : ""} ${
                !unlocked ? "locked" : ""
              }`}
              onClick={() => setField(field, opt.value)}
            >
              {opt.swatch && (
                <span
                  className="avatar-option-btn__swatch"
                  style={{
                    background: opt.secondarySwatch
                      ? `linear-gradient(135deg, ${opt.swatch} 0%, ${opt.secondarySwatch} 100%)`
                      : opt.swatch,
                  }}
                />
              )}
              <span className="avatar-option-btn__text">
                <span>{opt.label}</span>
                {!unlocked ? (
                  <small className="avatar-option-btn__lock">🔒 {lockCopy}</small>
                ) : (
                  opt.subtitle && (
                    <small className="avatar-option-btn__sub">{opt.subtitle}</small>
                  )
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const handleSave = async () => {
    const cleanName = displayName.trim();
    if (!cleanName) {
      setErrorMsg("Informe um apelido na mesa.");
      return;
    }
    setSaving(true);
    setErrorMsg("");
    try {
      const updated = await updateProfile({
        displayName: cleanName,
        avatarConfig: draftConfig,
      });
      onSaved(updated);
      onClose();
    } catch (err: any) {
      setErrorMsg(
        err?.response?.data?.description ||
          err?.response?.data?.error ||
          err?.message ||
          "Não foi possível salvar seu perfil."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ className: "avatar-studio-paper" }}
    >
      <DialogTitle className="avatar-studio-header">
        <span>🎨 Personalizar Avatar & Perfil</span>
        <Button
          size="small"
          variant="outlined"
          className="avatar-studio-close-btn"
          onClick={onClose}
        >
          Fechar
        </Button>
      </DialogTitle>

      <DialogContent className="avatar-studio-body">
        {/* Coluna Esquerda: Preview + Apelido + Presets */}
        <div className="avatar-studio-preview-col">
          <PlayerAvatar
            config={draftConfig}
            username={account.username}
            size={120}
            showFrameLabel
          />

          <div className="avatar-studio-stats-pill">
            🏆 {wins} {wins === 1 ? "vitória" : "vitórias"} • {winRate}% aproveitamento
          </div>

          <div className="avatar-studio-name-field">
            <label htmlFor="studio-display-name">Apelido na Mesa</label>
            <input
              id="studio-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={32}
              placeholder="Seu apelido na partida"
            />
          </div>

          <Button
            variant="outlined"
            size="small"
            className="avatar-studio-random-btn"
            onClick={() => setDraftConfig(randomizeUnlockedAvatar(wins))}
          >
            🎲 Aleatório
          </Button>

          <div className="avatar-studio-presets">
            <span className="avatar-studio-presets__title">Modelos Prontos</span>
            <div className="avatar-studio-presets__grid">
              {AVATAR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="avatar-preset-btn"
                  onClick={() =>
                    setDraftConfig((prev) => ({
                      ...preset.config,
                      frame: isAvatarItemUnlocked("frame", prev.frame, wins)
                        ? prev.frame
                        : "wood",
                    }))
                  }
                >
                  <PlayerAvatar
                    config={preset.config}
                    username={preset.id}
                    size={34}
                  />
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Coluna Direita: Abas modulares */}
        <div className="avatar-studio-controls-col">
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            className="avatar-studio-tabs"
          >
            <Tab value="face" label="Rosto" />
            <Tab value="hair" label="Cabelo & Barba" />
            <Tab value="accessories" label="Acessórios" />
            <Tab value="outfit" label="Traje & Fundo" />
            <Tab value="frames" label="🏆 Molduras" />
          </Tabs>

          <div className="avatar-studio-sections">
            {tab === "face" && (
              <>
                {renderOptionGrid("Tom de Pele", "skin", AVATAR_SKIN_OPTIONS)}
                {renderOptionGrid("Expressão & Olhos", "eyes", AVATAR_EYES_OPTIONS)}
              </>
            )}

            {tab === "hair" && (
              <>
                {renderOptionGrid("Estilo de Cabelo", "hair", AVATAR_HAIR_OPTIONS)}
                {renderOptionGrid("Cor do Cabelo", "hairColor", AVATAR_HAIR_COLOR_OPTIONS)}
                {renderOptionGrid("Barba & Bigode", "beard", AVATAR_BEARD_OPTIONS)}
              </>
            )}

            {tab === "accessories" &&
              renderOptionGrid("Chapéus & Coroas", "hat", AVATAR_HAT_OPTIONS)}

            {tab === "outfit" && (
              <>
                {renderOptionGrid("Traje", "outfit", AVATAR_OUTFIT_OPTIONS)}
                {renderOptionGrid("Cor do Traje", "outfitColor", AVATAR_OUTFIT_COLOR_OPTIONS)}
                {renderOptionGrid("Cenário de Fundo", "background", AVATAR_BACKGROUND_OPTIONS)}
              </>
            )}

            {tab === "frames" &&
              renderOptionGrid("Molduras por Mérito no Ranking", "frame", AVATAR_FRAME_OPTIONS)}
          </div>

          {errorMsg && <div className="avatar-studio-error">{errorMsg}</div>}
        </div>
      </DialogContent>

      <DialogActions className="avatar-studio-footer">
        <Button
          variant="outlined"
          className="avatar-studio-cancel-btn"
          onClick={onClose}
        >
          Cancelar
        </Button>
        <Button
          variant="contained"
          className="avatar-studio-save-btn"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? "Salvando..." : "💾 Salvar Perfil"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
