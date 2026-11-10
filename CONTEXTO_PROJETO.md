# 🏝️ Catanatron Enhanced — Contexto Cross-Máquina do Projeto

Este documento consolida **todo o histórico, arquitetura, decisões de design e guia de ilustrações** do projeto **Catanatron Enhanced** (`https://github.com/JGallo0/catanatron-enhanced`), permitindo continuar o desenvolvimento de qualquer computador (ex.: PC de casa) com contexto 100% preservado.

---

## 1. Visão Geral e Objetivos
- **Base:** Fork modernizado do `bcollazo/catanatron` (mantendo licença **GPL-3.0**).
- **Idioma:** **100% em Português Brasileiro (`pt-BR`)** em todas as telas, botões, prompts, logs de jogadas, modais e notificações.
- **Direção Visual:** Inspirada no **Catan Universe (Steam)** — estética *Modern Tabletop Dark* (`#071526` oceano profundo), hexágonos com ilustrações ricas e praias de areia dourada (`#fde68a`), fichas numéricas estilo marfim/madeira, peças 3D claras para cada jogador (Aldeias, Cidades, Estradas) e baralho de cartas ilustradas na doca inferior.
- **Hospedagem Online:** Deploy contínuo na **Vercel** conectado ao branch `main` do GitHub (`https://github.com/JGallo0/catanatron-enhanced`).

---

## 2. Arquitetura Técnica e Estrutura de Arquivos

### Frontend (`ui/`) — React 19 + TypeScript + Vite + SCSS
- **[`ui/src/config/assetRegistry.ts`](ui/src/config/assetRegistry.ts):** Registro central de metadados em `pt-BR` de todos os Recursos (`WOOD`, `BRICK`, `SHEEP`, `WHEAT`, `ORE`), Deserto (`DESERT`), Cartas de Desenvolvimento (`KNIGHT`, `VICTORY_POINT`, `ROAD_BUILDING`, `YEAR_OF_PLENTY`, `MONOPOLY`), Cores de Jogadores (`RED`, `BLUE`, `ORANGE`, `WHITE`), Custos de Construção e caminhos para as ilustrações customizadas do **Nano Banana Pro**.
- **[`ui/src/components/icons/GameIcons.tsx`](ui/src/components/icons/GameIcons.tsx):**
  - `HybridIllustration`: Carregador inteligente que tenta carregar automaticamente imagens customizadas em `.webp`, `.png` ou `.jpg` dentro de `ui/public/assets/illustrations/...` e faz fallback imediato para os componentes vetoriais caso a imagem ainda não exista.
  - `TerrainHexIllustration`: Dioramas vetoriais estilo Catan Universe para Floresta, Colinas de Argila, Pastagem de Ovelhas, Campos de Trigo, Montanha de Minério e Oásis no Deserto.
  - `CardArtIllustration`: Arte de fundo das cartas de Recurso e Desenvolvimento.
  - `SettlementSvgPiece` & `CitySvgPiece`: Peças 3D de tabuleiro para Aldeia (1 PV) e Cidade (2 PV) na cor de cada jogador.
  - `DiceFaceSvg` & `RobberPawnSvg`: Dados visuais 2D6 e peão do Ladrão.
- **Tabuleiro e Câmera (`ui/src/pages/`):**
  - [`Board.tsx`](ui/src/pages/Board.tsx) & [`Board.scss`](ui/src/pages/Board.scss): Cálculo centralizado da ilha descontando a barra lateral esquerda (`300px`) e a doca inferior (`175px`), garantindo que o tabuleiro nasça centralizado na tela.
  - [`ZoomableBoard.tsx`](ui/src/pages/ZoomableBoard.tsx): Controle de zoom/pan (`react-zoom-pan-pinch`) com exclusão de classes clicáveis (`node--buildable`, `edge--buildable`, `pulse`) para que cliques em vértices e estradas nunca sejam engolidos pelo arrasto da câmera.
  - [`Tile.tsx`](ui/src/pages/Tile.tsx) & [`Tile.scss`](ui/src/pages/Tile.scss): Renderização dos hexágonos com costa de areia dourada, fichas numéricas com pontos de probabilidade (`•` a `•••••`) e portos marítimos (`3:1` e `2:1`).
  - [`Node.tsx`](ui/src/pages/Node.tsx) & [`Edge.tsx`](ui/src/pages/Edge.tsx): Vértices (Aldeias/Cidades) e Arestas (Estradas) com indicadores pulsantes de construção.
