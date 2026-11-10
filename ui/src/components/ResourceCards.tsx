import cn from "classnames";
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
            {showEmptySlots && (
              <CardArtIllustration
                resource={res}
                className="resource-card-item__bg-art"
              />
            )}
            <div className="resource-card-item__inner">
              <div className="resource-card-item__badge">
                <HybridIllustration
                  src={meta.customCardIllustration}
                  alt={meta.label}
                  className="resource-card-item__custom-art"
                  fallback={
                    <ResourceIcon
                      resource={res}
                      size={compact ? 15 : showEmptySlots ? 22 : 20}
                    />
                  }
                />
              </div>
              <span className="resource-card-item__count">
                {showEmptySlots ? `×${count}` : count}
              </span>
              {!compact && (
                <span className="resource-card-item__label">
                  {showEmptySlots ? meta.label : meta.shortLabel}
                </span>
              )}
            </div>
          </div>
        );
      })}

      <div className="separator" />

      {DEV_CARDS.map(({ id, code, titleLabel, ptLabel }) => {
        const count = amount(id) ?? 0;
        if (count === 0) return null;
        const meta = DEV_CARD_META[id];

        return (
          <div
            key={id}
            className={cn(
              "dev-cards center-text card resource-card-item resource-card-item--dev",
              {
                "resource-card-item--deck": showEmptySlots,
              }
            )}
            title={`${count} ${titleLabel} Card(s)`}
            style={{
              borderColor: meta.accentColor,
            }}
          >
            <div className="resource-card-item__inner">
              <div className="resource-card-item__badge">
                <DevCardIcon
                  card={id}
                  size={compact ? 15 : showEmptySlots ? 20 : 18}
                />
              </div>
              <span className="resource-card-item__count">
                {showEmptySlots ? `×${count}` : count}
              </span>
              <span className="resource-card-item__label">
                {showEmptySlots ? ptLabel : code}
              </span>
            </div>
          </div>
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
          <div className="resource-card-item__inner">
            <span className="resource-card-item__count">{developments}</span>
            <span className="resource-card-item__label">DEV</span>
          </div>
        </div>
      )}
    </div>
  );
}
