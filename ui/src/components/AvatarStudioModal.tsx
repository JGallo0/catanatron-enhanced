import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tab,
  Tabs,
} from "@mui/material";
import type {
  AvatarCatalogEntry,
  AvatarColors,
  AvatarConfig,
  AvatarItemRarity,
  AvatarItemSlot,
  LockedAvatarItem,
} from "../utils/api.types";
import {
  extractLockedAvatarItems,
  updateProfile,
  type PlayerAccount,
} from "../utils/apiClient";
import {
  AVATAR_COLOR_SWATCHES,
  AVATAR_PRESETS,
  findAvatarCatalogItem,
  findLockedAvatarItems,
  getAvatarCatalogBySlot,
  getFrameLabel,
  getGuestProfile,
  isAvatarItemUnlocked,
  localizeGuestDisplayName,
  randomizeUnlockedAvatar,
  resolveAvatarConfig,
  saveGuestProfile,
  stripLockedAvatarItems,
  type GuestProfile,
  type ResolvedAvatarConfig,
} from "../config/avatarCatalog";
import { useLanguage, type AppLanguage } from "../i18n";
import PlayerAvatar from "./PlayerAvatar";
import type { Avatar3DCanvasHandle } from "./avatar3d/Avatar3DCanvas";
import "./AvatarStudioModal.scss";

const Avatar3DCanvas = lazy(() => import("./avatar3d/Avatar3DCanvas"));

type StudioTab =
  | "body_face"
  | "hair_beard"
  | "attire"
  | "gear_props"
  | "mounts_pets"
  | "stage_auras"
  | "frames";

type TierFilter = "all" | "unlocked" | "vip";

type SlotSectionDef = {
  slot: AvatarItemSlot;
  titlePt: string;
  titleEn: string;
};

const TAB_SECTIONS: Record<StudioTab, readonly SlotSectionDef[]> = {
  body_face: [
    { slot: "bodyType", titlePt: "Tipo de Corpo", titleEn: "Body Type" },
    { slot: "headShape", titlePt: "Formato do Rosto", titleEn: "Head Shape" },
    { slot: "eyeStyle", titlePt: "Olhos & Expressão", titleEn: "Eyes & Expression" },
    { slot: "browStyle", titlePt: "Sobrancelhas", titleEn: "Eyebrows" },
    { slot: "noseStyle", titlePt: "Nariz", titleEn: "Nose" },
    { slot: "mouthStyle", titlePt: "Boca", titleEn: "Mouth" },
  ],
  hair_beard: [
    { slot: "hair", titlePt: "Estilo de Cabelo", titleEn: "Hair Style" },
    { slot: "beard", titlePt: "Barba & Bigode", titleEn: "Beard & Mustache" },
  ],
  attire: [
    { slot: "outfit", titlePt: "Traje Principal", titleEn: "Main Outfit" },
    { slot: "legsBoots", titlePt: "Calças & Botas", titleEn: "Legs & Boots" },
    { slot: "cape", titlePt: "Capas & Mantos", titleEn: "Capes & Cloaks" },
  ],
  gear_props: [
    { slot: "hat", titlePt: "Chapéus & Coroas", titleEn: "Hats & Crowns" },
    { slot: "handProp", titlePt: "Item na Mão", titleEn: "Hand Prop" },
    { slot: "backProp", titlePt: "Equipamento nas Costas", titleEn: "Back Gear" },
  ],
  mounts_pets: [
    { slot: "mount", titlePt: "Montarias", titleEn: "Mounts" },
    { slot: "pet", titlePt: "Mascotes", titleEn: "Companions & Pets" },
  ],
  stage_auras: [
    { slot: "pedestal", titlePt: "Pedestal do Palco", titleEn: "Stage Pedestal" },
    { slot: "aura", titlePt: "Aura Mística", titleEn: "Mystic Aura" },
    { slot: "background", titlePt: "Cenário de Fundo", titleEn: "Background Scene" },
  ],
  frames: [
    { slot: "frame", titlePt: "Molduras & Prestígio", titleEn: "Frames & Prestige" },
  ],
};

