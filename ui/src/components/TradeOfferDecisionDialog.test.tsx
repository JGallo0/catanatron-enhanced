import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { afterEach, describe, expect, test, vi } from "vitest";
import TradeOfferDecisionDialog from "./TradeOfferDecisionDialog";
import { makeGameState } from "../test/fixtures";
import type { GameAction } from "../utils/api.types";

const theme = createTheme();

afterEach(() => {
  cleanup();
});

describe("TradeOfferDecisionDialog", () => {
  test("renders DECIDE_TRADE with proposer avatar and disables accept when lacking cards", async () => {
    const onExecuteAction = vi.fn().mockResolvedValue(undefined);
    const tradeTuple = [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0]; // P0 offers 1 Wood, asks 1 Wheat

    const shortState = makeGameState({
      current_color: "BLUE",
      current_turn_index: 0,
      current_prompt: "DECIDE_TRADE",
      is_resolving_trade: true,
      current_trade: tradeTuple,
      seat_names: { RED: "Creitu", BLUE: "João" },
      seat_avatars: {
        RED: { seat_kind: "BOT", username: null, avatar_config: {} },
        BLUE: { seat_kind: "USER", username: "joao", avatar_config: {} },
      },
      player_state: {
        ...makeGameState().player_state,
        P1_WHEAT_IN_HAND: 0,
      },
      current_playable_actions: [["BLUE", "REJECT_TRADE", tradeTuple]],
    });

    render(
      <ThemeProvider theme={theme}>
        <TradeOfferDecisionDialog
          open={true}
          onMinimize={vi.fn()}
          gameState={shortState}
          humanColor="BLUE"
          onExecuteAction={onExecuteAction}
        />
      </ThemeProvider>
    );

    expect(screen.getByText("Creitu")).toBeInTheDocument();
    expect(screen.getByText(/Você não possui todas as cartas/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Aceitar Troca/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Recusar/i }));
    await waitFor(() => {
      expect(onExecuteAction).toHaveBeenCalledWith([
        "BLUE",
        "REJECT_TRADE",
        tradeTuple,
      ]);
    });
  }, 12000);

  test("renders DECIDE_TRADE Accept button when affordable and emits ACCEPT_TRADE", async () => {
    const onExecuteAction = vi.fn().mockResolvedValue(undefined);
    const tradeTuple = [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0];
    const acceptAct: GameAction = ["BLUE", "ACCEPT_TRADE", tradeTuple];

    const state = makeGameState({
      current_color: "BLUE",
      current_turn_index: 0,
      current_prompt: "DECIDE_TRADE",
      is_resolving_trade: true,
      current_trade: tradeTuple,
      player_state: {
        ...makeGameState().player_state,
        P1_WHEAT_IN_HAND: 2,
      },
      current_playable_actions: [
        ["BLUE", "REJECT_TRADE", tradeTuple],
        acceptAct,
      ],
    });

    render(
      <ThemeProvider theme={theme}>
        <TradeOfferDecisionDialog
          open={true}
          onMinimize={vi.fn()}
          gameState={state}
          humanColor="BLUE"
          onExecuteAction={onExecuteAction}
        />
      </ThemeProvider>
    );

    const acceptBtn = screen.getByRole("button", { name: /Aceitar Troca/i });
    expect(acceptBtn).toBeEnabled();
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(onExecuteAction).toHaveBeenCalledWith(acceptAct);
    });
  });

  test("renders DECIDE_ACCEPTEES partners and dispatches CONFIRM_TRADE or CANCEL_TRADE", async () => {
    const onExecuteAction = vi.fn().mockResolvedValue(undefined);
    const baseTrade: [number, number, number, number, number, number, number, number, number, number] = [
      1, 0, 0, 0, 0, 0, 1, 0, 0, 0,
    ];
    const confirmRed: GameAction = ["BLUE", "CONFIRM_TRADE", [...baseTrade, "RED"]];
    const cancelAct: GameAction = ["BLUE", "CANCEL_TRADE", null];

    const state = makeGameState({
      colors: ["RED", "BLUE", "ORANGE"],
      bot_colors: ["RED", "ORANGE"],
      current_color: "BLUE",
      current_turn_index: 1,
      current_prompt: "DECIDE_ACCEPTEES",
      is_resolving_trade: true,
      current_trade: [...baseTrade, 1],
      acceptees: [true, false, false],
      seat_names: { RED: "Creitu", BLUE: "João", ORANGE: "Felire" },
      seat_avatars: {
        RED: { seat_kind: "BOT", username: null, avatar_config: {} },
        BLUE: { seat_kind: "USER", username: "joao", avatar_config: {} },
        ORANGE: { seat_kind: "BOT", username: null, avatar_config: {} },
      },
      current_playable_actions: [cancelAct, confirmRed],
    });

    render(
      <ThemeProvider theme={theme}>
        <TradeOfferDecisionDialog
          open={true}
          onMinimize={vi.fn()}
          gameState={state}
          humanColor="BLUE"
          onExecuteAction={onExecuteAction}
        />
      </ThemeProvider>
    );

    expect(screen.getByText(/Creitu aceitou/i)).toBeInTheDocument();
    expect(screen.getByText(/Felire recusou/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Trocar com Creitu/i }));
    await waitFor(() => {
      expect(onExecuteAction).toHaveBeenCalledWith(confirmRed);
    });

    fireEvent.click(screen.getByRole("button", { name: /Cancelar Troca/i }));
    await waitFor(() => {
      expect(onExecuteAction).toHaveBeenCalledWith(cancelAct);
    });
  });

  test("opens Contrapropor editor, sends counter-offer summary to chat, and emits REJECT_TRADE", async () => {
    const onExecuteAction = vi.fn().mockResolvedValue(undefined);
    const onSendChatMessage = vi.fn().mockResolvedValue(undefined);
    const tradeTuple = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0];

    const state = makeGameState({
      current_color: "BLUE",
      current_turn_index: 0,
      current_prompt: "DECIDE_TRADE",
      is_resolving_trade: true,
      current_trade: tradeTuple,
      seat_names: { RED: "Creitu", BLUE: "João" },
      player_state: {
        ...makeGameState().player_state,
        P1_SHEEP_IN_HAND: 2,
      },
      current_playable_actions: [["BLUE", "REJECT_TRADE", tradeTuple]],
    });

    render(
      <ThemeProvider theme={theme}>
        <TradeOfferDecisionDialog
          open={true}
          onMinimize={vi.fn()}
          gameState={state}
          humanColor="BLUE"
          onExecuteAction={onExecuteAction}
          onSendChatMessage={onSendChatMessage}
        />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: /Contrapropor/i }));
    expect(screen.getByText(/Sugerir Contraproposta/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Aumentar oferta de Ovelha"));
    fireEvent.click(screen.getByRole("button", { name: /Enviar Contraproposta/i }));

    await waitFor(() => {
      expect(onSendChatMessage).toHaveBeenCalledWith(
        expect.stringMatching(/Contraproposta para Creitu:.*1[×x] Ovelha.*1[×x] Madeira/i)
      );
      expect(onExecuteAction).toHaveBeenCalledWith([
        "BLUE",
        "REJECT_TRADE",
        tradeTuple,
      ]);
    });
  });
});
