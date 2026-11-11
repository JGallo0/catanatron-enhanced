import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import PlayerTopBar from "./PlayerTopBar";
import { makeGameState } from "../test/fixtures";
import { StateProvider } from "../store";
import { saveGuestProfile } from "../config/avatarCatalog";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("PlayerTopBar", () => {
  test("renders original PlayerAvatar SVG for every seat, official bot names, and no legacy webp portraits", () => {
    saveGuestProfile({
      displayName: "Capitão Convidado",
      avatarConfig: { hat: "explorer", frame: "wood", background: "sunset" },
    });

    const state = makeGameState({
      colors: ["RED", "BLUE", "ORANGE", "WHITE"],
      bot_colors: ["BLUE", "ORANGE", "WHITE"],
      seat_names: {
        RED: "Capitão Convidado",
        BLUE: "Creitu",
        ORANGE: "Felire",
        WHITE: "Guiri",
      },
      seat_avatars: {
        RED: { seat_kind: "GUEST", username: null, avatar_config: {} },
        BLUE: { seat_kind: "BOT", username: null, avatar_config: {} },
        ORANGE: { seat_kind: "BOT", username: null, avatar_config: {} },
        WHITE: { seat_kind: "BOT", username: null, avatar_config: {} },
      },
    });

    const { container } = render(
      <StateProvider>
        <PlayerTopBar gameState={state} />
      </StateProvider>
    );

    expect(screen.getAllByTestId("player-avatar")).toHaveLength(4);
    expect(container.querySelector("img[src*='/illustrations/avatars/']")).toBeNull();
    expect(screen.getByText("Capitão Convidado")).toBeInTheDocument();
    expect(screen.getByText("Creitu")).toBeInTheDocument();
    expect(screen.getByText("Felire")).toBeInTheDocument();
    expect(screen.getByText("Guiri")).toBeInTheDocument();
    expect(screen.queryByText(/Bot Branco/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/IA \(/i)).not.toBeInTheDocument();
  });

  test("tapping a player card opens the detailed inspector dialog with knights, road, dev cards and pieces", () => {
    const state = makeGameState({
      colors: ["RED", "BLUE"],
      bot_colors: ["BLUE"],
      seat_names: { RED: "João", BLUE: "Creitu" },
      player_state: {
        ...makeGameState().player_state,
        P1_ACTUAL_VICTORY_POINTS: 5,
        P1_NUM_RESOURCES_IN_HAND: 8,
        P1_NUM_DEVELOPMENT_CARDS_IN_HAND: 2,
        P1_PLAYED_KNIGHT: 3,
        P1_LONGEST_ROAD_LENGTH: 6,
        P1_HAS_ARMY: true,
        P1_HAS_ROAD: true,
        P1_SETTLEMENTS_AVAILABLE: 3,
        P1_CITIES_AVAILABLE: 3,
        P1_ROADS_AVAILABLE: 9,
      },
    });

    render(
      <StateProvider>
        <PlayerTopBar gameState={state} />
      </StateProvider>
    );

    const inspectBtn = screen.getByRole("button", { name: /Inspecionar Creitu/i });
    fireEvent.click(inspectBtn);

    expect(screen.getByText(/Peças no Tabuleiro/i)).toBeInTheDocument();
    expect(screen.getByText(/5 PV/)).toBeInTheDocument();
    expect(screen.getByText(/Maior Exército/i)).toBeInTheDocument();
    expect(screen.getByText(/6 segmentos/i)).toBeInTheDocument();
    expect(screen.getByText("2/5")).toBeInTheDocument();
    expect(screen.getByText("1/4")).toBeInTheDocument();
    expect(screen.getByText("6/15")).toBeInTheDocument();
  });
});
