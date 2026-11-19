import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import VictoryScreenOverlay from "./VictoryScreenOverlay";
import {
  applyAvatarCombinationAndPose,
  createAvatarRig,
  createRoyalThroneGroup,
} from "./avatar3d/sceneComposer";
import { resolveAvatarConfig } from "../config/avatarCatalog";
import { I18nProvider } from "../i18n";
import type { GameState } from "../utils/api.types";

afterEach(() => {
  cleanup();
});

function makeVictoryGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    tiles: [],
    adjacent_tiles: {},
    nodes: {},
    edges: [],
    bot_colors: ["BLUE", "WHITE", "ORANGE"],
    colors: ["RED", "BLUE", "WHITE", "ORANGE"],
    current_color: "RED",
    winning_color: "RED",
    current_prompt: "PLAY_TURN",
    is_initial_build_phase: false,
    robber_coordinate: [0, 0, 0],
    state_index: 120,
    seat_names: {
      RED: "Soberana Helena",
      BLUE: "Duque Marco",
      WHITE: "Almirante Kael",
      ORANGE: "Barão Thorne",
    },
    player_state: {
      P0_ACTUAL_VICTORY_POINTS: 10,
      P0_SETTLEMENTS_AVAILABLE: 2,
      P0_CITIES_AVAILABLE: 2,
      P0_ROADS_AVAILABLE: 6,
      P0_LONGEST_ROAD_LENGTH: 9,
      P0_PLAYED_KNIGHT: 2,
      P0_HAS_ROAD: true,
      P0_HAS_ARMY: false,
      P1_ACTUAL_VICTORY_POINTS: 8,
      P1_SETTLEMENTS_AVAILABLE: 3,
      P1_CITIES_AVAILABLE: 2,
      P1_ROADS_AVAILABLE: 8,
      P1_LONGEST_ROAD_LENGTH: 6,
      P1_PLAYED_KNIGHT: 4,
      P1_HAS_ROAD: false,
      P1_HAS_ARMY: true,
      P2_ACTUAL_VICTORY_POINTS: 7,
      P2_SETTLEMENTS_AVAILABLE: 2,
      P2_CITIES_AVAILABLE: 3,
      P2_ROADS_AVAILABLE: 9,
      P2_LONGEST_ROAD_LENGTH: 5,
      P2_PLAYED_KNIGHT: 2,
      P2_HAS_ROAD: false,
      P2_HAS_ARMY: false,
      P3_ACTUAL_VICTORY_POINTS: 5,
      P3_SETTLEMENTS_AVAILABLE: 2,
      P3_CITIES_AVAILABLE: 4,
      P3_ROADS_AVAILABLE: 10,
      P3_LONGEST_ROAD_LENGTH: 4,
      P3_PLAYED_KNIGHT: 1,
      P3_HAS_ROAD: false,
      P3_HAS_ARMY: false,
    },
    action_records: [
      [["RED", "ROLL", null], [3, 4]],
      [["BLUE", "ROLL", null], [4, 4]],
      [["WHITE", "ROLL", null], [2, 6]],
      [["ORANGE", "ROLL", null], [5, 3]],
      [["RED", "ROLL", null], [6, 1]],
    ] as any,
    ...overrides,
  } as unknown as GameState;
}

