import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import DiceRollOverlay from "./DiceRollOverlay";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("DiceRollOverlay", () => {
  test("renders 3D tumbling dice cubes while rolling and settles cleanly on the rolled sum", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(
      <DiceRollOverlay
        open
        rolling
        dice={[4, 4]}
        rollerName="Creitu"
        rollerColor="RED"
      />
    );

    expect(screen.getByText(/Creitu/i)).toBeInTheDocument();
    expect(screen.getByText(/Rolando/i)).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Dado em rotação/i)).toHaveLength(2);
    expect(container.querySelectorAll(".dice3d-cube")).toHaveLength(2);
    expect(container.querySelectorAll(".dice3d-face")).toHaveLength(12);
    expect(screen.queryByText(/Total 8/i)).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    rerender(
      <DiceRollOverlay
        open
        rolling={false}
        dice={[4, 4]}
        rollerName="Creitu"
        rollerColor="RED"
      />
    );

    expect(screen.getByText(/Total 8/i)).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Dado 4/i)).toHaveLength(2);
    const stage = screen.getByRole("status");
    expect(stage).toHaveClass("is-settled");
    expect(stage).toHaveClass("is-hot");

    rerender(
      <DiceRollOverlay
        open
        rolling={false}
        dice={[3, 4]}
        rollerName="Creitu"
        rollerColor="RED"
      />
    );
    expect(screen.getByText(/Total 7 — Ladrão!/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveClass("is-seven");
  });
});
