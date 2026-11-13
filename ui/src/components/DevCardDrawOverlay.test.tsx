import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import DevCardDrawOverlay from "./DevCardDrawOverlay";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("DevCardDrawOverlay", () => {
  test("renders drawn card in center with title and descriptions, then glides and completes", () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();

    const { container, rerender } = render(
      <DevCardDrawOverlay card="KNIGHT" onComplete={onComplete} />
    );

    expect(screen.getByText(/Nova Carta de Desenvolvimento!/i)).toBeInTheDocument();
    expect(screen.getByText("Cavaleiro")).toBeInTheDocument();
    expect(screen.getByText(/Mova o Ladrão/i)).toBeInTheDocument();
    const overlay = container.querySelector(".dev-card-draw-overlay");
    expect(overlay).toHaveClass("phase-enter");

    // Advance to glide phase (> 1150ms)
    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(overlay).toHaveClass("phase-glide");
    expect(onComplete).not.toHaveBeenCalled();

    // Advance to completion (> 1750ms total)
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);

    // If card is null, nothing rendered
    rerender(<DevCardDrawOverlay card={null} onComplete={onComplete} />);
    expect(container.firstChild).toBeNull();
  });
});