describe("VictoryScreenOverlay", () => {
  it("renders the winner seated on the central throne with only the 'Vencedor' label, without numeric rank badges or duplicate title chips on player cards", () => {
    const gameState = makeVictoryGameState();
    const onReturnLobby = vi.fn();

    render(
      <I18nProvider>
        <MemoryRouter>
          <VictoryScreenOverlay
            gameState={gameState}
            mySeatColor="RED"
            onReturnLobby={onReturnLobby}
          />
        </MemoryRouter>
      </I18nProvider>
    );

    expect(screen.getByTestId("victory-screen-overlay")).toBeInTheDocument();

    // Central throne contains the winner (RED) with full-body throne avatar and "VENCEDOR" label
    const throneCenter = screen.getByTestId("victory-throne-center");
    expect(throneCenter).toContainElement(
      screen.getByTestId("victory-throne-winner-RED")
    );
    const winnerBadge = screen.getByTestId("victory-winner-badge");
    expect(winnerBadge).toHaveTextContent(/VENCEDOR|WINNER/i);
    expect(winnerBadge).not.toHaveTextContent(/SOBERANO|SOVEREIGN/i);
    expect(screen.queryByText(/º Lugar|Place/i)).not.toBeInTheDocument();

    const winnerAvatar = screen.getByTestId("victory-fullbody-avatar-RED");
    expect(winnerAvatar).toHaveAttribute("data-full-body", "true");
    expect(winnerAvatar).toHaveAttribute("data-on-throne", "true");

    // Player cards do not duplicate title chips ("Maior Estrada" / "Maior Exército")
    const winnerCard = screen.getByTestId("victory-rank-card-RED");
    expect(winnerCard).not.toHaveTextContent(/Maior Estrada|Longest Road/i);
    const blueCard = screen.getByTestId("victory-rank-card-BLUE");
    expect(blueCard).not.toHaveTextContent(/Maior Exército|Largest Army/i);

    // 3 challengers distributed symmetrically: 2 on left wing, 1 on right wing
    const leftWing = screen.getByTestId("victory-left-wing");
    const rightWing = screen.getByTestId("victory-right-wing");

    expect(leftWing).toContainElement(
      screen.getByTestId("victory-court-member-BLUE")
    );
    expect(leftWing).toContainElement(
      screen.getByTestId("victory-court-member-ORANGE")
    );
    expect(rightWing).toContainElement(
      screen.getByTestId("victory-court-member-WHITE")
    );

    // Every challenger renders a full-body avatar
    expect(
      screen.getByTestId("victory-fullbody-avatar-BLUE")
    ).toHaveAttribute("data-full-body", "true");
    expect(
      screen.getByTestId("victory-fullbody-avatar-WHITE")
    ).toHaveAttribute("data-full-body", "true");
    expect(
      screen.getByTestId("victory-fullbody-avatar-ORANGE")
    ).toHaveAttribute("data-full-body", "true");
  });

  it("displays title holders and 'Crônicas das rolagens' with per-player filtering and only the Total KPI", () => {
    const gameState = makeVictoryGameState();

    render(
      <I18nProvider>
        <MemoryRouter>
          <VictoryScreenOverlay
            gameState={gameState}
            mySeatColor="RED"
            onReturnLobby={vi.fn()}
          />
        </MemoryRouter>
      </I18nProvider>
    );

    // Title holders section
    const longestRoadPlaque = screen.getByTestId("victory-title-longest-road");
    expect(longestRoadPlaque).toHaveTextContent("Soberana Helena");
    expect(longestRoadPlaque).toHaveTextContent("9");

    const largestArmyPlaque = screen.getByTestId("victory-title-largest-army");
    expect(largestArmyPlaque).toHaveTextContent(/Felire|Duque Marco/);
    expect(largestArmyPlaque).toHaveTextContent("4");

    // Dice statistics section: "CRÔNICAS DAS ROLAGENS", only Total KPI, no "Estatísticas de Dados", "Mais Sorteado", or "Ladrão (7)"
    const dicePanel = screen.getByTestId("victory-dice-panel");
    expect(dicePanel).toHaveTextContent(/CRÔNICAS DAS ROLAGENS|CHRONICLE OF ROLLS/i);
    expect(dicePanel).not.toHaveTextContent(/Estatísticas de Dados|Dice Statistics/i);
    expect(dicePanel).not.toHaveTextContent(/Mais Sorteado|Most Rolled/i);
    expect(dicePanel).not.toHaveTextContent(/Ladrão \(7\)|Robber \(7\)/i);

    expect(screen.getByTestId("victory-dice-kpi-total")).toHaveTextContent("5");
    expect(screen.getByTestId("victory-dice-col-8")).toHaveTextContent("3");
    expect(screen.getByTestId("victory-dice-col-7")).toHaveTextContent("2");

    // Filter by RED player (who rolled two 7s)
    fireEvent.click(screen.getByTestId("victory-dice-filter-RED"));
    expect(screen.getByTestId("victory-dice-kpi-total")).toHaveTextContent("2");
    expect(screen.getByTestId("victory-dice-col-7")).toHaveTextContent("2");
    expect(screen.getByTestId("victory-dice-col-8")).toHaveTextContent("0");

    // Filter by BLUE player (who rolled one 8)
    fireEvent.click(screen.getByTestId("victory-dice-filter-BLUE"));
    expect(screen.getByTestId("victory-dice-kpi-total")).toHaveTextContent("1");
    expect(screen.getByTestId("victory-dice-col-8")).toHaveTextContent("1");
    expect(screen.getByTestId("victory-dice-col-7")).toHaveTextContent("0");

    // Return to ALL filter
    fireEvent.click(screen.getByTestId("victory-dice-filter-ALL"));
    expect(screen.getByTestId("victory-dice-kpi-total")).toHaveTextContent("5");
  });

  it("supports minimizing to inspect the final board", () => {
    const gameState = makeVictoryGameState();

    render(
      <I18nProvider>
        <MemoryRouter>
          <VictoryScreenOverlay
            gameState={gameState}
            mySeatColor="RED"
            onReturnLobby={vi.fn()}
          />
        </MemoryRouter>
      </I18nProvider>
    );

    const overlay = screen.getByTestId("victory-screen-overlay");
    expect(overlay).toHaveAttribute("data-design-variant", "court");

    // Minimize to inspect final board
    fireEvent.click(
      screen.getByRole("button", { name: /Ver Tabuleiro Final|Inspect Final Board/i })
    );
    expect(screen.getByTestId("victory-screen-minimized")).toBeInTheDocument();
  });

  it("preserves each participant's real seat_avatars config (including custom hair, outfit, and hat=none)", () => {
    const gameState = makeVictoryGameState({
      seat_avatars: {
        RED: {
          seat_kind: "USER",
          username: "Soberana Helena",
          avatar_config: {
            version: 2,
            hat: "none",
            hair: "royal_bun",
            outfit: "imperial_lord",
            cape: "royal_mantle",
          } as any,
        },
        BLUE: {
          seat_kind: "GUEST",
          username: "Duque Marco",
          avatar_config: {
            version: 2,
            hat: "admiral_bicorne",
            outfit: "captain",
          } as any,
        },
      },
    });

    render(
      <I18nProvider>
        <MemoryRouter>
          <VictoryScreenOverlay
            gameState={gameState}
            mySeatColor="RED"
            onReturnLobby={vi.fn()}
          />
        </MemoryRouter>
      </I18nProvider>
    );

    expect(screen.getByTestId("victory-fullbody-avatar-RED")).toBeInTheDocument();
    expect(screen.getByTestId("victory-fullbody-avatar-BLUE")).toBeInTheDocument();
  });

  it("creates a 3D royal throne mesh and seats the avatar rig in throne pose", () => {
    const throneGroup = createRoyalThroneGroup();
    expect(throneGroup.name).toBe("royal_victory_throne");
    expect(throneGroup.children.length).toBeGreaterThanOrEqual(10);

    const rig = createAvatarRig();
    rig.stagePose = "throne";
    const resolved = resolveAvatarConfig(
      { mount: "island_horse", handProp: "royal_scepter" },
      "Soberana Helena"
    );
    applyAvatarCombinationAndPose(rig, resolved);

    expect(rig.isMounted).toBe(false);
    expect(rig.mountId).toBe("throne");
    expect(rig.baseRiderPos[1]).toBeCloseTo(-0.21, 2);
  });
});