- **HUD, Jogadores, Cartas e Modais (`ui/src/components/` & `ui/src/pages/`):**
  - [`PlayerStateBox.tsx`](ui/src/components/PlayerStateBox.tsx) & [`PlayerStateBox.scss`](ui/src/components/PlayerStateBox.scss): Card de cada jogador na barra esquerda exibindo nome, badge `HUMANO`/`BOT`, Pontos de Vitória (`PV`), cartas na mão, **inventário visual de peças construídas (`🏠 Aldeias X/5`, `🏰 Cidades X/4`, `🛤️ Estradas X/15`)** com miniaturas 3D coloridas, Cavaleiros e Maior Estrada.
  - [`ResourceCards.tsx`](ui/src/components/ResourceCards.tsx): Renderiza tanto a versão compacta (nos cards laterais) quanto o **baralho completo ilustrado (`showEmptySlots={true}`)** na doca inferior do jogador, mostrando sempre os 5 tipos de recurso (`Madeira`, `Argila`, `Lã`, `Trigo`, `Minério`) e as Cartas de Desenvolvimento.
  - [`ActionsToolbar.tsx`](ui/src/pages/ActionsToolbar.tsx) & [`ActionsToolbar.scss`](ui/src/pages/ActionsToolbar.scss): Doca inferior com dados 2D6, mão de cartas ilustradas e botões de ação (`Custos`, `Usar Carta`, `Construir`, `Trocar`, `Rolar Dados` / `Passar Vez`).
  - [`TradeModal.tsx`](ui/src/components/TradeModal.tsx): Bancada visual de Troca Marítima e Portos (`4:1`, `3:1`, `2:1`).
  - [`RobberVictimModal.tsx`](ui/src/components/RobberVictimModal.tsx): Modal para escolher de qual jogador roubar ao mover o Ladrão.
  - [`RightDrawer.tsx`](ui/src/components/RightDrawer.tsx): Gaveta recolhível de análise de IA MCTS (aberta pelo botão `📊 Chances (IA)` no topo).
- **Lobby, Contas e Motor Local Fallback:**
  - [`HomePage.tsx`](ui/src/pages/HomePage.tsx) & [`RoomLobbyPage.tsx`](ui/src/pages/RoomLobbyPage.tsx): Tela inicial e sala de espera multiplayer (`pt-BR`) com login rápido (usuário + PIN), criação de sala privada com link compartilhável (`/lobbies/:roomId`), adição de Bots (`RANDOM`, `WEIGHTED_RANDOM`, `VICTORY_POINT`, `AB_2`, `AB_4`) e partida rápida.
  - [`ui/src/utils/apiClient.ts`](ui/src/utils/apiClient.ts) & [`ui/src/utils/localEngine.ts`](ui/src/utils/localEngine.ts): Cliente de API com fallback automático (`localEngine.ts`) que executa toda a lógica de Catan, salas, contas e Bots diretamente no navegador caso o backend serverless da Vercel sofra *cold start* ou perda de memória efêmera entre funções.

### Backend (`api/` e `catanatron/`) — Flask + Vercel Python Serverless
- **[`vercel.json`](vercel.json) & [`api/index.py`](api/index.py):** Entrada Serverless Python (`3.12` via `.python-version`) na Vercel que roteia `/api/*` para o Flask (`catanatron.web`).
- **[`catanatron/catanatron/web/api.py`](catanatron/catanatron/web/api.py) & [`models.py`](catanatron/catanatron/web/models.py):** Endpoints REST para jogos (`/api/games`), salas (`/api/rooms`), autenticação (`/api/auth/login`, `/api/auth/me`) e análise MCTS.

