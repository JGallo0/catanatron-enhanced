import cn from "classnames";

import "./PlayerStateBox.scss";
import { type Color, type PlayerState } from "../utils/api.types";
import ResourceCards from "./ResourceCards";
import { getPlayerColorMeta } from "../config/assetRegistry";
import { useLanguage } from "../i18n";
import {
  AwardStarSvg,
  CitySvgPiece,
  RoadSvgPiece,
  SettlementSvgPiece,
} from "./icons/GameIcons";
import { RoadStatSvg, SwordStatSvg } from "./PlayerTopBar";

export default function PlayerStateBox({
  playerState,
  playerKey,
  color,
  isCurrentTurn = false,
  isBot = false,
  customName,
}: {
  playerState: PlayerState;
  playerKey: string;
  color: Color;
  isCurrentTurn?: boolean;
  isBot?: boolean;
  customName?: string;
}) {
  const { language, t } = useLanguage();
  const actualVps =
    playerState[`${playerKey}_ACTUAL_VICTORY_POINTS`] ??
    playerState[`${playerKey}_VICTORY_POINTS`];
  const hasArmy = Boolean(playerState[`${playerKey}_HAS_ARMY`]);
  const hasRoad = Boolean(playerState[`${playerKey}_HAS_ROAD`]);
  const knightsPlayed = playerState[`${playerKey}_PLAYED_KNIGHT`] ?? 0;
  const longestRoad = playerState[`${playerKey}_LONGEST_ROAD_LENGTH`] ?? 0;
  const settlementsLeft = playerState[`${playerKey}_SETTLEMENTS_AVAILABLE`] ?? 5;
  const citiesLeft = playerState[`${playerKey}_CITIES_AVAILABLE`] ?? 4;
  const roadsLeft = playerState[`${playerKey}_ROADS_AVAILABLE`] ?? 15;

  const builtSettlements = Math.max(0, 5 - settlementsLeft);
  const builtCities = Math.max(0, 4 - citiesLeft);
  const builtRoads = Math.max(0, 15 - roadsLeft);

  const colorMeta = getPlayerColorMeta(language)[color];
  const displayName = customName || colorMeta.label;

  return (
    <div
      className={cn("player-state-box foreground", color, {
        "player-state-box--active": isCurrentTurn,
      })}
      style={{
        borderLeftColor: colorMeta.primary,
      }}
    >
      <div className="player-state-box__header">
        <div className="player-state-box__identity">
          <span
            className="player-state-box__swatch"
            style={{
              background: colorMeta.primary,
              boxShadow: `0 0 8px ${colorMeta.glow}`,
            }}
          />
          <span className="player-state-box__name">{displayName}</span>
          <span className="player-state-box__role-badge">
            {isBot ? "BOT" : t("HUMANO", "HUMAN")}
          </span>
          {isCurrentTurn && (
            <span className="player-state-box__turn-pill">
              {t("vez atual", "current turn")}
            </span>
          )}
        </div>

        <div
          className={cn("victory-points center-text", {
            bold: actualVps >= 10,
          })}
          title={t("Pontos de Vitória", "Victory Points")}
        >
          <span className="victory-points__num">{actualVps}</span>
          <small>{t("PV", "VP")}</small>
        </div>
      </div>

      <ResourceCards
        playerState={playerState}
        playerKey={playerKey}
        compact={true}
      />

      <div
        className="player-pieces-strip"
        title={t(
          `Peças de ${displayName}: ${builtSettlements} Aldeias no mapa (${settlementsLeft} restantes), ${builtCities} Cidades no mapa (${citiesLeft} restantes), ${builtRoads} Estradas no mapa (${roadsLeft} restantes)`,
          `${displayName}'s pieces: ${builtSettlements} Settlements on board (${settlementsLeft} left), ${builtCities} Cities on board (${citiesLeft} left), ${builtRoads} Roads on board (${roadsLeft} left)`
        )}
      >
        <div
          className="player-piece-badge"
          title={t(
            `Aldeias construídas: ${builtSettlements} (Restam ${settlementsLeft} no estoque)`,
            `Settlements built: ${builtSettlements} (${settlementsLeft} left in supply)`
          )}
        >
          <svg
            width="24"
            height="24"
            viewBox="-24 -30 48 52"
            aria-hidden="true"
          >
            <SettlementSvgPiece color={color} scale={1.0} />
          </svg>
          <div className="player-piece-badge__text">
            <strong>{builtSettlements}/5</strong>
            <small>{t("Aldeias", "Settlements")}</small>
          </div>
        </div>

        <div
          className="player-piece-badge"
          title={t(
            `Cidades construídas: ${builtCities} (Restam ${citiesLeft} no estoque)`,
            `Cities built: ${builtCities} (${citiesLeft} left in supply)`
          )}
        >
          <svg
            width="24"
            height="24"
            viewBox="-24 -30 48 52"
            aria-hidden="true"
          >
            <CitySvgPiece color={color} scale={0.96} />
          </svg>
          <div className="player-piece-badge__text">
            <strong>{builtCities}/4</strong>
            <small>{t("Cidades", "Cities")}</small>
          </div>
        </div>

        <div
          className="player-piece-badge"
          title={t(
            `Estradas construídas: ${builtRoads} (Restam ${roadsLeft} no estoque)`,
            `Roads built: ${builtRoads} (${roadsLeft} left in supply)`
          )}
        >
          <span className="player-piece-badge__road-svg" aria-hidden="true">
            <RoadSvgPiece color={color} />
          </span>
          <div className="player-piece-badge__text">
            <strong>{builtRoads}/15</strong>
            <small>{t("Estradas", "Roads")}</small>
          </div>
        </div>
      </div>

      <div className="scores">
        <div
          className={cn("num-knights center-text", {
            bold: hasArmy,
            "score-pill--award": hasArmy,
          })}
          title={
            hasArmy
              ? t(
                  "Cavaleiros Jogados — Maior Exército (+2 PV)",
                  "Knights Played — Largest Army (+2 VP)"
                )
              : t("Cavaleiros Jogados", "Knights Played")
          }
        >
          <SwordStatSvg />
          <span>{knightsPlayed}</span>
          {hasArmy && (
            <AwardStarSvg
              size={13}
              className="score-pill__star"
              label={t("Maior Exército", "Largest Army")}
            />
          )}
          <small>
            {hasArmy ? t("Maior Exército", "Largest Army") : t("Cavaleiros", "Knights")}
          </small>
        </div>

        <div
          className={cn("num-roads center-text", {
            bold: hasRoad,
            "score-pill--award": hasRoad,
          })}
          title={
            hasRoad
              ? t(
                  "Maior Estrada (+2 PV)",
                  "Longest Road (+2 VP)"
                )
              : t("Sequência de Estrada", "Longest Road")
          }
        >
          <RoadStatSvg />
          <span>{longestRoad}</span>
          {hasRoad && (
            <AwardStarSvg
              size={13}
              className="score-pill__star"
              label={t("Maior Estrada", "Longest Road")}
            />
          )}
          <small>
            {hasRoad ? t("Maior Estrada", "Longest Road") : t("Seq. Estrada", "Road Length")}
          </small>
        </div>
      </div>
    </div>
  );
}
