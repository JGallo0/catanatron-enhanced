import { type PlayerState, type Card, type ResourceCard } from "../utils/api.types";
import {
  DEV_CARD_META,
  type DevCardType,
  RESOURCE_META,
} from "../config/assetRegistry";
import {
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
}[] = [
  { id: "VICTORY_POINT", code: "VP", titleLabel: "Victory Point" },
  { id: "KNIGHT", code: "KN", titleLabel: "Knight" },
  { id: "MONOPOLY", code: "MO", titleLabel: "Monopoly" },
  { id: "YEAR_OF_PLENTY", code: "YP", titleLabel: "Year of Plenty" },
  { id: "ROAD_BUILDING", code: "RB", titleLabel: "Road Building" },
];

export default function ResourceCards({
  playerState,
  playerKey,
  compact = false,
}: {
  playerState: PlayerState;
  playerKey: string;
  compact?: boolean;
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
      className={`resource-cards ${compact ? "resource-cards--compact" : ""}`}
      title="Resource Cards"
    >
      {RESOURCES.map((res) => {
        const count = amount(res) ?? 0;
        if (count === 0) return null;
        const meta = RESOURCE_META[res];
        const lower = res.toLowerCase();

        return (
          <div
            key={res}
            className={`${lower}-cards center-text card resource-card-item`}
            title={`${count}x ${meta.label} (${res})`}
            style={{
              borderColor: meta.borderColor,
              background: `linear-gradient(160deg, ${meta.secondaryColor} 0%, ${meta.primaryColor} 100%)`,
            }}
          >
            <div className="resource-card-item__inner">
              <HybridIllustration
                src={meta.customCardIllustration}
                alt={meta.label}
                className="resource-card-item__custom-art"
                fallback={
                  <ResourceIcon resource={res} size={compact ? 16 : 22} />
                }
              />
              <span className="resource-card-item__count">{count}</span>
              {!compact && (
                <span className="resource-card-item__label">
                  {meta.shortLabel}
                </span>
              )}
            </div>
          </div>
        );
      })}

      <div className="separator" />

      {DEV_CARDS.map(({ id, code, titleLabel }) => {
        const count = amount(id) ?? 0;
        if (count === 0) return null;
        const meta = DEV_CARD_META[id];

        return (
          <div
            key={id}
            className="dev-cards center-text card resource-card-item resource-card-item--dev"
            title={`${count} ${titleLabel} Card(s)`}
            style={{
              borderColor: meta.accentColor,
            }}
          >
            <div className="resource-card-item__inner">
              <DevCardIcon card={id} size={compact ? 15 : 19} />
              <span className="resource-card-item__count">{count}</span>
              <span className="resource-card-item__label">{code}</span>
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
