import { useContext } from "react";
import { isPlayersTurn } from "../utils/stateUtils";
import { type GameState } from "../utils/api.types";
import { store } from "../store";
import { getPlayerColorMeta } from "../config/assetRegistry";
import { resolvePlayerDisplayName } from "../config/botCatalog";
import { getCurrentLanguage, useLanguage, type AppLanguage } from "../i18n";

import "./Prompt.scss";

export function humanizePrompt(
  currentPrompt: string,
  lang: AppLanguage = getCurrentLanguage()
): string {
  const en = lang === "en";
  switch (currentPrompt) {
    case "ROLL":
      return en ? "YOUR TURN — ROLL THE DICE" : "SUA VEZ — ROLE OS DADOS";
    case "PLAY_TURN":
      return en ? "YOUR TURN TO PLAY" : "SUA VEZ DE JOGAR";
    case "BUILD_INITIAL_SETTLEMENT":
      return en
        ? "BUILD YOUR INITIAL SETTLEMENT"
        : "CONSTRUA SUA ALDEIA INICIAL";
    case "BUILD_INITIAL_ROAD":
      return en ? "BUILD YOUR INITIAL ROAD" : "CONSTRUA SUA ESTRADA INICIAL";
    case "MOVE_ROBBER":
      return en ? "MOVE THE ROBBER TO A TILE" : "MOVA O LADRÃO PARA UM TERRENO";
    case "DISCARD":
      return en
        ? "DISCARD HALF OF YOUR CARDS"
        : "DESCARTE METADE DAS SUAS CARTAS";
    case "DECIDE_TRADE":
      return en
        ? "DECIDE ON THE TRADE OFFER"
        : "DECIDA SOBRE A PROPOSTA DE TROCA";
    case "DECIDE_ACCEPTEES":
      return en ? "CHOOSE WHOM TO TRADE WITH" : "ESCOLHA COM QUEM TROCAR";
    default: {
      const prompt = currentPrompt.replaceAll("_", " ");
      return en ? `ACTION: ${prompt}` : `AÇÃO: ${prompt}`;
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
  const { language, t } = useLanguage();
  const colorMeta = getPlayerColorMeta(language);
  const activeName = resolvePlayerDisplayName(
    gameState,
    gameState.current_color,
    colorMeta[gameState.current_color].label
  );

  let prompt = "";
  if (isBotThinking) {
    prompt = t(`🧭 ${activeName} pensando...`, `🧭 ${activeName} thinking...`);
  } else if (gameState.winning_color) {
    const winnerName = resolvePlayerDisplayName(
      gameState,
      gameState.winning_color,
      colorMeta[gameState.winning_color].label
    );
    prompt = t(
      `🏆 Fim de Jogo! Vitória de ${winnerName}!`,
      `🏆 Game Over! ${winnerName} wins!`
    );
  } else if (isPlayersTurn(gameState, state.perspective)) {
    prompt = humanizePrompt(gameState.current_prompt, language);
  } else if (!gameState.bot_colors.includes(gameState.current_color)) {
    prompt = t(
      `⏳ Aguardando jogada de ${activeName}...`,
      `⏳ Waiting for ${activeName}...`
    );
  }
  return <div className="prompt">{prompt}</div>;
}
