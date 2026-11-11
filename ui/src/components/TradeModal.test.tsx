import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { afterEach, describe, expect, test, vi } from "vitest";
import TradeModal from "./TradeModal";
import { makeGameState } from "../test/fixtures";
import type { MaritimeTradeAction } from "../utils/api.types";

const theme = createTheme();

afterEach(() => {
  cleanup();
});

describe("TradeModal", () => {
  test("builds and submits valid 10-tuple OFFER_TRADE on Entre Jogadores tab", async () => {
    const onExecuteTrade = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const state = makeGameState({
      seat_names: { RED: "Creitu", BLUE: "João" },
      seat_avatars: {
        RED: { seat_kind: "BOT", username: null, avatar_config: {} },
        BLUE: { seat_kind: "USER", username: "joao", avatar_config: {} },
      },
      player_state: {
        ...makeGameState().player_state,
        P0_NUM_RESOURCES_IN_HAND: 2,
        P1_WOOD_IN_HAND: 2,
        P1_WHEAT_IN_HAND: 1,
        P1_HAS_ROLLED: true,
      },
    });

    render(
      <ThemeProvider theme={theme}>
        <TradeModal
          open={true}
          onClose={onClose}
          tradeActions={[]}
          playerState={state.player_state}
          playerKey="P1"
          playerColor="BLUE"
          gameState={state}
          canOfferDomesticTrade={true}
          onExecuteTrade={onExecuteTrade}
        />
      </ThemeProvider>
    );

    expect(screen.getByText("Creitu")).toBeInTheDocument();
    expect(screen.getByText("(2 cartas)")).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", {
      name: /Enviar Proposta à Mesa/i,
    });
    expect(submitBtn).toBeDisabled();

    // Offer 1 Madeira (respecting 2 in hand cap)
    fireEvent.click(
      screen.getByRole("button", { name: "Adicionar oferta de Madeira" })
    );
    expect(screen.getByTestId("offer-qty-WOOD")).toHaveTextContent("1");

    // Still disabled without asking resource
    expect(submitBtn).toBeDisabled();

    // Ask 1 Minério
    fireEvent.click(
      screen.getByRole("button", { name: "Adicionar pedido de Minério" })
    );
    expect(screen.getByTestId("ask-qty-ORE")).toHaveTextContent("1");

    // Adding same resource to ask automatically clears offer side to obey Catan rule
    fireEvent.click(
      screen.getByRole("button", { name: "Adicionar pedido de Madeira" })
    );
    expect(screen.getByTestId("offer-qty-WOOD")).toHaveTextContent("0");
    expect(submitBtn).toBeDisabled();

    // Re-add Trigo on offer side -> valid 1 Wheat for 1 Ore + 1 Wood
    fireEvent.click(
      screen.getByRole("button", { name: "Adicionar oferta de Trigo" })
    );
    expect(submitBtn).toBeEnabled();

    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(onExecuteTrade).toHaveBeenCalledWith([
        "BLUE",
        "OFFER_TRADE",
        [0, 0, 0, 1, 0, 1, 0, 0, 0, 1],
      ]);
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  test("switches to Porto & Banco tab and executes maritime trade", async () => {
    const onExecuteTrade = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const maritimeAction: MaritimeTradeAction = [
      "BLUE",
      "MARITIME_TRADE",
      ["WOOD", "WOOD", "WOOD", "WOOD", "ORE"],
    ];
    const state = makeGameState({
      player_state: {
        ...makeGameState().player_state,
        P1_WOOD_IN_HAND: 4,
        P1_HAS_ROLLED: true,
      },
    });

    render(
      <ThemeProvider theme={theme}>
        <TradeModal
          open={true}
          onClose={onClose}
          tradeActions={[maritimeAction]}
          playerState={state.player_state}
          playerKey="P1"
          playerColor="BLUE"
          gameState={state}
          canOfferDomesticTrade={true}
          onExecuteTrade={onExecuteTrade}
        />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByRole("tab", { name: /Porto & Banco/i }));
    fireEvent.click(screen.getByRole("button", { name: /Confirmar Troca/i }));

    await waitFor(() => {
      expect(onExecuteTrade).toHaveBeenCalledWith(maritimeAction);
      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});
