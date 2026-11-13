# Confirmação de Construção Estilo Catan Universe, Alto Contraste de Peças e Enquadramento do Tabuleiro — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o fluxo de confirmação obrigatória de construção em 2 etapas com botão verde proeminente `[✔]` e peça fantasma no tabuleiro (estilo Catan Universe), redesenhar as peças de aldeia, cidade e estrada para alto contraste visual sobre todos os biomas, e calibrar o enquadramento padrão do tabuleiro ao iniciar a partida ("Safe-Area All-in-View") para que 100% da ilha e dos 9 portos fiquem visíveis sem corte.

**Architecture:** 
1. `Board.tsx`: deduz a área útil das barras flutuantes superior (~105px) e inferior (~125px), ajusta `numLevels = 8.3` e centraliza o tabuleiro no ponto médio livre para enquadramento perfeito na inicialização.
2. `GameIcons.tsx` & `Board.scss`: moderniza os SVGs de `SettlementSvgPiece`, `CitySvgPiece` e `RoadSvgPiece` com escala +25%, contorno duplo de alto contraste e preenchimentos primários saturados e reluzentes.
3. `ZoomableBoard.tsx`, `Node.tsx`, `Edge.tsx`: ativa a confirmação por padrão, renderiza a peça fantasma iluminada no tabuleiro na seleção prévia e exibe o botão flutuante verde `[✔]` (estilo Catan Universe) para confirmação de jogada.

**Tech Stack:** React 18, TypeScript, SCSS, SVG Vector Graphics, Vitest, `@testing-library/react`.

## Global Constraints
- Seguir padrão de idioma do projeto: labels de UI bilíngues (PT / EN) via `useLanguage()` / `t()`.
- Nunca quebrar os testes existentes de `Board.test.tsx`, `ZoomableBoard.test.tsx` e `GameScreen.test.tsx`.
- Todos os comandos Git e terminais devem ser executados estritamente dentro de `C:\Users\JoãoGallo\OneDrive - Astra Solar\Documentos\CBAM\1`.

---

### Task 1: Enquadramento Seguro do Tabuleiro na Inicialização ("Safe-Area All-in-View")
**Arquivos afetados:**
- `ui/src/pages/Board.tsx`
- `ui/src/pages/Board.test.tsx`
- `ui/src/pages/Board.scss`

**Passos:**
- [ ] 1. Em `ui/src/pages/Board.tsx`, criar constantes de clearance vertical para os HUDs flutuantes:
  ```ts
  const TOP_HUD_CLEARANCE = 105;
  const BOTTOM_CONSOLE_CLEARANCE = 125;
  ```
- [ ] 2. Ajustar o cálculo de `availableHeight` para deduzir essa folga da altura da janela:
  ```ts
  const totalVerticalClearance = isCompactHeight ? 120 : isMobile ? 180 : (TOP_HUD_CLEARANCE + BOTTOM_CONSOLE_CLEARANCE);
  const availableCanvasHeight = Math.max(260, canvasHeight - totalVerticalClearance);
  ```
- [ ] 3. Em `computeDefaultSize`, atualizar `numLevels` de `7.0` para `8.3` para garantir que o anel exterior com os 9 navios e as placas de troca (2:1 e 3:1) caibam com margem de mar uniforme.
- [ ] 4. Calibrar o ponto vertical central `center[1]` para o ponto médio da área livre entre a barra superior e a inferior:
  ```ts
  const center: [number, number] = [
    canvasWidth / 2,
    TOP_HUD_CLEARANCE + (availableCanvasHeight / 2),
  ];
  ```
- [ ] 5. Rodar `npx vitest run ui/src/pages/Board.test.tsx` e ajustar asserções se necessário.
- [ ] 6. Commitar: `git commit -m "feat(board): calibrate safe-area framing and numlevels for complete harbor visibility"`

---

### Task 2: Modelagem de Alto Contraste para Aldeias, Cidades e Estradas
**Arquivos afetados:**
- `ui/src/components/icons/GameIcons.tsx`
- `ui/src/pages/Board.scss`
- `ui/src/pages/Node.tsx`
- `ui/src/pages/Edge.tsx`

**Passos:**
- [ ] 1. Em `ui/src/components/icons/GameIcons.tsx`, atualizar a paleta de peças `getPiecePalette(color)` para cores puras, saturadas e luminosas (evitando tons marrons/escuros no corpo):
  - Vermelho: `#EF4444` vívido, telhado carmesim luminoso `#F87171` e acabamento nítido.
  - Azul: `#2563EB` royal vivo, telhado safira `#60A5FA` e realce branco.
  - Laranja: `#F59E0B` âmbar dourado vívido, realce `#FDE68A`.
  - Branco: `#FFFFFF` marfim puro com contorno dourado/ardósia de alto contraste.
