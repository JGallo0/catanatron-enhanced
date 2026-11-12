import { useEffect, useState } from "react";
import cn from "classnames";
import { ClickAwayListener, Popper, Tooltip } from "@mui/material";
import {
  type PlayerState,
  type Card,
  type ResourceCard,
} from "../utils/api.types";
import {
  DEV_CARD_META,
  type DevCardType,
  RESOURCE_META,
} from "../config/assetRegistry";
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
  code: string;
  titleLabel: string;
  ptLabel: string;
}[] = [
  {
    id: "VICTORY_POINT",
    code: "PV",
    titleLabel: "Victory Point",
    ptLabel: "Ponto Vitória",
  },
  { id: "KNIGHT", code: "CAV", titleLabel: "Knight", ptLabel: "Cavaleiro" },
  {
    id: "MONOPOLY",
    code: "MON",
    titleLabel: "Monopoly",
    ptLabel: "Monopólio",
  },
  {
    id: "YEAR_OF_PLENTY",
    code: "FAR",
    titleLabel: "Year of Plenty",
    ptLabel: "Fartura",
  },
  {
    id: "ROAD_BUILDING",
    code: "EST",
    titleLabel: "Road Building",
    ptLabel: "2 Estradas",
  },
];

export default function ResourceCards({
  playerState,
  playerKey,
  compact = false,
  showEmptySlots = false,
  interactiveDevCards = false,
  playableDevCallbacks,
}: {
  playerState: PlayerState;
  playerKey: string;
  compact?: boolean;
  showEmptySlots?: boolean;
  interactiveDevCards?: boolean;
  playableDevCallbacks?: Partial<Record<DevCardType, () => void>>;
}) {
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
        "resource-cards--deck": showEmptySlots,
      })}
      title="Resource Cards"
    >
      {RESOURCES.map((res) => {
        const count = amount(res) ?? 0;
        if (count === 0 && !showEmptySlots) return null;
        const meta = RESOURCE_META[res];
        const lower = res.toLowerCase();

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

      <div className="separator" />

      {DEV_CARDS.map(({ id, code, titleLabel, ptLabel }) => {
        const count = amount(id) ?? 0;
        if (count === 0) return null;
        const meta = DEV_CARD_META[id];
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
                ? `${meta.label} (${count})${canPlay ? " — Clique para jogar" : isNewlyBoughtOnly ? " — Nova (Próx. turno)" : " — +1 PV"}`
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
              "dev-cards center-text card resource-card-item resource-card-item--dev",
              {
                "resource-card-item--deck": showEmptySlots,
                "resource-card-item--playable": canPlay,
                "resource-card-item--locked": isNewlyBoughtOnly,
                "resource-card-item--selected": isInspected,
              }
            )}
            style={{
              borderColor: canPlay ? "#facc15" : meta.accentColor,
            }}
          >
            <CardArtIllustration
              cardType={id}
              className="resource-card-item__bg-art"
            />
            {id === "VICTORY_POINT" && (
              <span
                className="resource-card-item__dev-badge resource-card-item__dev-badge--vp"
                title="+1 Ponto de Vitória secreto"
              >
                +1 PV
              </span>
            )}
            {isNewlyBoughtOnly && (
              <span
                className="resource-card-item__dev-badge resource-card-item__dev-badge--locked"
                title="Comprada neste turno — disponível no próximo turno"
              >
                Nova (Próx. turno)
              </span>
            )}
            {canPlay && (
              <span
                className="resource-card-item__dev-badge resource-card-item__dev-badge--play"
                title="Carta jogável neste turno"
              >
                ▶
              </span>
            )}
            {showEmptySlots ? (
              <div
                className="resource-card-item__deck-chrome"
                title={`${count} ${titleLabel} Card(s)`}
              >
                <div className="resource-card-item__top-row">
                  <span className="resource-card-item__crest">
                    <DevCardIcon card={id} size={13} />
                  </span>
                  <span className="resource-card-item__qty-pill">{count}</span>
                </div>
                <div className="resource-card-item__ribbon">{ptLabel}</div>
              </div>
            ) : (
              <div
                className="resource-card-item__inner"
                title={`${count} ${titleLabel} Card(s)`}
              >
                <div className="resource-card-item__badge">
                  <DevCardIcon card={id} size={compact ? 15 : 18} />
                </div>
                <span className="resource-card-item__count">{count}</span>
                <span className="resource-card-item__label">{code}</span>
              </div>
            )}
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
                      ? "🔒 Nova (Próx. turno): aguarde a próxima rodada para usar."
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
          const meta = DEV_CARD_META[id];
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
                  aria-label={`Carta ${meta.label}`}
                >
                  <div className="dev-card-action-popover__art">
                    <CardArtIllustration cardType={id} />
                  </div>
                  <div className="dev-card-action-popover__info">
                    <strong>{meta.label}</strong>
                    <p>{meta.description}</p>
                    {id === "VICTORY_POINT" && (
                      <span className="dev-card-action-popover__tag dev-card-action-popover__tag--vp">
                        🏆 +1 Ponto de Vitória automático
                      </span>
                    )}
                    {isNewlyBoughtOnly && (
                      <span className="dev-card-action-popover__tag dev-card-action-popover__tag--locked">
                        🔒 Nova (Próx. turno)
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
                          ▶ Jogar Carta
                        </button>
                      )}
                      <button
                        type="button"
                        className="dev-card-action-popover__close-btn"
                        onClick={() => setInspectedDev(null)}
                      >
                        Fechar
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
  return (
    <div
      className={`resource-cards ${compact ? "resource-cards--compact" : ""}`}
      title="Resource Cards"
    >
      {resources !== 0 && (
        <div
          className="hidden-cards center-text card resource-card-item resource-card-item--facedown"
          title={resources + " Resource Card(s), face down"}
        >
          <div className="resource-card-item__bg-art">
            <HybridIllustration
              src="/assets/illustrations/dev/card_back.webp"
              alt="Verso da Carta"
              fallback={null}
            />
          </div>
          <div className="resource-card-item__inner">
            <span className="resource-card-item__count">{resources}</span>
            <span className="resource-card-item__label">REC</span>
          </div>
        </div>
      )}
      {developments !== 0 && (
        <div
          className="dev-cards center-text card resource-card-item resource-card-item--dev-facedown"
          title={developments + " Development Card(s), face down"}
        >
          <div className="resource-card-item__bg-art">
            <HybridIllustration
              src="/assets/illustrations/dev/card_back.webp"
              alt="Verso da Carta"
              fallback={null}
            />
          </div>
          <div className="resource-card-item__inner">
            <span className="resource-card-item__count">{developments}</span>
            <span className="resource-card-item__label">DEV</span>
          </div>
        </div>
      )}
    </div>
  );
}
