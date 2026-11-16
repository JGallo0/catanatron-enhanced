import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { compile } from "sass";

let styleElement: HTMLStyleElement;

beforeAll(() => {
  styleElement = document.createElement("style");
  styleElement.textContent = compile("src/pages/GameScreen.scss").css;
  document.head.appendChild(styleElement);
});

afterAll(() => {
  styleElement.remove();
});

describe("GameScreen robber notice styles", () => {
  test("shows the complete robber message instead of truncating it", () => {
    const notice = document.createElement("div");
    notice.className = "game-robber-notice game-robber-notice--safe";
    notice.innerHTML = `
      <span class="game-robber-notice__badge">LADRÃO</span>
      <span class="game-robber-notice__text">Guire moveu o Ladrão para 9 (Ovelha) e roubou 1 recurso de Felire • Você não foi roubado!</span>
    `;
    document.body.appendChild(notice);

    const noticeStyles = getComputedStyle(notice);
    const textStyles = getComputedStyle(
      notice.querySelector(".game-robber-notice__text") as HTMLElement
    );

    expect(noticeStyles.whiteSpace).toBe("normal");
    expect(noticeStyles.overflow).toBe("visible");
    expect(textStyles.whiteSpace).toBe("normal");
    expect(textStyles.overflow).toBe("visible");

    notice.remove();
  });
});
