import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import DiscardPlannerDialog from "./DiscardPlannerDialog";

describe("DiscardPlannerDialog", () => {
  const defaultCounts = {
    WOOD: 3,
    BRICK: 2,
    SHEEP: 1,
    WHEAT: 0,
    ORE: 4,
  };

  test("renders real resource cards with hand counts and labels", () => {
    render(
      <DiscardPlannerDialog
        open={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        remainingDiscardCount={4}
        discardResourceCounts={defaultCounts}
      />
    );

    // Verify title and prompt
    expect(screen.getByText(/Descartar Recursos \(Ladrão\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Escolha 4 cartas da sua mão/i)).toBeInTheDocument();

    // Verify labels for the cards
    expect(screen.getByText("Madeira")).toBeInTheDocument();
    expect(screen.getByText("Argila")).toBeInTheDocument();
    expect(screen.getByText("Ovelha")).toBeInTheDocument();
    expect(screen.getByText("Trigo")).toBeInTheDocument();
    expect(screen.getByText("Minério")).toBeInTheDocument();

    // Confirm button should initially be disabled since 0/4 selected
    const confirmBtn = screen.getByRole("button", { name: /Confirmar Descarte/i });
    expect(confirmBtn).toBeDisabled();
  });

  test("allows selecting and unselecting cards up to the required count, then confirms", () => {
    const onConfirm = vi.fn();
    render(
      <DiscardPlannerDialog
        open={true}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        remainingDiscardCount={2}
        discardResourceCounts={defaultCounts}
      />
    );

    const plusButtons = screen.getAllByRole("button", { name: /Adicionar 1/i });
    // Click '+' on Madeira (index 0)
    fireEvent.click(plusButtons[0]);

    // Check subtitle updated
    expect(screen.getByText(/1 de 2 cartas selecionada/i)).toBeInTheDocument();

    // Click '+' on Minério (index 4)
    fireEvent.click(plusButtons[4]);

    // Now 2 of 2 selected!
    expect(screen.getByText(/2 de 2 cartas selecionadas/i)).toBeInTheDocument();
    const confirmBtn = screen.getByRole("button", { name: /Confirmar Descarte/i });
    expect(confirmBtn).not.toBeDisabled();

    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(["WOOD", "ORE"]);
  });
});
