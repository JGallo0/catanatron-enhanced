import { useContext } from "react";
import { isPlayersTurn } from "../utils/stateUtils";
import { type GameState } from "../utils/api.types";
import { store } from "../store";
import { PLAYER_COLOR_META } from "../config/assetRegistry";

import "./Prompt.scss";

function humanizePrompt(currentPrompt: string): string {
  switch (currentPrompt) {
    case "ROLL":
    case "PLAY_TURN":
      return "YOUR TURN";
    case "BUILD_INITIAL_SETTLEMENT":
    case "BUILD_INITIAL_ROAD":
    default: {
      const prompt = currentPrompt.replaceAll("_", " ");
      return `PLEASE ${prompt}`;
    }
  }
}

export default function Prompt({
  gameState,
  isBotThinking,
}: {
  gameState: GameState;
  isBotThinking: boolean;
}) {
  const { state } = useContext(store);
  const activeName =
    gameState.seat_names?.[gameState.current_color] ||
    PLAYER_COLOR_META[gameState.current_color].label;

  let prompt = "";
  if (isBotThinking) {
    prompt = `🤖 IA (${activeName}) pensando...`;
  } else if (gameState.winning_color) {
    prompt = `Game Over. Congrats, ${gameState.winning_color}!`;
  } else if (isPlayersTurn(gameState, state.perspective)) {
    prompt = humanizePrompt(gameState.current_prompt);
  } else if (!gameState.bot_colors.includes(gameState.current_color)) {
    prompt = `⏳ Aguardando jogada de ${activeName}...`;
  }
  return <div className="prompt">{prompt}</div>;
}
