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
import type { AvatarConfig, AvatarConfigV1 } from "../utils/api.types";
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
  getGuestProfile,
  isAvatarItemUnlocked,
  localizeAvatarOption,
  localizeGuestDisplayName,
  randomizeUnlockedAvatar,
  resolveAvatarConfig,
  saveGuestProfile,
  type AvatarOption,
  type GuestProfile,
} from "../config/avatarCatalog";
import { useLanguage } from "../i18n";
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
  guestProfile,
  onSaved,
  onGuestSaved,
}: {
  open: boolean;
  onClose: () => void;
  account: PlayerAccount | null;
  guestProfile?: GuestProfile;
  onSaved?: (updated: PlayerAccount) => void;
  onGuestSaved?: (saved: GuestProfile) => void;
}) {
  const { language, t } = useLanguage();
  const [tab, setTab] = useState<StudioTab>("face");
  const initialGuest = account ? null : guestProfile ?? getGuestProfile();
  const [displayName, setDisplayName] = useState(
    account
      ? account.display_name
      : localizeGuestDisplayName(initialGuest!.display_name, language)
  );
  const [draftConfig, setDraftConfig] = useState<AvatarConfig>(() =>
    account
      ? safeResolveConfig(account.avatar_config, account.username)
      : safeResolveConfig(initialGuest!.avatar_config, initialGuest!.display_name)
  );
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const isGuest = !account;
  const wins = account ? account.stats?.wins ?? 0 : 0;
  const winRate = account ? account.stats?.win_rate ?? 0 : 0;

  useEffect(() => {
    if (!open) return;
    if (account) {
      setDisplayName(account.display_name);
      setDraftConfig(safeResolveConfig(account.avatar_config, account.username));
    } else {
      const g = guestProfile ?? getGuestProfile();
      setDisplayName(localizeGuestDisplayName(g.display_name, language));
      setDraftConfig(safeResolveConfig(g.avatar_config, g.display_name));
    }
    setErrorMsg("");
  }, [open, account, guestProfile, language]);

  const setField = <K extends keyof AvatarConfigV1>(
    field: K,
    value: AvatarConfigV1[K]
  ) => {
    if (!isAvatarItemUnlocked(field, value, wins)) return;
    setDraftConfig((prev) => ({ ...prev, [field]: value }));
  };

  const renderOptionGrid = <K extends keyof AvatarConfigV1>(
    title: string,
    field: K,
    options: readonly AvatarOption<AvatarConfigV1[K]>[]
  ) => (
    <div className="avatar-section-block">
      <h4>{title}</h4>
      <div className="avatar-options-grid">
        {options.map((rawOpt) => {
          const opt = localizeAvatarOption(rawOpt, language);
          const req = getAvatarItemRequirement(field, opt.value);
          const unlocked = isAvatarItemUnlocked(field, opt.value, wins);
          const remaining = Math.max(0, req - wins);
          const lockCopy =
            remaining === 1
              ? t("Falta 1 vitória", "1 more win needed")
              : t(`Faltam ${remaining} vitórias`, `${remaining} more wins needed`);
          const isSelected = draftConfig[field] === opt.value;

          return (
            <button
              key={opt.value}
              type="button"
              disabled={!unlocked}
              aria-label={
                unlocked
                  ? opt.label
                  : `${opt.label} (${t("Bloqueado", "Locked")}: ${lockCopy})`
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
      setErrorMsg(
        t("Informe um apelido na mesa.", "Please enter a table nickname.")
      );
      return;
    }
    if (!account) {
      const savedGuest = saveGuestProfile({
        displayName: cleanName,
        avatarConfig: draftConfig,
      });
      onGuestSaved?.(savedGuest);
      onClose();
      return;
    }
    setSaving(true);
    setErrorMsg("");
    try {
      const updated = await updateProfile({
        displayName: cleanName,
        avatarConfig: draftConfig,
      });
      onSaved?.(updated);
      onClose();
    } catch (err: any) {
      setErrorMsg(
        err?.response?.data?.description ||
          err?.response?.data?.error ||
          err?.message ||
          t("Não foi possível salvar seu perfil.", "Could not save your profile.")
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
        <span>🎨 {t("Personalizar Avatar & Perfil", "Customize Avatar & Profile")}</span>
        <Button
          size="small"
          variant="outlined"
          className="avatar-studio-close-btn"
          onClick={onClose}
        >
          {t("Fechar", "Close")}
        </Button>
      </DialogTitle>

      <DialogContent className="avatar-studio-body">
        {/* Coluna Esquerda: Preview + Apelido + Presets */}
        <div className="avatar-studio-preview-col">
          <PlayerAvatar
            config={draftConfig}
            username={account?.username || displayName || t("visitante", "guest")}
            size={120}
            showFrameLabel
          />

          {isGuest ? (
            <div className="avatar-studio-stats-pill avatar-studio-stats-pill--guest">
              🧭{" "}
              {t(
                "Visitante • Salvo neste navegador (entre na conta para liberar molduras do ranking)",
                "Guest • Saved in this browser (sign in to unlock ranking frames)"
              )}
            </div>
          ) : (
            <div className="avatar-studio-stats-pill">
              🏆 {wins}{" "}
              {t(wins === 1 ? "vitória" : "vitórias", wins === 1 ? "win" : "wins")}{" "}
              • {winRate}% {t("aproveitamento", "win rate")}
            </div>
          )}

          <div className="avatar-studio-name-field">
            <label htmlFor="studio-display-name">
              {t("Apelido na Mesa", "Table Nickname")}
            </label>
            <input
              id="studio-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={32}
              placeholder={t("Seu apelido na partida", "Your in-game nickname")}
            />
          </div>

          <Button
            variant="outlined"
            size="small"
            className="avatar-studio-random-btn"
            onClick={() => setDraftConfig(randomizeUnlockedAvatar(wins))}
          >
            🎲 {t("Aleatório", "Randomize")}
          </Button>

          <div className="avatar-studio-presets">
            <span className="avatar-studio-presets__title">
              {t("Modelos Prontos", "Ready Presets")}
            </span>
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
                  <span>{language === "en" ? preset.labelEn : preset.label}</span>
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
            <Tab value="face" label={t("Rosto", "Face")} />
            <Tab value="hair" label={t("Cabelo & Barba", "Hair & Beard")} />
            <Tab value="accessories" label={t("Acessórios", "Accessories")} />
            <Tab value="outfit" label={t("Traje & Fundo", "Outfit & Background")} />
            <Tab value="frames" label={t("🏆 Molduras", "🏆 Frames")} />
          </Tabs>

          <div className="avatar-studio-sections">
            {tab === "face" && (
              <>
                {renderOptionGrid(t("Tom de Pele", "Skin Tone"), "skin", AVATAR_SKIN_OPTIONS)}
                {renderOptionGrid(
                  t("Expressão & Olhos", "Expression & Eyes"),
                  "eyes",
                  AVATAR_EYES_OPTIONS
                )}
              </>
            )}

            {tab === "hair" && (
              <>
                {renderOptionGrid(
                  t("Estilo de Cabelo", "Hair Style"),
                  "hair",
                  AVATAR_HAIR_OPTIONS
                )}
                {renderOptionGrid(
                  t("Cor do Cabelo", "Hair Color"),
                  "hairColor",
                  AVATAR_HAIR_COLOR_OPTIONS
                )}
                {renderOptionGrid(
                  t("Barba & Bigode", "Beard & Mustache"),
                  "beard",
                  AVATAR_BEARD_OPTIONS
                )}
              </>
            )}

            {tab === "accessories" &&
              renderOptionGrid(
                t("Chapéus & Coroas", "Hats & Crowns"),
                "hat",
                AVATAR_HAT_OPTIONS
              )}

            {tab === "outfit" && (
              <>
                {renderOptionGrid(t("Traje", "Outfit"), "outfit", AVATAR_OUTFIT_OPTIONS)}
                {renderOptionGrid(
                  t("Cor do Traje", "Outfit Color"),
                  "outfitColor",
                  AVATAR_OUTFIT_COLOR_OPTIONS
                )}
                {renderOptionGrid(
                  t("Cenário de Fundo", "Background"),
                  "background",
                  AVATAR_BACKGROUND_OPTIONS
                )}
              </>
            )}

            {tab === "frames" &&
              renderOptionGrid(
                t("Molduras por Mérito no Ranking", "Merit Frames"),
                "frame",
                AVATAR_FRAME_OPTIONS
              )}
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
          {t("Cancelar", "Cancel")}
        </Button>
        <Button
          variant="contained"
          className="avatar-studio-save-btn"
          disabled={saving}
          onClick={handleSave}
        >
          {saving
            ? t("Salvando...", "Saving...")
            : account
              ? t("💾 Salvar Perfil", "💾 Save Profile")
              : t("💾 Salvar Avatar", "💾 Save Avatar")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
