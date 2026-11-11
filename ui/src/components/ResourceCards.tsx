import cn from "classnames";
import { Tooltip } from "@mui/material";
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
}: {
  playerState: PlayerState;
  playerKey: string;
  compact?: boolean;
  showEmptySlots?: boolean;
}) {
  const amount = (card: Card): number | undefined =>
    playerState[`${playerKey}_${card}_IN_HAND`];

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

        return (
          <Tooltip
            key={id}
            placement="top"
            arrow
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
                    {meta.description}
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
            <div
              className={cn(
                "dev-cards center-text card resource-card-item resource-card-item--dev",
                {
                  "resource-card-item--deck": showEmptySlots,
                }
              )}
              style={{
                borderColor: meta.accentColor,
              }}
            >
              <CardArtIllustration
                cardType={id}
                className="resource-card-item__bg-art"
              />
              {showEmptySlots ? (
                <div
                  className="resource-card-item__deck-chrome"
                  title={`${count} ${titleLabel} Card(s)`}
                >
                  <div className="resource-card-item__top-row">
                    <span className="resource-card-item__crest">
                      <DevCardIcon card={id} size={13} />
                    </span>
                    <span className="resource-card-item__qty-pill">
                      {count}
                    </span>
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
          </Tooltip>
        );
      })}
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
