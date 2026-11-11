import { cleanup, render, screen } from "@testing-library/react";
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
});
