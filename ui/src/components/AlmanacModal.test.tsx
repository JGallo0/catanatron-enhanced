import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import AlmanacModal from "./AlmanacModal";

afterEach(() => {
  cleanup();
});

describe("AlmanacModal", () => {
  test("switches cleanly between builds, dev/honors, and dice/rules tabs and triggers onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<AlmanacModal open={true} onClose={onClose} />);

    expect(
      screen.getByText(/Almanaque & Regras — Rule the Isle/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Aldeia")).toBeInTheDocument();
    expect(screen.getByText(/Troca Marítima & Portos/i)).toBeInTheDocument();

    await user.click(
      screen.getByRole("tab", { name: /Cartas & Honrarias/i })
    );
    expect(
      screen.getByText(/Maior Estrada \(5\+ estradas\)/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Monopólio/i)).toBeInTheDocument();

    await user.click(
      screen.getByRole("tab", { name: /Dados & Regras da Mesa/i })
    );
    expect(
      screen.getByText(/Dados Equilibrados \(Deck 36\)/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Torneio \(Mapa fixo\)/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Fechar almanaque/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
