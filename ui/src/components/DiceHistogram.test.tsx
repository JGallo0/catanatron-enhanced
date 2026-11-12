import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { makeGameState } from "../test/fixtures";
import type { GameState } from "../utils/api.types";
import DiceHistogram from "./DiceHistogram";

afterEach(() => {
  cleanup();
});

describe("DiceHistogram", () => {
  test("counts ROLL records accurately and renders Padrão 2d6 pill", () => {
    const state = makeGameState({
      game: {
        id: "g-rand",
        vps_to_win: 10,
        discard_limit: 7,
        friendly_robber: false,
        dice_mode: "random",
      },
      action_records: [
        [["RED", "ROLL", null], [3, 5]],
        [["BLUE", "ROLL", null], [1, 6]],
        [["RED", "ROLL", null], [4, 4]],
        [["RED", "END_TURN", null], null],
      ] as GameState["action_records"],
    });

    render(<DiceHistogram gameState={state} />);

    expect(screen.getByText("🎲 Padrão 2d6")).toBeInTheDocument();
    expect(screen.getByText(/3 rolagem\(ns\) · Último: 8/i)).toBeInTheDocument();
    expect(
      screen.getByRole("listitem", { name: "Número 8: 2 vez(es)" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("listitem", { name: "Número 7: 1 vez(es)" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("listitem", { name: "Número 2: 0 vez(es)" })
    ).toBeInTheDocument();
  });

  test("renders Equilibrados pill with remaining deck count when dice_mode is balanced", () => {
    const state = makeGameState({
      game: {
        id: "g-bal",
        vps_to_win: 10,
        discard_limit: 7,
        friendly_robber: false,
        dice_mode: "balanced",
      },
      dice_deck_remaining: 29,
      action_records: [],
    });

    render(<DiceHistogram gameState={state} />);

    expect(screen.getByText(/🎴 Equilibrados · 29\/36/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Aguardando primeira rolagem/i)
    ).toBeInTheDocument();
  });
});
