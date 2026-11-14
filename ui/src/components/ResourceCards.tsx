import { useEffect, useState } from "react";
import cn from "classnames";
import { ClickAwayListener, Popper, Tooltip } from "@mui/material";
import {
  type PlayerState,
  type Card,
  type ResourceCard,
} from "../utils/api.types";
import {
  getDevCardMeta,
  getResourceMeta,
  type DevCardType,
} from "../config/assetRegistry";
import { useLanguage } from "../i18n";
import {
  CardArtIllustration,
  DevCardIcon,
  HybridIllustration,
  ResourceIcon,
} from "./icons/GameIcons";

import "./PlayerStateBox.scss";

const RESOURCES: ResourceCard[] = ["WOOD", "BRICK", "SHEEP", "WHEAT", "ORE"];

const DEV_CARDS: {
  id: DevCardType;
  codePt: string;
  codeEn: string;
  shortPt: string;
  shortEn: string;
}[] = [
  {
    id: "VICTORY_POINT",
    codePt: "PV",
    codeEn: "VP",
    shortPt: "Ponto Vitória",
    shortEn: "Victory Point",
  },
  {
    id: "KNIGHT",
    codePt: "CAV",
    codeEn: "KNT",
    shortPt: "Cavaleiro",
    shortEn: "Knight",
  },
  {
    id: "MONOPOLY",
    codePt: "MON",
    codeEn: "MON",
    shortPt: "Monopólio",
    shortEn: "Monopoly",
  },
  {
    id: "YEAR_OF_PLENTY",
    codePt: "FAR",
    codeEn: "YOP",
    shortPt: "Fartura",
    shortEn: "Year of Plenty",
  },
  {
    id: "ROAD_BUILDING",
    codePt: "EST",
    codeEn: "RDB",
    shortPt: "2 Estradas",
    shortEn: "Road Building",
  },
];