const SLOT_LABELS: Record<AvatarItemSlot, { pt: string; en: string }> = {
  bodyType: { pt: "Corpo", en: "Body" },
  headShape: { pt: "Rosto", en: "Head" },
  eyeStyle: { pt: "Olhos", en: "Eyes" },
  browStyle: { pt: "Sobrancelhas", en: "Brows" },
  noseStyle: { pt: "Nariz", en: "Nose" },
  mouthStyle: { pt: "Boca", en: "Mouth" },
  hair: { pt: "Cabelo", en: "Hair" },
  beard: { pt: "Barba", en: "Beard" },
  outfit: { pt: "Traje", en: "Outfit" },
  legsBoots: { pt: "Botas", en: "Boots" },
  cape: { pt: "Capa", en: "Cape" },
  hat: { pt: "Chapéu", en: "Hat" },
  handProp: { pt: "Mão", en: "Hand Prop" },
  backProp: { pt: "Costas", en: "Back Gear" },
  pet: { pt: "Mascote", en: "Pet" },
  mount: { pt: "Montaria", en: "Mount" },
  pedestal: { pt: "Pedestal", en: "Pedestal" },
  aura: { pt: "Aura", en: "Aura" },
  background: { pt: "Fundo", en: "Background" },
  frame: { pt: "Moldura", en: "Frame" },
};

export const SLOT_CAMERA_FOCUS: Record<AvatarItemSlot, "full" | "portrait"> = {
  bodyType: "full",
  headShape: "portrait",
  eyeStyle: "portrait",
  browStyle: "portrait",
  noseStyle: "portrait",
  mouthStyle: "portrait",
  hair: "portrait",
  beard: "portrait",
  outfit: "full",
  legsBoots: "full",
  cape: "full",
  hat: "portrait",
  handProp: "full",
  backProp: "full",
  pet: "full",
  mount: "full",
  pedestal: "full",
  aura: "full",
  background: "full",
  frame: "full",
};

export const COLOR_CHANNEL_CAMERA_FOCUS: Record<
  keyof AvatarColors,
  "full" | "portrait"
> = {
  skin: "portrait",
  hair: "portrait",
  eyes: "portrait",
  outfitPrimary: "full",
  outfitSecondary: "full",
  outfitTrim: "full",
  backpack: "full",
  mount: "full",
};

const COLOR_CHANNELS: ReadonlyArray<{
  key: keyof AvatarColors;
  labelPt: string;
  labelEn: string;
}> = [
  { key: "skin", labelPt: "Pele", labelEn: "Skin" },
  { key: "hair", labelPt: "Cabelo / Barba", labelEn: "Hair / Beard" },
  { key: "eyes", labelPt: "Olhos", labelEn: "Eyes" },
  { key: "outfitPrimary", labelPt: "Roupa Principal", labelEn: "Primary Outfit" },
  { key: "outfitSecondary", labelPt: "Secundária", labelEn: "Secondary" },
  { key: "outfitTrim", labelPt: "Detalhes / Metal", labelEn: "Trim / Metal" },
  { key: "backpack", labelPt: "Mochila", labelEn: "Backpack" },
  { key: "mount", labelPt: "Montaria", labelEn: "Mount Coat" },
];

const RARITY_LABELS: Record<AvatarItemRarity, { pt: string; en: string }> = {
  common: { pt: "Comum", en: "Common" },
  rare: { pt: "Raro", en: "Rare" },
  epic: { pt: "Épico", en: "Epic" },
  legendary: { pt: "Lendário", en: "Legendary" },
};

