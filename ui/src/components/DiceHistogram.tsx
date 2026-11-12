import { useMemo } from "react";
import cn from "classnames";

import type { GameState } from "../utils/api.types";
import "./DiceHistogram.scss";

const DICE_SUMS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

const THEORETICAL_WEIGHTS: Record<number, number> = {
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  7: 6,
  8: 5,
  9: 4,
  10: 3,
  11: 2,
  12: 1,
};

interface DiceHistogramProps {
  gameState: GameState;
}

export default function DiceHistogram({ gameState }: DiceHistogramProps) {
  const { counts, totalRolls, lastSum, maxScale } = useMemo(() => {
    const map: Record<number, number> = {};
    for (const s of DICE_SUMS) map[s] = 0;

    let rolls = 0;
    let recent: number | null = null;
    for (const rec of gameState.action_records || []) {
      const action = rec?.[0];
      const result = rec?.[1];
      if (
        action &&
        action[1] === "ROLL" &&
        Array.isArray(result) &&
        result.length >= 2
      ) {
        const sum = Number(result[0]) + Number(result[1]);
        if (sum >= 2 && sum <= 12) {
          map[sum] = (map[sum] ?? 0) + 1;
          rolls += 1;
          recent = sum;
        }
      }
    }

    let highest = 1;
    for (const s of DICE_SUMS) {
      const expected = (THEORETICAL_WEIGHTS[s] / 36) * rolls;
      highest = Math.max(highest, map[s], expected);
    }

    return {
      counts: map,
      totalRolls: rolls,
      lastSum: recent,
      maxScale: highest,
    };
  }, [gameState.action_records]);

  const isBalanced = gameState.game?.dice_mode === "balanced";
  const deckRemaining = gameState.dice_deck_remaining;

  return (
    <section
      className="dice-histogram"
      aria-label="Estatísticas e distribuição dos dados"
    >
      <div className="dice-histogram__header">
        <div>
          <h3>Dados da Partida</h3>
          <span className="dice-histogram__count">
            {totalRolls === 0
              ? "Aguardando primeira rolagem"
              : `${totalRolls} rolagem(ns)`}
            {lastSum !== null ? ` · Último: ${lastSum}` : ""}
          </span>
        </div>
        <span
          className={cn("dice-histogram__mode-pill", {
            "is-balanced": isBalanced,
          })}
          title={
            isBalanced
              ? "Baralho de 36 combinações equilibradas (reembaralha com ≤ 5 cartas)"
              : "Rolagem clássica independente de 2 dados de 6 lados"
          }
        >
          {isBalanced
            ? `🎴 Equilibrados${
                typeof deckRemaining === "number" ? ` · ${deckRemaining}/36` : ""
              }`
            : "🎲 Padrão 2d6"}
        </span>
      </div>

      <div className="dice-histogram__bars" role="list">
        {DICE_SUMS.map((sum) => {
          const observed = counts[sum] ?? 0;
          const expected = (THEORETICAL_WEIGHTS[sum] / 36) * totalRolls;
          const heightPct =
            totalRolls > 0 ? Math.min(100, (observed / maxScale) * 100) : 0;
          const expectedPct =
            totalRolls > 0 ? Math.min(100, (expected / maxScale) * 100) : 0;
          const isHot = sum === 6 || sum === 8;
          const isSeven = sum === 7;
          const isLast = sum === lastSum;

          return (
            <div
              key={sum}
              className={cn("dice-histogram__col", {
                "is-hot": isHot,
                "is-seven": isSeven,
                "is-last": isLast,
              })}
              role="listitem"
              aria-label={`Número ${sum}: ${observed} vez(es)`}
              title={`Soma ${sum}: ${observed} vez(es) (esperado ~${expected.toFixed(1)})`}
            >
              <span className="dice-histogram__val">
                {observed > 0 ? observed : ""}
              </span>
              <div className="dice-histogram__track">
                {totalRolls > 0 && (
                  <span
                    className="dice-histogram__expected-tick"
                    style={{ bottom: `${expectedPct}%` }}
                  />
                )}
                <div
                  className="dice-histogram__fill"
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className="dice-histogram__label">{sum}</span>
            </div>
          );
        })}
      </div>

      <p className="dice-histogram__legend">
        Linha pontilhada indica a frequência teórica esperada para {totalRolls || 36}{" "}
        {totalRolls === 0 ? "jogadas" : "rolagens"}.
      </p>
    </section>
  );
}