---

## 3. Como Rodar no PC de Casa

```bash
# 1. Clonar o repositório
git clone https://github.com/JGallo0/catanatron-enhanced.git
cd catanatron-enhanced

# 2. Instalar dependências do frontend e rodar servidor de desenvolvimento
cd ui
npm install
npm run dev

# 3. Rodar testes e build de produção
npx vitest run
npm run build
```

> **Nota:** Graças ao [`localEngine.ts`](ui/src/utils/localEngine.ts), você pode rodar apenas `cd ui && npm run dev` no PC de casa sem nem precisar subir o Docker/Flask em Python para testar o visual, o tabuleiro, as cartas e partidas completas contra Bots!

---

## 4. Guia Completo de Ilustrações (Nano Banana Pro)

Salve as imagens geradas nas pastas dentro de `ui/public/assets/illustrations/` (aceita `.webp`, `.png` ou `.jpg` — o código detecta qualquer uma dessas extensões automaticamente).

> **Prompt Base de Estilo (anexar ao final de cada prompt):**
> `"stylized digital board game art, Catan Universe Steam style, hand-painted tabletop illustration, warm vibrant lighting, rich textures, clean composition, no text, no letters, no numbers, no UI borders"`

### A. Hexágonos de Terreno (`ui/public/assets/illustrations/tiles/`) — `1:1` (`1024×1024 px`)
1. **`wood.webp` (ou `wood.png`) — Floresta (Madeira):**
   `Lush dense pine and oak forest from top-down 3/4 isometric board game view, stacked timber logs by a small lumberjack clearing, sunlit emerald canopy, Catan Universe tabletop tile art, no text`
2. **`brick.webp` (ou `brick.png`) — Colinas (Argila):**
   `Terracotta clay hills and red canyon quarry from top-down 3/4 board game view, excavated red clay pits, stacked kilned bricks, warm sunset tones, Catan Universe tabletop tile art, no text`
3. **`sheep.webp` (ou `sheep.png`) — Pastagem (Lã):**
   `Rolling bright green pasture hills from top-down 3/4 board game view, cute fluffy white sheep grazing near a wooden fence and wildflowers, Catan Universe tabletop tile art, no text`
4. **`wheat.webp` (ou `wheat.png`) — Campos (Trigo):**
   `Golden ripe wheat fields blowing in the wind from top-down 3/4 board game view, harvested grain sheaves and a rustic medieval windmill, warm golden hour glow, Catan Universe tabletop tile art, no text`
5. **`ore.webp` (ou `ore.png`) — Montanha (Minério):**
   `Jagged alpine rock mountains from top-down 3/4 board game view, snow-dusted peaks, exposed iron and silver ore veins glowing subtly, mine cart track entrance, Catan Universe tabletop tile art, no text`
6. **`desert.webp` (ou `desert.png`) — Deserto (Oásis):**
   `Golden sand dunes from top-down 3/4 board game view, small turquoise desert oasis with palm trees and ancient stone ruins, warm desert sun, Catan Universe tabletop tile art, no text`
7. **`water.webp` (ou `water.png`) — Oceano *(opcional)*:**
   `Stylized painterly turquoise and deep blue ocean waves from top-down board game view, subtle sea foam swirls, Catan Universe tabletop water texture, seamless, no text`

### B. Cartas de Recursos (`ui/public/assets/illustrations/cards/`) — `3:4` (`768×1024 px`)
8. **`wood.webp` (ou `wood.png`) — Carta de Madeira:**
   `Close-up illustration of freshly cut oak and pine timber logs bound with rope in a sunlit forest, fantasy board game resource card art, Catan Universe style, vertical 3:4, no text, no frame`
