import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { GameMessage } from "../utils/api.types";
import GameChatPanel from "./GameChatPanel";

afterEach(() => {
  cleanup();
});

const SAMPLE_MESSAGES: GameMessage[] = [
  {
    id: 1,
    game_id: "game-1",
    color: "RED",
    sender_name: "Ana",
    kind: "CHAT",
    body: "Boa partida!",
    created_at: 1700000000,
  },
  {
    id: 2,
    game_id: "game-1",
    color: "BLUE",
    sender_name: "João",
    kind: "CHAT",
    body: "Vamos trocar madeira?",
    created_at: 1700000060,
  },
];

test("renders chat messages and dispatches custom + quick-phrase messages", () => {
  const onSend = vi.fn();
  const onClose = vi.fn();

  render(
    <GameChatPanel
      open={true}
      onClose={onClose}
      messages={SAMPLE_MESSAGES}
      mySeatColor="BLUE"
      onSendMessage={onSend}
    />
  );

  expect(screen.getByText("Boa partida!")).toBeInTheDocument();
  expect(screen.getByText("Vamos trocar madeira?")).toBeInTheDocument();

  const input = screen.getByLabelText("Mensagem de bate-papo");
  fireEvent.change(input, { target: { value: "  Tenho trigo!  " } });
  fireEvent.submit(input.closest("form")!);

  expect(onSend).toHaveBeenCalledWith("Tenho trigo!");
  expect(input).toHaveValue("");

  fireEvent.click(screen.getByRole("button", { name: "👋 Boa sorte!" }));
  expect(onSend).toHaveBeenCalledWith("👋 Boa sorte!");

  fireEvent.click(screen.getByRole("button", { name: "Fechar bate-papo" }));
  expect(onClose).toHaveBeenCalledOnce();
});

test("shows read-only spectator notice when user has no seat color", () => {
  render(
    <GameChatPanel
      open={true}
      onClose={vi.fn()}
      messages={[]}
      mySeatColor={null}
      onSendMessage={vi.fn()}
    />
  );

  expect(screen.getByText(/Nenhuma mensagem ainda/i)).toBeInTheDocument();
  expect(screen.getByText(/somente leitura/i)).toBeInTheDocument();
  expect(
    screen.queryByLabelText("Mensagem de bate-papo")
  ).not.toBeInTheDocument();
});