export default function ResourceCards({
  playerState,
  playerKey,
  compact = false,
  showEmptySlots = false,
  iconOnly = false,
  interactiveDevCards = false,
  playableDevCallbacks,
}: {
  playerState: PlayerState;
  playerKey: string;
  compact?: boolean;
  showEmptySlots?: boolean;
  iconOnly?: boolean;
  interactiveDevCards?: boolean;
  playableDevCallbacks?: Partial<Record<DevCardType, () => void>>;
}) {
  const { language, t } = useLanguage();
  const resourceMeta = getResourceMeta(language);
  const devCardMeta = getDevCardMeta(language);
  const [inspectedDev, setInspectedDev] = useState<{
    id: DevCardType;
    anchorEl: HTMLElement | null;
  } | null>(null);

  const amount = (card: Card): number | undefined =>
    playerState[`${playerKey}_${card}_IN_HAND`];

  useEffect(() => {
    if (!inspectedDev) return;
    if ((playerState[`${playerKey}_${inspectedDev.id}_IN_HAND`] ?? 0) <= 0) {
      setInspectedDev(null);
    }
  }, [inspectedDev, playerKey, playerState]);

  // Seen from another seat, this hand arrives as two counts instead of cards.
  if (amount("WOOD") === undefined) {
    return (
      <FaceDownCards
        resources={playerState[`${playerKey}_NUM_RESOURCES_IN_HAND`] ?? 0}
        developments={
          playerState[`${playerKey}_NUM_DEVELOPMENT_CARDS_IN_HAND`] ?? 0
        }
        compact={compact}
      />
    );
  }

  return (
    <div
      className={cn("resource-cards", {
        "resource-cards--compact": compact,
        "resource-cards--deck": showEmptySlots && !iconOnly,
        "resource-cards--icons": iconOnly,
      })}
      title={t("Cartas de Recurso", "Resource Cards")}
    >
      {RESOURCES.map((res) => {
        const count = amount(res) ?? 0;
        if (count === 0 && !showEmptySlots) return null;
        const meta = resourceMeta[res];
        const lower = res.toLowerCase();

        if (iconOnly) {
          return (
            <div
              key={res}
              className={cn("hand-resource-icon", { "is-empty": count === 0 })}
              role="img"
              aria-label={`${meta.label} (${count})`}
              title={`${meta.label} · ${count}`}
            >
              <ResourceIcon resource={res} size={23} />
              <span>{count}</span>
            </div>
          );
        }

        return (
          <div
            key={res}
            className={cn(
              `${lower}-cards center-text card resource-card-item`,
              {
                "resource-card-item--deck": showEmptySlots,
                "resource-card-item--empty": showEmptySlots && count === 0,
              }
            )}
            title={`${count}x ${meta.label} (${res})`}
            style={{
              borderColor:
                showEmptySlots && count === 0
                  ? "rgba(148, 163, 184, 0.25)"
                  : meta.borderColor,
              background: `linear-gradient(160deg, ${meta.secondaryColor} 0%, ${meta.primaryColor} 100%)`,
            }}
          >
            <CardArtIllustration
              resource={res}
              className="resource-card-item__bg-art"
            />
            {showEmptySlots ? (
              <div className="resource-card-item__deck-chrome">
                <div className="resource-card-item__top-row">
                  <span className="resource-card-item__crest">
                    <ResourceIcon resource={res} size={13} />
                  </span>
                  <span
                    className={cn("resource-card-item__qty-pill", {
                      "resource-card-item__qty-pill--zero": count === 0,
                    })}
                  >
                    {count}
                  </span>
                </div>
                <div className="resource-card-item__ribbon">{meta.label}</div>
              </div>
            ) : (
              <div className="resource-card-item__inner">
                <div className="resource-card-item__badge">
                  <ResourceIcon resource={res} size={compact ? 15 : 18} />
                </div>
                <span className="resource-card-item__count">{count}</span>
                {!compact && (
                  <span className="resource-card-item__label">
                    {meta.shortLabel}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}

      {(!iconOnly || DEV_CARDS.some(({ id }) => (amount(id) ?? 0) > 0)) && <div className="separator" />}

      {DEV_CARDS.map(({ id, codePt, codeEn, shortPt, shortEn }) => {
        const count = amount(id) ?? 0;
        if (count === 0) return null;
        const meta = devCardMeta[id];
        const shortName = language === "en" ? shortEn : shortPt;
        const code = language === "en" ? codeEn : codePt;
        const playCallback = playableDevCallbacks?.[id];
        const canPlay = Boolean(interactiveDevCards && playCallback);
        const boughtThisTurnCount = Number(
          playerState[`${playerKey}_${id}_BOUGHT_THIS_TURN`] ?? 0
        );
        const ownedAtStart = playerState[`${playerKey}_${id}_OWNED_AT_START`];
        const isNewlyBoughtOnly =
          id !== "VICTORY_POINT" &&
          !canPlay &&
          (boughtThisTurnCount >= count || ownedAtStart === false);
        const isInspected = Boolean(
          interactiveDevCards && inspectedDev?.id === id
        );

        const cardNode = (
          <div
            role={interactiveDevCards ? "button" : undefined}
            tabIndex={interactiveDevCards ? 0 : undefined}
            aria-label={
              interactiveDevCards
                ? `${meta.label} (${count})${
                    canPlay
                      ? t(" — Clique para jogar", " — Click to play")
                      : isNewlyBoughtOnly
                        ? t(" — Nova (Próx. turno)", " — New (Next turn)")
                        : t(" — +1 PV", " — +1 VP")
                  }`
                : undefined
            }
            onClick={
              interactiveDevCards
                ? (e) => {
                    const targetEl = e.currentTarget;
                    setInspectedDev((prev) =>
                      prev?.id === id ? null : { id, anchorEl: targetEl }
                    );
                  }
                : undefined
            }
            onKeyDown={
              interactiveDevCards
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      const targetEl = e.currentTarget;
                      setInspectedDev((prev) =>
                        prev?.id === id ? null : { id, anchorEl: targetEl }
                      );
                    }
                  }
                : undefined
            }
            className={cn(
              "dev-cards",
              iconOnly ? "hand-resource-icon hand-resource-icon--dev" : "center-text card resource-card-item resource-card-item--dev",
              {
                "resource-card-item--deck": showEmptySlots && !iconOnly,
                "resource-card-item--playable": canPlay,
                "resource-card-item--locked": isNewlyBoughtOnly,
                "resource-card-item--selected": isInspected,
              }
            )}
            style={{
              borderColor: canPlay ? "#facc15" : meta.accentColor,
            }}
          >
            {iconOnly ? (
              <>
                <DevCardIcon card={id} size={22} />
                <span>{count}</span>
              </>
            ) : <>
            <CardArtIllustration
              cardType={id}
              className="resource-card-item__bg-art"
            />
            {id === "VICTORY_POINT" && (
              <span
                className="resource-card-item__dev-badge resource-card-item__dev-badge--vp"
                title={t("+1 Ponto de Vitória secreto", "+1 secret Victory Point")}
              >
                {t("+1 PV", "+1 VP")}
              </span>
            )}
            {isNewlyBoughtOnly && (
              <span
                className="resource-card-item__dev-badge resource-card-item__dev-badge--locked"
                title={t(
                  "Comprada neste turno — disponível no próximo turno",
                  "Bought this turn — available next turn"
                )}
              >
                {t("Nova (Próx. turno)", "New (Next turn)")}
              </span>
            )}
            {canPlay && (
              <span
                className="resource-card-item__dev-badge resource-card-item__dev-badge--play"
                title={t("Carta jogável neste turno", "Playable this turn")}
              >
                ▶
              </span>
            )}
            {showEmptySlots ? (
              <div
                className="resource-card-item__deck-chrome"
                title={t(
                  `${count} carta(s) de ${meta.label}`,
                  `${count} ${meta.label} Card(s)`
                )}
              >
                <div className="resource-card-item__top-row">
                  <span className="resource-card-item__crest">
                    <DevCardIcon card={id} size={13} />
                  </span>
                  <span className="resource-card-item__qty-pill">{count}</span>
                </div>
                <div className="resource-card-item__ribbon">{shortName}</div>
              </div>
            ) : (
              <div
                className="resource-card-item__inner"
                title={t(
                  `${count} carta(s) de ${meta.label}`,
                  `${count} ${meta.label} Card(s)`
                )}
              >
                <div className="resource-card-item__badge">
                  <DevCardIcon card={id} size={compact ? 15 : 18} />
                </div>
                <span className="resource-card-item__count">{count}</span>
                <span className="resource-card-item__label">{code}</span>
              </div>
            )}
            </>}
          </div>
        );

        return (
          <Tooltip
            key={id}
            placement="top"
            arrow
            disableHoverListener={isInspected}
            title={
              <div
                style={{
                  width: 210,
                  height: 280,
                  borderRadius: 10,
                  overflow: "hidden",
                  boxShadow: "0 12px 28px rgba(0,0,0,0.85)",
                  border: `2px solid ${meta.accentColor}`,
                  position: "relative",
                  background: "#0f172a",
                }}
              >
                <CardArtIllustration cardType={id} />
                <div
                  style={{
                    position: "absolute",
                    inset: "auto 0 0 0",
                    padding: "8px 10px",
                    background:
                      "linear-gradient(180deg, transparent 0%, rgba(2,6,23,0.94) 35%)",
                    color: "#f8fafc",
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: "0.85rem" }}>
                    {meta.label}
                  </div>
                  <div
                    style={{
                      fontSize: "0.68rem",
                      color: "#cbd5e1",
                      lineHeight: 1.25,
                      marginTop: 2,
                    }}
                  >
                    {isNewlyBoughtOnly
                      ? t(
                          "🔒 Nova (Próx. turno): aguarde a próxima rodada para usar.",
                          "🔒 New (Next turn): wait until next turn to play."
                        )
                      : meta.description}
                  </div>
                </div>
              </div>
            }
            slotProps={{
              tooltip: {
                sx: {
                  p: 0,
                  bgcolor: "transparent",
                  maxWidth: "none",
                },
              },
            }}
          >
            {cardNode}
          </Tooltip>
        );
      })}

      {interactiveDevCards &&
        inspectedDev &&
        inspectedDev.anchorEl &&
        (() => {
          const id = inspectedDev.id;
          const meta = devCardMeta[id];
          const playCallback = playableDevCallbacks?.[id];
          const canPlay = Boolean(playCallback);
          const count = amount(id) ?? 0;
          const boughtThisTurnCount = Number(
            playerState[`${playerKey}_${id}_BOUGHT_THIS_TURN`] ?? 0
          );
          const ownedAtStart = playerState[`${playerKey}_${id}_OWNED_AT_START`];
          const isNewlyBoughtOnly =
            id !== "VICTORY_POINT" &&
            !canPlay &&
            (boughtThisTurnCount >= count || ownedAtStart === false);

          return (
            <Popper
              open={true}
              anchorEl={inspectedDev.anchorEl}
              placement="top"
              className="dev-card-action-popper"
            >
              <ClickAwayListener onClickAway={() => setInspectedDev(null)}>
                <div
                  className="dev-card-action-popover"
                  role="dialog"
                  aria-label={t(`Carta ${meta.label}`, `${meta.label} Card`)}
                >
                  <div className="dev-card-action-popover__art">
                    <CardArtIllustration cardType={id} />
                  </div>
                  <div className="dev-card-action-popover__info">
                    <strong>{meta.label}</strong>
                    <p>{meta.description}</p>
                    {id === "VICTORY_POINT" && (
                      <span className="dev-card-action-popover__tag dev-card-action-popover__tag--vp">
                        🏆 {t("+1 Ponto de Vitória automático", "+1 automatic Victory Point")}
                      </span>
                    )}
                    {isNewlyBoughtOnly && (
                      <span className="dev-card-action-popover__tag dev-card-action-popover__tag--locked">
                        🔒 {t("Nova (Próx. turno)", "New (Next turn)")}
                      </span>
                    )}
                    <div className="dev-card-action-popover__actions">
                      {canPlay && playCallback && (
                        <button
                          type="button"
                          className="dev-card-action-popover__play-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectedDev(null);
                            playCallback();
                          }}
                        >
                          ▶ {t("Jogar Carta", "Play card")}
                        </button>
                      )}
                      <button
                        type="button"
                        className="dev-card-action-popover__close-btn"
                        onClick={() => setInspectedDev(null)}
                      >
                        {t("Fechar", "Close")}
                      </button>
                    </div>
                  </div>
                </div>
              </ClickAwayListener>
            </Popper>
          );
        })()}
    </div>
  );
}

function FaceDownCards({
  resources,
  developments,
  compact = false,
}: {
  resources: number;
  developments: number;
  compact?: boolean;
}) {
  const { t } = useLanguage();

  return (
    <div
      className={`resource-cards ${compact ? "resource-cards--compact" : ""}`}
      title={t("Cartas de Recurso", "Resource Cards")}
    >
      {resources !== 0 && (
        <div
          className="hidden-cards center-text card resource-card-item resource-card-item--facedown"
          title={t(
            `${resources} carta(s) de recurso, virada(s) para baixo`,
            `${resources} Resource Card(s), face down`
          )}
        >
          <div className="resource-card-item__bg-art">
            <HybridIllustration
              src="/assets/illustrations/dev/card_back.webp"
              alt={t("Verso da Carta", "Card Back")}
              fallback={null}
            />
          </div>
          <div className="resource-card-item__inner">
            <span className="resource-card-item__count">{resources}</span>
            <span className="resource-card-item__label">{t("REC", "RES")}</span>
          </div>
        </div>
      )}
      {developments !== 0 && (
        <div
          className="dev-cards center-text card resource-card-item resource-card-item--dev-facedown"
          title={t(
            `${developments} carta(s) de desenvolvimento, virada(s) para baixo`,
            `${developments} Development Card(s), face down`
          )}
        >
          <div className="resource-card-item__bg-art">
            <HybridIllustration
              src="/assets/illustrations/dev/card_back.webp"
              alt={t("Verso da Carta", "Card Back")}
              fallback={null}
            />
          </div>
          <div className="resource-card-item__inner">
            <span className="resource-card-item__count">{developments}</span>
            <span className="resource-card-item__label">{t("DEV", "DEV")}</span>
          </div>
        </div>
      )}
    </div>
  );
}
