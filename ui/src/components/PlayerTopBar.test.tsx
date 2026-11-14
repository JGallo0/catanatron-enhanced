import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

  test("renders taken-over seat with '<Nome> (Bot)', 'Bot assumiu' indicator, original custom avatar instead of Creitu, and 'Substituto IA' inspector tag", () => {
    const state = makeGameState({
      colors: ["RED", "BLUE"],
      bot_colors: ["RED", "BLUE"],
      taken_over_colors: ["BLUE"],
      seat_names: { RED: "Felire", BLUE: "João (Bot)" },
      seat_avatars: {
        RED: { seat_kind: "BOT", username: null, avatar_config: {} },
        BLUE: {
          seat_kind: "BOT",
          username: null,
          avatar_config: {
            hat: "captain",
            background: "ocean",
            frame: "gold",
          },
        },
      },
      seat_takeover: {
        BLUE: {
          taken_over: true,
          reason: "ABANDONED",
          original_username: "joao",
          original_display_name: "João",
        },
      },
    });

    const { container } = render(
      <StateProvider>
        <PlayerTopBar gameState={state} recentDevColor="BLUE" />
      </StateProvider>
    );

    expect(screen.getByText("João (Bot)")).toBeInTheDocument();
    expect(screen.getByText(/Bot assumiu/i)).toBeInTheDocument();
    expect(screen.queryByText("Creitu")).not.toBeInTheDocument();

    const avatars = screen.getAllByTestId("player-avatar");
    expect(avatars).toHaveLength(2);
    expect(avatars[1]).toHaveAttribute("data-frame", "gold");
    expect(
      screen.getByRole("img", { name: "Avatar de joao" })
    ).toBeInTheDocument();
    expect(
      container.querySelectorAll(".cu-stat--devcards.cu-stat--recent")
    ).toHaveLength(1);

    fireEvent.click(
      screen.getByRole("button", { name: /Inspecionar João \(Bot\)/i })
    );
    expect(screen.getByText(/Substituto IA/i)).toBeInTheDocument();
  });

  test("renders seats in colors order without numeric turn-order badges (1º, 2º, 3º, 4º)", () => {
    const state = makeGameState({
      colors: ["ORANGE", "RED", "WHITE", "BLUE"],
      bot_colors: ["RED", "WHITE", "BLUE"],
      seat_names: {
        ORANGE: "Ana",
        RED: "Creitu",
        WHITE: "Felire",
        BLUE: "Guiri",
      },
    });

    const { container } = render(
      <StateProvider>
        <PlayerTopBar gameState={state} />
      </StateProvider>
    );

    const bar = container.querySelector(".cu-player-top-bar") as HTMLElement;
    expect(bar).toBeTruthy();
    expect(bar.textContent).not.toMatch(/[1-4]º/);
    const cardNames = Array.from(
      bar.querySelectorAll(".cu-player-card__name")
    ).map((el) => el.textContent);
    expect(cardNames).toEqual(["Ana", "Creitu", "Felire", "Guiri"]);
  });

  test("applies dynamic game.discard_limit threshold for resource danger badge and inspector warning", () => {
    const highLimitState = makeGameState({
      colors: ["RED", "BLUE"],
      bot_colors: ["BLUE"],
      seat_names: { RED: "Ana", BLUE: "Jaó" },
      game: {
        id: "game-123",
        vps_to_win: 10,
        discard_limit: 10,
        friendly_robber: false,
      },
      player_state: {
        ...makeGameState().player_state,
        P1_NUM_RESOURCES_IN_HAND: 8,
      },
    });

    const { container, rerender } = render(
      <StateProvider>
        <PlayerTopBar gameState={highLimitState} />
      </StateProvider>
    );
    expect(container.querySelectorAll(".cu-stat--danger")).toHaveLength(0);

    const lowLimitState = makeGameState({
      ...highLimitState,
      game: {
        id: "game-123",
        vps_to_win: 10,
        discard_limit: 5,
        friendly_robber: false,
      },
    });
    rerender(
      <StateProvider>
        <PlayerTopBar gameState={lowLimitState} />
      </StateProvider>
    );
    expect(container.querySelectorAll(".cu-stat--danger")).toHaveLength(1);
    expect(
      screen.getByTitle(/Atenção: 8\/5 cartas! Perderá metade se rolar 7\./)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Inspecionar Jaó/i }));
    expect(document.querySelectorAll(".cu-inspect-stat-box--warn")).toHaveLength(1);
  });

  test("shows distinct medals on the current holders and moves them when surpassed", () => {
    const base = makeGameState({
      colors: ["RED", "BLUE"],
      bot_colors: ["BLUE"],
      seat_names: { RED: "Ana", BLUE: "Creitu" },
      player_state: {
        ...makeGameState().player_state,
        P0_LONGEST_ROAD_LENGTH: 5,
        P0_HAS_ROAD: true,
        P0_PLAYED_KNIGHT: 3,
        P0_HAS_ARMY: true,
        P1_LONGEST_ROAD_LENGTH: 4,
        P1_HAS_ROAD: false,
        P1_PLAYED_KNIGHT: 2,
        P1_HAS_ARMY: false,
      },
    });

    const { container, rerender } = render(
      <StateProvider>
        <PlayerTopBar gameState={base} />
      </StateProvider>
    );

    const card = (index: number) => within(container.querySelectorAll<HTMLElement>(".cu-player-card")[index]);
    expect(card(0).getByRole("img", { name: "Maior Estrada" })).toBeInTheDocument();
    expect(card(0).getByRole("img", { name: "Maior Exército" })).toBeInTheDocument();
    expect(card(1).queryByRole("img", { name: /Maior Estrada|Maior Exército/ })).not.toBeInTheDocument();

    const overtaken = makeGameState({
      ...base,
      player_state: {
        ...base.player_state,
        P0_HAS_ROAD: false,
        P0_HAS_ARMY: false,
        P1_LONGEST_ROAD_LENGTH: 6,
        P1_HAS_ROAD: true,
        P1_PLAYED_KNIGHT: 4,
        P1_HAS_ARMY: true,
      },
    });

    rerender(
      <StateProvider>
        <PlayerTopBar gameState={overtaken} />
      </StateProvider>
    );

    expect(card(0).queryByRole("img", { name: /Maior Estrada|Maior Exército/ })).not.toBeInTheDocument();
    expect(card(1).getByRole("img", { name: "Maior Estrada" })).toBeInTheDocument();
    expect(card(1).getByRole("img", { name: "Maior Exército" })).toBeInTheDocument();
  });
});
