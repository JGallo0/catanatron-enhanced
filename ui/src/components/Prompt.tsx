import { useContext } from "react";
import { isPlayersTurn } from "../utils/stateUtils";
import { type GameState } from "../utils/api.types";
import { store } from "../store";
import { PLAYER_COLOR_META } from "../config/assetRegistry";
import { resolvePlayerDisplayName } from "../config/botCatalog";

import "./Prompt.scss";

export function humanizePrompt(currentPrompt: string): string {
  switch (currentPrompt) {
    case "ROLL":
      return "SUA VEZ — ROLE OS DADOS";
    case "PLAY_TURN":
      return "SUA VEZ DE JOGAR";
    case "BUILD_INITIAL_SETTLEMENT":
      return "CONSTRUA SUA ALDEIA INICIAL";
    case "BUILD_INITIAL_ROAD":
      return "CONSTRUA SUA ESTRADA INICIAL";
    case "MOVE_ROBBER":
      return "MOVA O LADRÃO PARA UM TERRENO";
    case "DISCARD":
      return "DESCARTE METADE DAS SUAS CARTAS";
    case "DECIDE_TRADE":
      return "DECIDA SOBRE A PROPOSTA DE TROCA";
    case "DECIDE_ACCEPTEES":
      return "ESCOLHA COM QUEM TROCAR";
    default: {
      const prompt = currentPrompt.replaceAll("_", " ");
      return `AÇÃO: ${prompt}`;
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
  const activeName = resolvePlayerDisplayName(
    gameState,
    gameState.current_color,
    PLAYER_COLOR_META[gameState.current_color].label
  );

  let prompt = "";
  if (isBotThinking) {
    prompt = `🧭 ${activeName} pensando...`;
  } else if (gameState.winning_color) {
    const winnerName = resolvePlayerDisplayName(
      gameState,
      gameState.winning_color,
      PLAYER_COLOR_META[gameState.winning_color].label
    );
    prompt = `🏆 Fim de Jogo! Vitória de ${winnerName}!`;
  } else if (isPlayersTurn(gameState, state.perspective)) {
    prompt = humanizePrompt(gameState.current_prompt);
  } else if (!gameState.bot_colors.includes(gameState.current_color)) {
    prompt = `⏳ Aguardando jogada de ${activeName}...`;
  }
  return <div className="prompt">{prompt}</div>;
}