function formatBrlPrice(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function localizeEntry(
  entry: AvatarCatalogEntry,
  language: AppLanguage
): { label: string; subtitle?: string } {
  return {
    label: language === "en" ? entry.labelEn : entry.label,
    subtitle: language === "en" ? entry.subtitleEn ?? entry.subtitle : entry.subtitle,
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
  const avatar3dRef = useRef<Avatar3DCanvasHandle | null>(null);

  const [tab, setTab] = useState<StudioTab>("body_face");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [cameraFocus, setCameraFocus] = useState<"full" | "portrait">("full");

  const initialGuest = account ? null : guestProfile ?? getGuestProfile();
  const [displayName, setDisplayName] = useState(() =>
    account
      ? account.display_name
      : localizeGuestDisplayName(initialGuest!.display_name, language)
  );

  const wins = account ? account.stats?.wins ?? 0 : 0;
  const winRate = account ? account.stats?.win_rate ?? 0 : 0;
  const entitlements = useMemo(
    () => account?.entitlements ?? [],
    [account?.entitlements]
  );

  const computeBaseline = (): ResolvedAvatarConfig => {
    const raw = account
      ? account.avatar_config
      : (guestProfile ?? getGuestProfile()).avatar_config;
    const uname = account
      ? account.username
      : (guestProfile ?? getGuestProfile()).display_name;
    return stripLockedAvatarItems(
      resolveAvatarConfig(raw, uname),
      null,
      wins,
      entitlements
    );
  };

  const [baselineConfig, setBaselineConfig] = useState<ResolvedAvatarConfig>(() =>
    computeBaseline()
  );
  const [draftConfig, setDraftConfig] = useState<ResolvedAvatarConfig>(() =>
    account
      ? resolveAvatarConfig(account.avatar_config, account.username)
      : resolveAvatarConfig(initialGuest!.avatar_config, initialGuest!.display_name)
  );
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [tryOnDialogOpen, setTryOnDialogOpen] = useState(false);
  const [serverLockedItems, setServerLockedItems] = useState<LockedAvatarItem[]>([]);

  const isGuest = !account;
  const effectiveUsername =
    account?.username || displayName || t("visitante", "guest");

  useEffect(() => {
    if (!open) return;
    if (account) {
      setDisplayName(account.display_name);
      const resolved = resolveAvatarConfig(account.avatar_config, account.username);
      setDraftConfig(resolved);
      setBaselineConfig(
        stripLockedAvatarItems(resolved, null, wins, account.entitlements ?? [])
      );
    } else {
      const g = guestProfile ?? getGuestProfile();
      setDisplayName(localizeGuestDisplayName(g.display_name, language));
      const resolved = resolveAvatarConfig(g.avatar_config, g.display_name);
      setDraftConfig(resolved);
      setBaselineConfig(stripLockedAvatarItems(resolved, null, 0, []));
    }
    setErrorMsg("");
    setTryOnDialogOpen(false);
    setServerLockedItems([]);
  }, [open, account, guestProfile, language, wins]);

  useEffect(() => {
    if (open) {
      setCameraFocus("full");
    }
  }, [open]);

  const lockedItems = useMemo(
    () => findLockedAvatarItems(draftConfig, wins, entitlements),
    [draftConfig, wins, entitlements]
  );

  const activeLockedItems =
    serverLockedItems.length > 0 ? serverLockedItems : lockedItems;

  const vipTryOnCount = lockedItems.filter((item) => item.tier === "vip").length;
  const earnableTryOnItems = lockedItems.filter((item) => item.tier === "earnable");

  const setSlotValue = (slot: AvatarItemSlot, value: string) => {
    setServerLockedItems([]);
    setCameraFocus(SLOT_CAMERA_FOCUS[slot]);
    setDraftConfig((prev) => {
      const next: ResolvedAvatarConfig = {
        ...prev,
        version: 2,
        [slot]: value,
      };
      if (slot === "eyeStyle") {
        if (
          value === "calm" ||
          value === "cheerful" ||
          value === "sharp" ||
          value === "wise"
        ) {
          next.eyes = value;
        } else if (value === "fierce") {
          next.eyes = "sharp";
        } else {
          next.eyes = "calm";
        }
      }
      return next;
    });
  };

  const setColorField = (key: keyof AvatarColors, hex: string) => {
    setCameraFocus(COLOR_CHANNEL_CAMERA_FOCUS[key]);
    setDraftConfig((prev) => ({
      ...prev,
      version: 2,
      colors: {
        ...prev.colors,
        [key]: hex,
      },
    }));
  };

  const performSave = async (
    configToSave: ResolvedAvatarConfig,
    cleanName: string
  ) => {
    const snapshot = avatar3dRef.current?.capturePortraitSnapshot() ?? null;
    const payloadConfig: AvatarConfig = {
      ...configToSave,
      ...(snapshot ? { portraitSnapshot: snapshot } : {}),
    };

    if (!account) {
      const savedGuest = saveGuestProfile({
        displayName: cleanName,
        avatarConfig: payloadConfig,
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
        avatarConfig: payloadConfig,
      });
      onSaved?.(updated);
      onClose();
    } catch (err: any) {
      const lockedFromServer = extractLockedAvatarItems(err);
      if (lockedFromServer.length > 0) {
        setServerLockedItems(lockedFromServer);
        setTryOnDialogOpen(true);
      } else {
        setErrorMsg(
          err?.response?.data?.description ||
            err?.response?.data?.error ||
            err?.message ||
            t("Não foi possível salvar seu perfil.", "Could not save your profile.")
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const cleanName = displayName.trim();
    if (!cleanName) {
      setErrorMsg(
        t("Informe um apelido na mesa.", "Please enter a table nickname.")
      );
      return;
    }
    if (cleanName.length < 2) {
      setErrorMsg(
        t(
          "O apelido precisa ter pelo menos 2 caracteres.",
          "Display name must be at least 2 characters."
        )
      );
      return;
    }

    if (lockedItems.length > 0) {
      setServerLockedItems([]);
      setTryOnDialogOpen(true);
      return;
    }

    await performSave(draftConfig, cleanName);
  };

  const handleRemoveLockedAndSave = async () => {
    const cleanName = displayName.trim();
    const cleaned = stripLockedAvatarItems(
      draftConfig,
      baselineConfig,
      wins,
      entitlements
    );
    setDraftConfig(cleaned);
    setServerLockedItems([]);
    setTryOnDialogOpen(false);
    await performSave(cleaned, cleanName);
  };

  const renderSlotSection = (section: SlotSectionDef) => {
    const allItems = getAvatarCatalogBySlot(section.slot);
    const filteredItems = allItems.filter((entry) => {
      if (tierFilter === "vip") return entry.tier === "vip";
      if (tierFilter === "unlocked") {
        return isAvatarItemUnlocked(section.slot, entry.id, wins, entitlements);
      }
      return true;
    });

    if (filteredItems.length === 0) return null;

    const sectionTitle = language === "en" ? section.titleEn : section.titlePt;

    return (
      <div key={section.slot} className="avatar-section-block">
        <h4>{sectionTitle}</h4>
        <div className="avatar-options-grid">
          {filteredItems.map((entry) => {
            const loc = localizeEntry(entry, language);
            const unlocked = isAvatarItemUnlocked(
              section.slot,
              entry.id,
              wins,
              entitlements
            );
            const isSelected = draftConfig[section.slot] === entry.id;
            const rarityLabel =
              language === "en"
                ? RARITY_LABELS[entry.rarity].en
                : RARITY_LABELS[entry.rarity].pt;
            const reqWins = entry.requiredWins;
            const winLockLabel = `${reqWins} ${
              reqWins === 1 ? t("Vitória", "Win") : t("Vitórias", "Wins")
            }`;

            return (
              <button
                key={`${entry.slot}:${entry.id}`}
                type="button"
                aria-pressed={isSelected}
                aria-label={
                  unlocked
                    ? loc.label
                    : entry.tier === "vip"
                      ? `${loc.label} (VIP)`
                      : `${loc.label} (${t("Bloqueado", "Locked")}: ${winLockLabel})`
                }
                className={`avatar-option-btn ${
                  isSelected ? "selected equipped" : ""
                } ${
                  !unlocked
                    ? entry.tier === "vip"
                      ? "locked locked--vip"
                      : "locked locked--earnable"
                    : ""
                }`}
                onClick={() => setSlotValue(section.slot, entry.id)}
              >
                {entry.swatch && (
                  <span
                    className="avatar-option-btn__swatch"
                    style={{
                      background: entry.secondarySwatch
                        ? `linear-gradient(135deg, ${entry.swatch} 0%, ${entry.secondarySwatch} 100%)`
                        : entry.swatch,
                    }}
                  />
                )}
                <span className="avatar-option-btn__text">
                  <span className="avatar-option-btn__name">{loc.label}</span>
                  <span className="avatar-option-btn__badges">
                    {isSelected && (
                      <small className="avatar-badge avatar-badge--equipped">
                        ✓ {t("Equipado", "Equipped")}
                      </small>
                    )}
                    {unlocked ? (
                      <>
                        <small
                          className={`avatar-badge avatar-badge--rarity-${entry.rarity}`}
                        >
                          {rarityLabel}
                        </small>
                        {entry.tier === "vip" && (
                          <small className="avatar-badge avatar-badge--vip-owned">
                            👑 VIP
                          </small>
                        )}
                      </>
                    ) : entry.tier === "vip" ? (
                      <>
                        <small className="avatar-badge avatar-badge--vip">
                          👑 VIP • {t("Em breve na Loja", "Coming Soon to Shop")}
                        </small>
                        {typeof entry.priceBrlCents === "number" && (
                          <small className="avatar-badge avatar-badge--price">
                            {formatBrlPrice(entry.priceBrlCents)}
                          </small>
                        )}
                      </>
                    ) : (
                      <small className="avatar-badge avatar-badge--lock">
                        🔒 {winLockLabel}
                      </small>
                    )}
                  </span>
                  {unlocked && loc.subtitle && (
                    <small className="avatar-option-btn__sub">{loc.subtitle}</small>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const activeSections = TAB_SECTIONS[tab]
    .map((section) => renderSlotSection(section))
    .filter(Boolean);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ className: "avatar-studio-paper" }}
    >
      <DialogTitle className="avatar-studio-header">
        <span>
          🎨 {t("Estúdio 3D — Personalizar Avatar & Perfil", "3D Studio — Customize Avatar & Profile")}
        </span>
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
        {/* Coluna Esquerda: Palco 3D Fixo + Barra Lateral Rolável */}
        <div className="avatar-studio-preview-col">
          <div className="avatar-studio-preview-pinned">
            <div
              className={`avatar-studio-stage avatar-studio-stage--frame-${draftConfig.frame}`}
            >
              <Suspense
                fallback={
                  <div className="avatar-studio-stage__fallback">
                    <PlayerAvatar
                      config={draftConfig}
                      username={effectiveUsername}
                      size={136}
                    />
                  </div>
                }
              >
                <Avatar3DCanvas
                  ref={avatar3dRef}
                  config={draftConfig}
                  mode="studio"
                  cameraFocus={cameraFocus}
                  interactive={true}
                  username={effectiveUsername}
                />
              </Suspense>

              <div className="avatar-studio-stage__overlay-bottom">
                <div className="avatar-studio-camera-toggles">
                  <button
                    type="button"
                    aria-pressed={cameraFocus === "full"}
                    className={`avatar-camera-btn ${
                      cameraFocus === "full" ? "active" : ""
                    }`}
                    onClick={() => setCameraFocus("full")}
                  >
                    {t("Corpo Inteiro", "Full Body")}
                  </button>
                  <button
                    type="button"
                    aria-pressed={cameraFocus === "portrait"}
                    className={`avatar-camera-btn ${
                      cameraFocus === "portrait" ? "active" : ""
                    }`}
                    onClick={() => setCameraFocus("portrait")}
                  >
                    {t("Rosto", "Portrait")}
                  </button>
                </div>
                <span className="avatar-studio-stage__hint">
                  ↻ {t("Arraste para girar 360°", "Drag to rotate 360°")}
                </span>
              </div>
            </div>

            <div className="avatar-studio-frame-pill">
              🏆 {getFrameLabel(draftConfig.frame, language)}
            </div>

            {lockedItems.length > 0 && (
              <div
                className="avatar-studio-tryon-banner"
                role="status"
                data-testid="tryon-mode-banner"
              >
                <div className="avatar-studio-tryon-banner__title">
                  {t(
                    `🧪 Modo Provador — testando ${lockedItems.length} item(ns) bloqueado(s)`,
                    `🧪 Try-On Mode — testing ${lockedItems.length} locked item(s)`
                  )}
                </div>
                <div className="avatar-studio-tryon-banner__tags">
                  {vipTryOnCount > 0 && (
                    <span className="tryon-chip tryon-chip--vip">
                      👑 VIP ({vipTryOnCount})
                    </span>
                  )}
                  {earnableTryOnItems.map((item) => (
                    <span
                      key={`${item.slot}:${item.id}`}
                      className="tryon-chip tryon-chip--wins"
                    >
                      🏆 {item.required_wins}{" "}
                      {t(
                        item.required_wins === 1 ? "Vitória" : "Vitórias",
                        item.required_wins === 1 ? "Win" : "Wins"
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="avatar-studio-sidebar-scroll">
            {/* Cores Livres */}
          <div className="avatar-studio-colors-panel">
            <span className="avatar-studio-section-eyebrow">
              🎨 {t("Cores Livres", "Custom Colors")}
            </span>
            <div className="avatar-colors-list">
              {COLOR_CHANNELS.map((channel) => {
                const label = language === "en" ? channel.labelEn : channel.labelPt;
                const currentHex = draftConfig.colors[channel.key];
                const swatches = AVATAR_COLOR_SWATCHES[channel.key];
                const isHighlighted =
                  (channel.key === "mount" && draftConfig.mount !== "none") ||
                  (channel.key === "backpack" &&
                    draftConfig.backProp === "explorer_pack");

                return (
                  <div
                    key={channel.key}
                    className={`avatar-color-row ${
                      isHighlighted ? "avatar-color-row--highlight" : ""
                    }`}
                  >
                    <div className="avatar-color-row__header">
                      <span className="avatar-color-row__label">{label}</span>
                      <input
                        type="color"
                        className="avatar-color-row__picker"
                        value={currentHex}
                        aria-label={`${label} — ${t(
                          "cor personalizada",
                          "custom color"
                        )}`}
                        onChange={(e) => setColorField(channel.key, e.target.value)}
                      />
                    </div>
                    <div className="avatar-color-row__swatches">
                      {swatches.map((sw) => {
                        const swLabel = language === "en" ? sw.labelEn : sw.label;
                        const active =
                          currentHex.toLowerCase() === sw.hex.toLowerCase();
                        return (
                          <button
                            key={sw.hex}
                            type="button"
                            className={`avatar-color-swatch ${
                              active ? "active" : ""
                            }`}
                            style={{ backgroundColor: sw.hex }}
                            title={swLabel}
                            aria-label={`${label}: ${swLabel}`}
                            aria-pressed={active}
                            onClick={() => setColorField(channel.key, sw.hex)}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

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
              {t("Apelido na Mesa", "Display Name")}
            </label>
            <input
              id="studio-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={32}
              placeholder={t("Seu apelido na partida", "Your in-game display name")}
            />
          </div>

          <Button
            variant="outlined"
            size="small"
            className="avatar-studio-random-btn"
            onClick={() => {
              setServerLockedItems([]);
              setCameraFocus("full");
              setDraftConfig(randomizeUnlockedAvatar(wins, entitlements));
            }}
          >
            🎲 {t("Aleatório", "Randomize")}
          </Button>

          <div className="avatar-studio-presets">
            <span className="avatar-studio-section-eyebrow">
              {t("6 Arquétipos da Ilha", "6 Island Archetypes")}
            </span>
            <div className="avatar-studio-presets__grid">
              {AVATAR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="avatar-preset-btn"
                  onClick={() => {
                    setServerLockedItems([]);
                    setCameraFocus("full");
                    setDraftConfig((prev) => ({
                      ...resolveAvatarConfig(preset.config, effectiveUsername),
                      frame: isAvatarItemUnlocked(
                        "frame",
                        prev.frame,
                        wins,
                        entitlements
                      )
                        ? prev.frame
                        : "wood",
                    }));
                  }}
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
        </div>

        {/* Coluna Direita: 7 Abas Modulares + Filtros de Tier */}
        <div className="avatar-studio-controls-col">
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            className="avatar-studio-tabs"
          >
            <Tab value="body_face" label={t("Corpo & Rosto", "Body & Face")} />
            <Tab value="hair_beard" label={t("Cabelo & Barba", "Hair & Beard")} />
            <Tab value="attire" label={t("Vestimenta", "Attire")} />
            <Tab value="gear_props" label={t("Adereços", "Gear & Props")} />
            <Tab value="mounts_pets" label={t("Montarias & Pets", "Mounts & Pets")} />
            <Tab value="stage_auras" label={t("Palco & Auras", "Stage & Auras")} />
            <Tab value="frames" label={t("🏆 Molduras", "🏆 Frames")} />
          </Tabs>

          <div className="avatar-studio-filter-bar" role="group" aria-label={t("Filtro de itens", "Item filter")}>
            <button
              type="button"
              aria-pressed={tierFilter === "all"}
              className={`avatar-filter-pill ${tierFilter === "all" ? "active" : ""}`}
              onClick={() => setTierFilter("all")}
            >
              {t("Todos", "All")}
            </button>
            <button
              type="button"
              aria-pressed={tierFilter === "unlocked"}
              className={`avatar-filter-pill ${
                tierFilter === "unlocked" ? "active" : ""
              }`}
              onClick={() => setTierFilter("unlocked")}
            >
              {t("Desbloqueados", "Unlocked")}
            </button>
            <button
              type="button"
              aria-pressed={tierFilter === "vip"}
              className={`avatar-filter-pill avatar-filter-pill--vip ${
                tierFilter === "vip" ? "active" : ""
              }`}
              onClick={() => setTierFilter("vip")}
            >
              👑 VIP
            </button>
          </div>

          <div className="avatar-studio-sections">
            {activeSections.length > 0 ? (
              activeSections
            ) : (
              <div className="avatar-studio-empty-filter">
                {t(
                  "Nenhum item nesta categoria corresponde ao filtro atual.",
                  "No items in this category match the current filter."
                )}
              </div>
            )}
          </div>

          {errorMsg && <div className="avatar-studio-error">{errorMsg}</div>}
        </div>

        {/* Option A Try-On Confirmation Overlay */}
        {tryOnDialogOpen && activeLockedItems.length > 0 && (
          <div
            className="avatar-studio-lock-overlay"
            data-testid="tryon-lock-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="tryon-lock-title"
          >
            <div className="avatar-studio-lock-card">
              <h3 id="tryon-lock-title">
                🧪{" "}
                {t(
                  "Itens do Modo Provador não podem ser salvos ainda",
                  "Try-On items cannot be saved yet"
                )}
              </h3>
              <p>
                {t(
                  "Você está testando itens bloqueados na prévia 3D. Você pode removê-los mantendo suas outras escolhas e cores personalizadas, ou continuar no provador.",
                  "You are previewing locked items in 3D. You can remove them while keeping your other unlocked choices and custom colors, or keep trying them on."
                )}
              </p>

              <ul className="avatar-studio-lock-list">
                {activeLockedItems.map((item) => {
                  const catalogEntry = findAvatarCatalogItem(item.slot, item.id);
                  const itemLabel = catalogEntry
                    ? language === "en"
                      ? catalogEntry.labelEn
                      : catalogEntry.label
                    : item.id;
                  const slotLabel =
                    language === "en"
                      ? SLOT_LABELS[item.slot].en
                      : SLOT_LABELS[item.slot].pt;
                  const reasonText =
                    item.tier === "vip"
                      ? `👑 VIP — ${t("Em breve na Loja", "Coming Soon to Shop")}${
                          typeof catalogEntry?.priceBrlCents === "number"
                            ? ` (${formatBrlPrice(catalogEntry.priceBrlCents)})`
                            : ""
                        }`
                      : `🏆 ${t(
                          `Requer ${item.required_wins} ${
                            item.required_wins === 1 ? "vitória" : "vitórias"
                          }`,
                          `Requires ${item.required_wins} ${
                            item.required_wins === 1 ? "win" : "wins"
                          }`
                        )}`;

                  return (
                    <li key={`${item.slot}:${item.id}`}>
                      <div>
                        <strong>{itemLabel}</strong>
                        <small>{slotLabel}</small>
                      </div>
                      <span className="avatar-studio-lock-list__reason">
                        {reasonText}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <div className="avatar-studio-lock-actions">
                <Button
                  variant="outlined"
                  className="avatar-studio-cancel-btn"
                  onClick={() => {
                    setServerLockedItems([]);
                    setTryOnDialogOpen(false);
                  }}
                >
                  {t("Continuar no provador", "Keep trying on")}
                </Button>
                <Button
                  variant="contained"
                  className="avatar-studio-save-btn"
                  disabled={saving}
                  onClick={handleRemoveLockedAndSave}
                >
                  {t("Remover bloqueados e salvar", "Remove locked & save")}
                </Button>
              </div>
            </div>
          </div>
        )}
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