- [ ] 2. Redesenhar `SettlementSvgPiece` com silhueta clássica de casa, telhado de 2 águas pontudo, chaminé contrastante, porta arqueada e contorno de 2.2px de alto contraste. Aumentar proporção do container de `size * 0.64` para `size * 0.80`.
- [ ] 3. Redesenhar `CitySvgPiece` com silhueta de castelo/fortaleza robusta, duas torres, ameias (crenellations) bem definidas e contorno de 2.2px de alto contraste. Aumentar proporção do container de `size * 0.72` para `size * 0.90`.
- [ ] 4. Redesenhar `RoadSvgPiece` em `GameIcons.tsx` e `Edge.tsx` com altura aumentada (de 15px para 22px no desktop, 18px no mobile), bordas chanfradas e realce de relevo 3D.
- [ ] 5. Em `Board.scss`, atualizar `.road`, `.road-piece`, `.building-piece` com filtros de sombra projetada multi-ângulo para fazer as peças saltarem sobre qualquer bioma de hexágono.
- [ ] 6. Commitar: `git commit -m "feat(pieces): redesign settlements cities and roads with high-contrast tabletop silhouettes"`

---

### Task 3: Confirmação de Construção Obrigatória Estilo Catan Universe com Peça Fantasma e Botão `[✔]`
**Arquivos afetados:**
- `ui/src/pages/ZoomableBoard.tsx`
- `ui/src/pages/Board.tsx`
- `ui/src/pages/Node.tsx`
- `ui/src/pages/Edge.tsx`
- `ui/src/pages/Board.scss`
- `ui/src/pages/ZoomableBoard.test.tsx`

**Passos:**
- [ ] 1. Em `ui/src/pages/ZoomableBoard.tsx`, alterar `loadSavedConfirmPlacement()` para retornar `true` por padrão:
  ```ts
  function loadSavedConfirmPlacement(): boolean {
    try {
      const saved = localStorage.getItem(CONFIRM_PLACEMENT_STORAGE_KEY);
      return saved === null ? true : saved === "1";
    } catch {
      return true;
    }
  }
  ```
- [ ] 2. Passar a cor do jogador atual e o tipo da peça provisória para `Board`, `Node` e `Edge` para desenhar a **peça fantasma ("ghost piece")**:
  - Em `Node.tsx`, se `isPending` for verdadeiro, renderizar a `Building` com classe adicional `building-piece--ghost` (opacidade 88%, leve pulsação e anel dourado).
  - Em `Edge.tsx`, se `isPending` for verdadeiro, renderizar a `Road` com classe adicional `road-piece--ghost` (opacidade 88%, borda dourada pulsante).
- [ ] 3. Criar o botão flutuante proeminente estilo Catan Universe (Print 1):
  - Componente `.cu-placement-confirm-dock` posicionado no quadrante direito da tela.
  - Botão principal verde esmeralda `[✔]` de grande impacto visual, com ícone de checkmark, pulsação suave e título `Confirmar Construção`.
  - Botão secundário de cancelamento `[✕]` para desistir da seleção.
  - Manter suporte ao 2º clique direto na peça fantasma para confirmar alternativamente.
- [ ] 4. Atualizar os testes unitários em `ZoomableBoard.test.tsx` para cobrir o fluxo de confirmação ativa por padrão e o clique nos botões `[✔]` e `[✕]`.
- [ ] 5. Commitar: `git commit -m "feat(board): add catan universe style ghost placement preview and prominent confirm check button"`

---

### Task 4: Validação Integrada, Vitest, Typecheck, Build de Produção e Sincronização
**Arquivos afetados:**
- `CONTEXTO_PROJETO.md`

**Passos:**
- [ ] 1. Rodar os testes unitários do frontend:
  ```powershell
  npx vitest run Board.test.tsx ZoomableBoard.test.tsx GameScreen.test.tsx
  ```
- [ ] 2. Rodar a verificação de tipos TypeScript:
  ```powershell
  npx tsc --noEmit
  ```
- [ ] 3. Rodar o build de produção:
  ```powershell
  npm run build
  ```
- [ ] 4. Atualizar `CONTEXTO_PROJETO.md` documentando o Bloco 16 (Confirmação Catan Universe, Alto Contraste de Peças e Enquadramento Safe-Area).
- [ ] 5. Commitar e enviar para o repositório remoto:
  ```powershell
  git push origin main
  ```