9. **`brick.webp` (ou `brick.png`) — Carta de Argila:**
   `Close-up illustration of warm kiln-fired red clay bricks stacked beside raw terracotta clay in a quarry, fantasy board game resource card art, Catan Universe style, vertical 3:4, no text, no frame`
10. **`sheep.webp` (ou `sheep.png`) — Carta de Lã:**
    `Close-up illustration of a fluffy white sheep and soft bundles of freshly spun wool in a sunny green meadow, fantasy board game resource card art, Catan Universe style, vertical 3:4, no text, no frame`
11. **`wheat.webp` (ou `wheat.png`) — Carta de Trigo:**
    `Close-up illustration of golden harvested wheat sheaves tied with twine under a warm summer sky, fantasy board game resource card art, Catan Universe style, vertical 3:4, no text, no frame`
12. **`ore.webp` (ou `ore.png`) — Carta de Minério:**
    `Close-up illustration of rough dark mountain rock split open revealing gleaming iron and silver ore crystals, pickaxe beside it, fantasy board game resource card art, Catan Universe style, vertical 3:4, no text, no frame`

### C. Cartas de Desenvolvimento (`ui/public/assets/illustrations/dev/`) — `3:4` (`768×1024 px`)
13. **`knight.webp` (ou `knight.png`) — Cavaleiro:**
    `Medieval armored knight on horseback holding a lance and shield on a hill guarding the island of Catan, heroic fantasy board game card illustration, Catan Universe style, vertical 3:4, no text`
14. **`victory_point.webp` (ou `victory_point.png`) — Ponto de Vitória:**
    `Grand medieval university and cathedral square with golden banners celebrating under sunlight, fantasy board game card illustration, Catan Universe style, vertical 3:4, no text`
15. **`road_building.webp` (ou `road_building.png`) — Construção de Estradas:**
    `Medieval settlers and stone masons building a cobblestone road and wooden bridge across lush hills, fantasy board game card illustration, Catan Universe style, vertical 3:4, no text`
16. **`year_of_plenty.webp` (ou `year_of_plenty.png`) — Ano da Fartura:**
    `Overflowing golden cornucopia basket filled with timber, bricks, wool, wheat, and ore on a festive wooden table, fantasy board game card illustration, Catan Universe style, vertical 3:4, no text`
17. **`monopoly.webp` (ou `monopoly.png`) — Monopólio:**
    `Wealthy medieval merchant guild master at a harbor counting chest of gold and trade goods with ships in background, fantasy board game card illustration, Catan Universe style, vertical 3:4, no text`
18. **`card_back.webp` (ou `card_back.png`) — Verso da Carta *(opcional)*:**
    `Ornate medieval compass rose and golden island crest embossed on dark royal blue leather card back, symmetrical board game card back design, vertical 3:4, no text`

### D. Peças e UI (`ui/public/assets/illustrations/ui/`)
19. **`robber.webp` (ou `robber.png`) — Peão do Ladrão (`512×512` fundo transparente)**
20. **`largest_army.webp` (ou `largest_army.png`) — Medalha Maior Exército (`512×512`)**
21. **`longest_road.webp` (ou `longest_road.png`) — Medalha Maior Estrada (`512×512`)**
22. **`lobby_hero.webp` (ou `lobby_hero.png`) — Banner de Fundo da Tela Inicial (`1920×1080`)**

---

## 5. Próximos Passos Planejados (Para Continuar do PC de Casa)
1. **Integrar as ilustrações geradas no Nano Banana Pro** em `ui/public/assets/illustrations/` e ajustar enquadramento/contraste se necessário.
2. **Persistência Multiplayer Online Completa (Banco Externo na Vercel):** Conectar uma instância gratuita do **Neon Postgres** ou **Supabase** na variável `DATABASE_URL` do painel da Vercel para que salas compartilhadas entre diferentes computadores persistam no banco SQL em nuvem (além do `localEngine` e da memória do container Python).
3. **Efeitos Sonoros e Animações Extras:** Sons opcionais de dados rolando, construção de aldeia/estrada e recebimento de cartas.
