# Especificação de Design: Peças de Alto Contraste (Base Padrão) e Variante Vilarejo

- **Data:** 13/11/2026
- **Status:** Aprovado pelo Usuário
- **Escopo:** Interface de Peças (Aldeias, Cidades e Estradas), Sistema de Skin de Peças (`pieceSkin.ts`) e Toggle no HUD

---

## 1. Visão Geral e Motivação

Durante partidas de **Rule the Isle**, os modelos anteriores de aldeias (casinhas com chaminé, portas escuras e janelas) e estradas (tubulares arredondadas com ranhuras) apresentavam ruído visual excessivo e baixo contraste contra os biomas do mapa (especialmente montanhas escuras de minério e pedreiras de argila).

Após avaliação interativa no comparador visual com o cenário oficial do jogo, o usuário aprovou a **Opção 1 (B + Cidade A)**:
1. **Aldeias (Settlements):** Silhueta vetorial minimalista com contorno duplo de alto contraste (borda externa escura + borda interna branca de luz) e cor sólida saturada do jogador.
2. **Estradas (Roads):** Barra perfeitamente retangular e reta com extremidades retas (eliminando o formato tubular de salsicha) e borda dupla de proteção.
3. **Cidades (Cities):** Silhueta clássica da Opção A (torre alta pontiaguda à esquerda + salão nobre anexo à direita com telhado em 2 águas), finalizada com o acabamento de alto contraste da Opção B (arestas de luz brancas e borda dupla de alta definição).
4. **Variante de Peças:** A versão detalhada anterior (vilarejo com chaminé e estrada com textura) é preservada como variante selecionável (`cottage`).

---

## 2. Arquitetura do Sistema de Skins de Peças (`pieceSkin.ts`)

Seguindo o padrão estabelecido por `boardSkin.ts`, criamos um módulo dedicado e desacoplado:

- **Arquivo:** `ui/src/utils/pieceSkin.ts`
- **Skins Suportadas:**
  - `"contrast"`: *Alto Contraste* (Padrão / Default) — Aldeia B, Estrada B reta, Cidade A/B.
  - `"cottage"`: *Vilarejo Detalhado* (Variante) — Casinha com chaminé, porta e estrada tubular anterior.
- **Armazenamento:** `localStorage.getItem("catan_piece_skin_v1")` com fallback para `"contrast"`.
- **Comunicação Reativa:** Evento customizado `window.dispatchEvent(new CustomEvent("catan_piece_skin_changed", { detail: skin }))`.
- **Hook React:** `usePieceSkin()` que sincroniza o estado e atualiza os componentes em tempo real sem recarregar a página.

---

## 3. Especificação dos Componentes Visuais (`GameIcons.tsx`)

### 3.1. `SettlementSvgPiece`
- **Props:** `{ color: Color; scale?: number; skin?: PieceSkinId }`
- **Renderização (`contrast` - Padrão):**
  - Sombra de solo elíptica com opacidade de 78%.
  - Contorno externo preto/escuro de `2.6px` com `strokeLinejoin="round"`.
  - Miolo preenchido na cor pura da facção do jogador.
  - Aresta interna branca de reflexo nos cumes do telhado (`opacity="0.8"`).
  - Sem portas escuras ou chaminés.
- **Renderização (`cottage` - Variante):**
  - Mantém a casinha com chaminé e beiral shingle anterior.

### 3.2. `CitySvgPiece`
- **Props:** `{ color: Color; scale?: number; skin?: PieceSkinId }`
- **Renderização (`contrast` - Padrão):**
  - Sombra de solo elíptica ampliada (`rx="22" ry="6.5"`).
  - Silhueta de castelo escalonado: torre esquerda alta (`Y: -19`) + salão nobre direito (`Y: -9`).
  - Contorno externo preto/escuro de `2.8px` com `strokeLinejoin="round"`.
  - Miolo preenchido na cor do jogador com gradiente sutil ou tom ligeiramente iluminado na torre.
  - Linhas brancas de cume de telhado e divisor de volume (`stroke="#ffffff"`, `strokeWidth="1.8"`).
- **Renderização (`cottage` - Variante):**
  - Mantém o castelo com agulha cônica e frestas anteriores.

### 3.3. `RoadSvgPiece`
- **Props:** `{ color: Color; className?: string; skin?: PieceSkinId }`
- **Renderização (`contrast` - Padrão):**
  - Sombra de contato retangular limpa no solo.
  - Barra retangular perfeitamente reta (`x="3" y="6" width="94" height="18" rx="2"`).
  - Borda dupla: contorno externo preto `2.6px` + linha central specular branca (`opacity="0.8"`).
  - Miolo na cor pura do jogador.
- **Renderização (`cottage` - Variante):**
  - Mantém a barra chanfrada tubular anterior.

---

## 4. Integração no HUD do Jogo (`GameScreen.tsx`)

No dock lateral esquerdo (`game-left-dock`):
- Adicionado botão de alternância de estilo de peças com ícone 🏰 e tag (`Min` para Alto Contraste / `Det` para Detalhado).
- Ao clicar:
  - Invoca `togglePieceSkin()`.
  - Dispara toast snackbar informativo: *"Estilo das Peças: Alto Contraste (Padrão)"* ou *"Vilarejo Detalhado (Variante)"*.
  - Atualiza instantaneamente o tabuleiro, inventários e barras de ações via evento reativo.

---

## 5. Plano de Testes

1. **Testes Unitários de `pieceSkin.ts`:**
   - Fallback padrão para `"contrast"`.
   - Persistência e leitura do `localStorage`.
   - Função `togglePieceSkin()` alternando entre `"contrast"` e `"cottage"`.
   - Disparo do evento customizado.
2. **Testes de Componentes:**
   - `GameIcons.test.tsx` / `Node.test.tsx` / `Edge.test.tsx`:
     - Renderização de Aldeia, Cidade e Estrada com skin `"contrast"`.
     - Renderização com skin `"cottage"`.
3. **Validação de Build e Suite Completa:**
   - `npm run test -- --run` em `ui/`.
   - `tsc --noEmit`.
   - `npm run build`.
