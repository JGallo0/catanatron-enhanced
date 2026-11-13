# 👑 Rule the Isle — Contexto Cross-Máquina do Projeto

Este documento consolida **todo o histórico, arquitetura, decisões de design e guia de ilustrações** do projeto **Rule the Isle** (originalmente iniciado como *Catanatron Enhanced*, `https://github.com/JGallo0/catanatron-enhanced`), permitindo continuar o desenvolvimento de qualquer computador (ex.: PC de casa) com contexto 100% preservado.

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
  - `HarborPortSvg`: Portos ilustrados com píeres de madeira, cargas por tipo de recurso, caravelas balançando sobre o mar turquesa e placas de câmbio (`2:1` / `3:1`).
  - `CardArtIllustration`: Arte de fundo das cartas de Recurso e Desenvolvimento.
  - `SettlementSvgPiece`, `CitySvgPiece`, `RoadSvgPiece`, `AwardStarSvg`, `DiceFaceSvg` & `RobberPawnSvg`: Peças artesanais 3D de Aldeia, Cidade/Fortaleza, Estrada em madeira/pedra, estrela de conquista (Maior Exército / Maior Estrada), dados e peão do Ladrão.
- **Tabuleiro, Oceano e Câmera (`ui/src/pages/` & `ui/src/components/`):**
  - [`OceanBackdrop.tsx`](ui/src/components/OceanBackdrop.tsx) & [`ocean_backdrop.webp`](ui/public/assets/illustrations/ui/ocean_backdrop.webp): Cenário panorâmico de mar ao pôr do sol atrás de toda a partida (ondas animadas, reflexos solares, ilhas distantes, castelo, farol e embarcações), cercando a ilha do tabuleiro.
  - [`Board.tsx`](ui/src/pages/Board.tsx) & [`Board.scss`](ui/src/pages/Board.scss): Cálculo responsivo baseado nas dimensões medidas via `ResizeObserver` (`ZoomableBoard.tsx`), anel de água turquesa costeira (`.board__seascape-underlay`), marolas e rosa dos ventos ao redor do tabuleiro, garantindo espaço livre para os portos externos em desktop e tablets.
  - [`ZoomableBoard.tsx`](ui/src/pages/ZoomableBoard.tsx): Controle de zoom/pan (`react-zoom-pan-pinch`), exclusão de classes clicáveis (`node--buildable`, `edge--buildable`, `pulse`), seleção de vítima ao mover o Ladrão com nomes reais (`seat_names`) e modo opcional **Confirmar jogada** (`catan_confirm_placement_v1`).
  - [`Tile.tsx`](ui/src/pages/Tile.tsx) & [`Tile.scss`](ui/src/pages/Tile.scss): Renderização dos hexágonos com costa de areia dourada, fichas numéricas com pontos de probabilidade (`•` a `•••••`) e portos marítimos ilustrados ancorados nas arestas da ilha.
  - [`Node.tsx`](ui/src/pages/Node.tsx) & [`Edge.tsx`](ui/src/pages/Edge.tsx): Vértices (Aldeias/Cidades) e Arestas (Estradas) com indicadores pulsantes e destaque temporário (`.node--recent` / `.edge--recent`).
- **HUD, Jogadores, Cartas, Chat, Dados 3D e Modais (`ui/src/components/` & `ui/src/pages/`):**
  - **[`PlayerTopBar.tsx`](ui/src/components/PlayerTopBar.tsx) & [`PlayerTopBar.scss`](ui/src/components/PlayerTopBar.scss):** Barra superior de jogadores com visual escuro polido, layout compacto automático abaixo de `980px` e `768px`, avatares SVG 100% originais ([`PlayerAvatar.tsx`](ui/src/components/PlayerAvatar.tsx)) e diálogo **tap-to-inspect** ao tocar em qualquer jogador:
    - **Retrato e Provocações:** Avatar SVG com moldura por mérito e efeitos animados de provocações/saudações diretamente no retrato (`.cu-portrait-taunt-fx` + `.cu-portrait-taunt-bubble`).
    - **Grid de Estatísticas e Conquistas:** Ícones vetoriais nítidos para Cavaleiros, Estrada, Recursos (alerta pulsante acima do limite de descarte), Dev Cards e PV, com estrela dourada `AwardStarSvg` ao lado de Cavaleiros/Estrada conforme o detentor atual de Maior Exército / Maior Estrada.
    - **Animações na Mesa:** Cartas descartadas ao rolar 7 exibidas publicamente sobre o card do jogador (`.cu-discard-drop-row`), ganhos de produção (`.cu-float-yield-pill`) e deltas de PV (`.cu-float-vp-badge`).
  - **[`LeftDrawer.tsx`](ui/src/components/LeftDrawer.tsx):** Gaveta lateral recolhível contendo histórico detalhado em `pt-BR`, meta de PV, turno atual e alternador de perspectiva (`Espectador` / `Visão do Assento`).
  - **[`RightDrawer.tsx`](ui/src/components/RightDrawer.tsx) & [`DiceHistogram.tsx`](ui/src/components/DiceHistogram.tsx):** Gaveta de probabilidades MCTS (`📊 Chances (IA)`) e histograma ao vivo dos dados rolados vs distribuição teórica (`Dados Equilibrados` / `Dados Clássicos`).
  - **[`AlmanacModal.tsx`](ui/src/components/AlmanacModal.tsx):** Guia ilustrado em abas (Construções & Custos, Cartas de Desenvolvimento & Conquistas, Modos de Mapa & Regras de Dados).
  - **[`GameChatPanel.tsx`](ui/src/components/GameChatPanel.tsx) & [`tauntCatalog.ts`](ui/src/config/tauntCatalog.ts):** Bate-papo em tempo real durante a partida (frases rápidas + envio livre + contador de não lidas) e menu de provocações/saudações animadas (`CHAT` / `TAUNT`, cooldown de `3s`).
  - [`ResourceCards.tsx`](ui/src/components/ResourceCards.tsx) & [`PlayerStateBox.scss`](ui/src/components/PlayerStateBox.scss): Baralho completo ilustrado (`showEmptySlots={true}`) sempre mostrando os 5 recursos + Cartas de Desenvolvimento.
  - [`ActionsToolbar.tsx`](ui/src/pages/ActionsToolbar.tsx) & [`ActionsToolbar.scss`](ui/src/pages/ActionsToolbar.scss): Doca inferior em 3 zonas com dados **3D** compactos (`<Dice3D variant="mini" />`), centralização segura do leque de cartas sem cortes laterais e botão principal dourado.
  - [`TradeModal.tsx`](ui/src/components/TradeModal.tsx) & [`TradeOfferDecisionDialog.tsx`](ui/src/components/TradeOfferDecisionDialog.tsx): Bancada unificada com abas **🤝 Entre Jogadores** (negociação doméstica em 3 etapas `OFFER_TRADE` → `DECIDE_TRADE` → `DECIDE_ACCEPTEES`) e **⚓ Porto & Banco** (`4:1`, `3:1`, `2:1`).
  - [`GameScreen.tsx`](ui/src/pages/GameScreen.tsx), [`GameScreen.scss`](ui/src/pages/GameScreen.scss), [`tabletopPacing.ts`](ui/src/utils/tabletopPacing.ts), [`MatchIntroOverlay.tsx`](ui/src/components/MatchIntroOverlay.tsx), [`DiceRollOverlay.tsx`](ui/src/components/DiceRollOverlay.tsx) & [`Dice3D.tsx`](ui/src/components/Dice3D.tsx): Dock vertical esquerdo (`z-index: 44`, clicável), apresentação inicial `"Boa Guerra"` de `10s` (`INTRO_SPLASH_MS = 10000`) com botão *Zarpar para a Ilha*, velocidades `Normal (4x)` / `Rápida (1x)` / `Turbo (0.5x)` com ações dos bots dobradas, banner de transição `"Vez de <Jogador>"` (`3s`, `TURN_TRANSITION_MS = 3000`), dados **3D CSS `preserve-3d`** (`Dice3D`) com duração de rolagem dobrada, pílula de desfecho do Ladrão (`.game-robber-notice`), mini-histórico flutuante (`.mini-action-log`), coordenador `?bot_only=1`, heartbeat `10s`, **`🚪 Sair (Bot Assume)`** e **`↩️ Retomar Meu Assento`**.
- **Lobby, Mapas, Dificuldade Única, Contas e Motor Local Fallback:**
  - [`HomePage.tsx`](ui/src/pages/HomePage.tsx) & [`RoomLobbyPage.tsx`](ui/src/pages/RoomLobbyPage.tsx): Tela inicial A2 com `lobby_hero.webp` em alta resolução, palco central interativo em 3D (Home) e 4 Hero Cards verticais em 3D (Sala), modais em `ui/src/components/home/` ([`AuthModal.tsx`](ui/src/components/home/AuthModal.tsx), [`MatchSetupModal.tsx`](ui/src/components/home/MatchSetupModal.tsx), [`OpenLobbyModal.tsx`](ui/src/components/home/OpenLobbyModal.tsx), [`MapTemplatePreview.tsx`](ui/src/components/home/MapTemplatePreview.tsx)), seletor único de dificuldade (`Fácil`, `Moderado`, `Difícil`), perfis oficiais de bots na mesa (`Creitu`, `Felire`, `Guiri`, `Jaó`, `Angeleri`), vaga explícita **`Assento livre`** preenchida pelo nome de quem entrar, mapas **Padrão (Mapa aleatório)** / **Mini** / **Torneio (Mapa fixo)**, modo de dados **Clássico** vs **Equilibrado** (`balanced`) e encerramento/saída de salas abertas.
- **Avatar 3D Modular WebGL (`ui/src/components/avatar3d/`, `ui/scripts/` & `docs/AVATAR_3D_ASSET_GUIDE.md`):**
  - Motor Three.js ([`sceneComposer.ts`](ui/src/components/avatar3d/sceneComposer.ts), [`materialTint.ts`](ui/src/components/avatar3d/materialTint.ts), [`Avatar3DCanvas.tsx`](ui/src/components/avatar3d/Avatar3DCanvas.tsx)): composição modular em 9 sockets (`socket_torso`, `socket_legs`, `socket_cape`, `socket_mount`, `socket_pedestal`, `socket_head`, `socket_hand_r`, `socket_back`, `socket_shoulder_l`) + `faceSlot` 3D paramétrico (`eyeStyle`, `browStyle`, `noseStyle`, `mouthStyle`) e proporções corporais dinâmicas (`bodyType`), recoloração em tempo real via materiais nomeados (`mat_skin`, `mat_hair`, `mat_eyes`, `mat_primary`, `mat_secondary`, `mat_metal`, `mat_mount`) e captura síncrona de retrato `256×256` WebP (`portraitSnapshot`) com fallback transparente para [`PlayerAvatar.tsx`](ui/src/components/PlayerAvatar.tsx).
  - Pipeline de 55 ativos `.glb` (`ui/public/assets/models/avatars/`) gerados e validados por [`build_starter_3d_assets.mjs`](ui/scripts/build_starter_3d_assets.mjs) & [`verify_starter_3d_assets.mjs`](ui/scripts/verify_starter_3d_assets.mjs).
  - [`ui/src/utils/apiClient.ts`](ui/src/utils/apiClient.ts) & [`ui/src/utils/localEngine.ts`](ui/src/utils/localEngine.ts): Cliente de API com fallback automático offline (`localEngine.ts`), incluindo paridade completa de avatar V2 + direitos VIP (`entitlements`), chat/provocações, dados equilibrados, descarte/anti-hoarding dos bots, encerramento de salas e dificuldade única.

### Backend (`api/` e `catanatron/`) — Flask + Vercel Python Serverless
- **[`vercel.json`](vercel.json) & [`api/index.py`](api/index.py):** Entrada Serverless Python (`3.12` via `.python-version`) na Vercel que roteia `/api/*` para o Flask (`catanatron.web`).
- **[`catanatron/catanatron/web/api.py`](catanatron/catanatron/web/api.py) & [`models.py`](catanatron/catanatron/web/models.py)** *(espelhados identicamente em `api/catanatron/web/` para a Vercel)*: Endpoints REST para jogos (`/api/games`, `/actions?bot_only=1`, `/heartbeat`, `/abandon`, `/reclaim`, `/messages`), salas (`/api/rooms`, `/close`, `/leave`, `/join`, `/start`), autenticação/perfil (`/api/auth/register`, `/api/auth/login`, `/api/auth/google`, `/api/auth/me`, `/api/auth/profile`) com catálogo V2 de avatar, tabela `user_entitlements`, validação HTTP `403 locked_items` por vitórias/SKUs VIP e exposição de `leaderboard_rank` no ranking global, histórico de partidas, seeds CSPRNG (`secrets.randbits(63)`), suporte a dados equilibrados (`dice_mode = "balanced"`), dificuldade única (`easy`/`medium`/`hard`), encerramento seguro de salas por anfitrião/token e análise MCTS.
- **Motor Anti-Hoarding & Regras (`catanatron/catanatron/apply_action.py`, `game.py`, `state.py`, `serialization.py`, `players/`):** Baralho de dados equilibrados (36 combinações com reembaralhamento em `<= 5` restantes), avaliação anti-acúmulo de cartas nos bots (`search.py`, `value.py`, `tree_search_utils.py`, `weighted_random.py`) e priorização de descarte/uso em mãos acima de 7 cartas.

---

## 3. Como Rodar em Qualquer Máquina e Sincronizar via GitHub / Vercel

```bash
# 1. Clonar o repositório (primeira vez) ou atualizar
git clone https://github.com/JGallo0/catanatron-enhanced.git
cd catanatron-enhanced

# Ou, se já clonado anteriormente:
git fetch origin
git checkout layout-topbar && git pull origin layout-topbar
# (Nota: `layout-topbar` possui o preview ativo na Vercel do Bloco 9 — Avatar 3D Modular — antes de mesclar para `main`)

# 2. Instalar dependências do frontend e rodar servidor de desenvolvimento
cd ui
npm install
npm start

# 3. Rodar verificação completa do frontend (ativos 3D + typecheck + Vitest + build)
npm run verify:avatars3d
npx tsc --noEmit
npx vitest run
npm run build

# 3b. (Se editar `ui/scripts/build_starter_3d_assets.mjs`) Regerar os 55 .glb iniciais:
npm run build:avatars3d && npm run verify:avatars3d

# 4. (Opcional) Rodar suíte de testes Python do backend web + regras de troca + anti-hoarding + dados
cd ..
.venv/Scripts/python -m pytest -o addopts="" tests/web tests/test_game.py tests/test_domestic_trade.py tests/test_web_view.py tests/test_anti_hoarding.py tests/test_balanced_dice.py -v
```

> **Nota:** Graças ao [`localEngine.ts`](ui/src/utils/localEngine.ts), você pode rodar apenas `cd ui && npm start` sem nem precisar subir o Flask em Python para testar todo o fluxo visual, o tabuleiro cercado pelo oceano, os dados 3D, chat/provocações, almanaque, bots anti-hoarding e partidas completas! Para testar salas multiplayer reais localmente contra a API Flask, suba também `.venv/Scripts/python -m flask --app catanatron.web:create_app run --host 127.0.0.1 --port 5001 --no-reload` com `PYTHONPATH=catanatron`.

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
22. **`lobby_hero.webp` — Banner de Fundo da Tela Inicial (`1920×1080`, atualizado com `panoramic_view.jpg` em alta resolução)**
23. **`ocean_backdrop.webp` — Paisagem Marítima Panorâmica do Tabuleiro (`1376×768`, pôr do sol, ondas, ilhas distantes, castelo, farol e embarcações)**

### E. Sistema de Avatares 3D Modulares + Retratos WebP/SVG (`Avatar3DCanvas.tsx` & `PlayerAvatar.tsx`)
Os retratos legados `.webp` herdados do Catan Universe foram completamente aposentados e substituídos por um sistema duplo em camadas:
- **Palco 3D Interativo ([`Avatar3DCanvas.tsx`](ui/src/components/avatar3d/Avatar3DCanvas.tsx) + [`AvatarStudioModal.tsx`](ui/src/components/AvatarStudioModal.tsx)):** Exibido no Estúdio 3D, no palco central da Tela Inicial e nos 4 Hero Cards verticais da Sala Multiplayer, com rotação `360°`, câmera **Corpo Inteiro / Rosto**, `55` modelos `.glb` modulares em `ui/public/assets/models/avatars/`, traços faciais 3D paramétricos e **7 canais de cor livre** (`Cores Livres`) sem multiplicar arquivos `.glb`.
- **Retrato 2D de Alta Performance ([`PlayerAvatar.tsx`](ui/src/components/PlayerAvatar.tsx)):** Prioriza automaticamente o `portraitSnapshot` WebP (`<= 64 KB`) capturado do 3D quando salvo no perfil, com fallback vetorial V2 e molduras de mérito (`wood`, `bronze`, `silver`, `gold`, `imperial`, `vip_dragon`).
- **Predefinições Originais ("6 Arquétipos da Ilha"):** `Capitão dos Mares`, `Guardiã da Floresta`, `Sentinela da Serra`, `Mercador do Porto`, `Mestre Construtora` e `Cartógrafo do Poente`.
- **Avatares e Nomes Oficiais de Bots (`botCatalog.ts` & `models.py`):** Perfis distintos pareados com o elenco oficial da mesa (**`Creitu`**, **`Felire`**, **`Guiri`**, **`Jaó`** e **`Angeleri`**), atribuídos sem repetição na mesa e sem rótulos de cor ou prefixos artificiais (`IA (...)` / `Bot ...`).

---

## 5. Histórico Recente de Entregas e Próximos Passos

### Concluído Recentemente:
- **Barra Superior Catan Universe (`PlayerTopBar.tsx`):**
  - Grid de estatísticas 2×3 limpo com ícones vetoriais nítidos (Cavaleiros `🗡️`, Maior Estrada `〰️`, Recursos `🂠`, Cartas de Dev `🎴`, Pontos de Vitória `🏆`) + medalhões customizados (`largest_army.webp`, `longest_road.webp`) quando conquistados + contadores compactos de peças construídas (`Aldeias`, `Cidades`, `Estradas`).
  - Avatares oficiais integrados em `ui/public/assets/illustrations/avatars/{red,orange,white,blue}.webp`.
  - Remoção da coluna lateral fixa de 300px; tabuleiro centralizado e com aproveitamento total da tela.
  - Histórico de jogadas convertido em gaveta recolhível (`LeftDrawer.tsx`) com acionamento pelo botão `📜 Histórico`.
  - Mesa de jogo com textura de madeira nobre quente e iluminação radial suave em `GameScreen.scss`.
- **Doca Inferior Catan Universe (`ActionsToolbar.tsx` / `ResourceCards.tsx`):**
  - Console horizontal em 3 zonas estilo Steam: construção direta 1-clique (`Estrada`, `Aldeia`, `Cidade`, `Carta Dev`) com estoque restante e destaque de modo ativo + `Trocar`, `Usar Carta` e `Custos`; baralho central com ilustrações nítidas em `.webp` sem película escura + contador `Mão X/7`; e dados 2D6 + **botão circular dourado** (`ROLAR DADOS` / `PASSAR VEZ` / `DESCARTAR` / `ROUBAR`).
- **Efeitos Sonoros Táteis (`soundEffects.ts`):**
  - Síntese Web Audio API leve (dados, construções, compra de carta/troca, ladrão, fim de turno e vitória) com botão `🔊/🔇` persistente no topo.
- **Rebrand Oficial para "Rule the Isle" + Avisos GPL-3.0:**
  - Marca atualizada nas telas e metadados (`index.html`, `manifest.json`, `HomePage.tsx`, `GameScreen.tsx`, `ReplayScreen.tsx`, `RoomLobbyPage.tsx` e `apiClient.ts`), preservando chaves internas (`CATANATRON`, pacotes Python e chaves de `localStorage`) e exibindo créditos ao motor Catanatron (Bryan Collazo) sob licença **GNU GPL-3.0**.
- **Correção de bots travando no meio do jogo & Typecheck:**
  - Histórico completo de estados desacoplado de gravações síncronas pesadas no `localStorage`, evitando erro de estouro de cota e congelamento de IA, e `npx tsc --noEmit` 100% limpo.
- **Bloco 1 Concluído: Autenticação Persistente, Histórico de Partidas e Ranking Global (Leaderboard):**
  - **Autenticação Multi-dispositivo sem envio de e-mails (Compatível com Plano Free do Supabase/Vercel):**
    - Abas separadas na Home para **Entrar** e **Criar Conta**, além de botão **Google Sign-In** automático (`accounts.google.com/gsi/client`).
    - Senhas seguras com hash PBKDF2 + salt aleatório (`120.000` iterações SHA-256) e suporte a upgrade transparente de hashes legados.
    - Sessões independentes por dispositivo na tabela `user_sessions` (`sess_<hex>`), permitindo manter login no PC e no celular simultaneamente e fazer logout isolado.
    - Endpoints REST completos: `/api/auth/register`, `/api/auth/login`, `/api/auth/google`, `/api/auth/me`, `/api/auth/logout`, `/api/auth/profile` e `/api/auth/config`.
  - **Gravação Idempotente de Histórico de Partidas (`matches` e `match_participants`):**
    - Todas as partidas finalizadas são salvas automaticamente com chave primária `game_id` (garantindo idempotência mesmo se acionada múltiplas vezes).
    - Vitórias de robôs/IAs são gravadas no histórico (`winner_is_bot = True`, `winner_username = null`). Partidas incompletas/abandonadas não são gravadas.
    - Vínculo invariante entre o assento (Cor) e a identidade do usuário (`USER`, `GUEST` ou `BOT`) mantido mesmo após o embaralhamento de ordem de turno do motor de Catan.
  - **Ranking Global (Leaderboard):**
    - **Apenas jogadores humanos registrados** são classificados no ranking oficial (robôs e convidados temporários são excluídos da classificação).
    - Ordenação: `vitórias DESC, % vitórias DESC, partidas jogadas DESC, usuário ASC`.
    - Taxa de vitórias calculada por `(vitórias / partidas jogadas) * 100`, considerando apenas as partidas disputadas pelo usuário.
    - Modal interativo **🏆 Ranking Global & Histórico** acessível da tela inicial, com abas dedicadas para o Ranking e para o Histórico de Partidas (com filtro *"Só Minhas Partidas"*).
  - **Espelho Offline Total (`localEngine.ts`):**
    - Cadastro, login, histórico e ranking continuam funcionando diretamente no navegador via `localStorage` mesmo sem backend ou sem internet.
- **Bloco 2 Concluído: Criador Modular de Avatar, Perfil e Molduras por Mérito:**
  - **Avatar SVG Modular em Camadas (`ui/src/config/avatarCatalog.ts` & `ui/src/components/PlayerAvatar.tsx`):**
    - 10 dimensões customizáveis (pele, olhos/expressão, estilo/cor de cabelo, barba, chapéu/coroa, traje/cor, cenário de fundo e moldura), com fallback determinístico a partir do `username` (`resolveAvatarConfig`), 6 arquétipos prontos (*Modelos Prontos*) e sorteio aleatório (`🎲 Aleatório`).
  - **Recompensas por Vitórias no Ranking Global (Trava Dupla `403` Servidor + Offline):**
    - Molduras (`wood` 0, `bronze` 1, `silver` 3, `gold` 5, `imperial` 10 vitórias) e `crown_gold` (7 vitórias) validadas tanto em `catanatron/catanatron/web/models.py` (`update_user_profile` com HTTP `403`) + `catanatron/catanatron/web/api.py` (`PATCH /api/auth/profile`) quanto em `localEngine.ts` (`localUpdateProfile`).
  - **Studio de Perfil & Propagação Universal:**
    - Modal [`AvatarStudioModal.tsx`](ui/src/components/AvatarStudioModal.tsx) acessível pela Home e pela Sala Multiplayer com edição de apelido e pré-visualização ao vivo.
    - Propagação em lote zero-N+1 via `_load_avatars_by_username`, `serialize_room` e `_enrich_view_with_seats`, exibindo o avatar SVG em `HomePage`, `RoomLobbyPage`, `LeaderboardModal` e `PlayerTopBar` (para usuários `USER`, preservando os retratos clássicos `.webp` para Bots e convidados).
- **Bloco 3 Concluído: Redesign da Tela Inicial (Palco A2) & Lobby Aberto Modular:**
  - **Palco Panorâmico A2 (`HomePage.tsx` & `HomePage.scss`):**
    - Remoção do card central sólido que encobria `lobby_hero.webp`, preservando o miolo da ilha 100% descoberto sobre o mar e degradês suaves apenas nas bordas.
    - Cabeçalho simétrico em 3 colunas: cartão do jogador à esquerda (`PlayerAvatar` clicável e moldura atual), título monumental `RULE THE ISLE` centralizado no céu e placa à direita com posição oficial `#rank` no Ranking (`leaderboard_rank` exposto em `models.py` + `localEngine.ts`) e estatísticas.
    - Doca inferior flutuante com os 5 botões dedicados: *Partida Rápida (Solo/IA)*, *Criar Sala Online*, *Salas Abertas*, *Ranking & Histórico* e *Personalizar Avatar*.
  - **Modais Modulares (`ui/src/components/home/`):**
    - `AuthModal.tsx`: login, criação de conta e Google Sign-In em diálogo dedicado (com transição automática para o Studio de Avatar quando acionado deslogado).
    - `MatchSetupModal.tsx`: configuração compartilhada para partidas Solo vs IA e criação de Salas Online com código/link compartilhável.
    - `OpenLobbyModal.tsx`: navegador do Lobby Aberto com entrada rápida por código (`#K7M4P9`), filtros (*Todas*, *Com Vagas*, *Minhas*) e exibição dos `<PlayerAvatar />` nos assentos humanos.
- **Bloco 4 Concluído: Correção Home & Google OAuth, Avatares/Bots Oficiais, Negociação Entre Jogadores & Mobile-First:**
  - **Fix do Retângulo Preto na Home (`GameScreen.scss` / `ReplayScreen.scss`):** Regras globais de `main` e fundo escuro foram escopadas para `main.catan-game-screen` e `main.catan-replay-screen`, eliminando qualquer tarja opaca sobre `.home-page--stage` e garantindo exibição contínua do palco panorâmico `lobby_hero.webp`.
  - **Login com Google Hardened (`.env`, COOP & Visibilidade Permanente):**
    - Backend (`catanatron/web/__init__.py` e `api/catanatron/web/__init__.py`) carrega `.env` automaticamente na inicialização e aplica cabeçalhos `Cross-Origin-Opener-Policy: same-origin-allow-popups` compatíveis com popups OAuth / One Tap.
    - Frontend (`AuthModal.tsx` e `GoogleSignInButton.tsx`) aceita `VITE_GOOGLE_CLIENT_ID` como fallback local e exibe sempre a seção *"Entrar com Google"* no topo do modal (com aviso instrutivo quando `GOOGLE_CLIENT_ID` ainda não estiver configurado), encaminhando também o `avatar_config` personalizado do visitante ao autenticar via Google.
  - **Bots Oficiais & Avatares Originais Sem Legado Catan Universe:**
    - Assentos de IA recebem nomes únicos por partida estritamente dentre **`Creitu`**, **`Felire`**, **`Guiri`**, **`Jaó`** e **`Angeleri`** em `catanatron/web/models.py`, `localEngine.ts`, `botCatalog.ts`, prompts e histórico (`LeftDrawer.tsx`, `promptUtils.ts`), sem nomes de cores ou prefixos `IA (...)`/`Bot (...)`.
    - Remoção integral dos `.webp` legados; `<PlayerAvatar />` é renderizado em todos os assentos com prioridade absoluta para a criação interativa do jogador (`USER` ou visitante em `catan_guest_profile_v1`).
  - **Negociação Player-to-Player (Entre Jogadores):**
    - Fluxo completo de 3 etapas (`OFFER_TRADE` → `DECIDE_TRADE` [`ACCEPT_TRADE`/`REJECT_TRADE`] → `DECIDE_ACCEPTEES` [`CONFIRM_TRADE`/`CANCEL_TRADE`]) habilitado em validação determinística (`DETERMINISTIC_ACTIONS` + `is_valid_trade`), heurística de avaliação de troca para bots (`trade_evaluator.py`, usada pelos 6 avaliadores de IA) e paridade offline completa em `localEngine.ts`.
    - Interface completa em [`TradeModal.tsx`](ui/src/components/TradeModal.tsx) (aba *🤝 Entre Jogadores* + *⚓ Porto & Banco*), [`TradeOfferDecisionDialog.tsx`](ui/src/components/TradeOfferDecisionDialog.tsx) (minimização via *Ver Tabuleiro* + restauração pelo orbe CTA) e logs/banners em `pt-BR`.
  - **Otimização Mobile-First (`<= 768px`, `<= 480px` e paisagem `max-height: 520px`):**
    - [`PlayerTopBar.tsx`](ui/src/components/PlayerTopBar.tsx) com faixa compacta horizontal zero-scroll em celulares e modal *tap-to-inspect* com estatísticas completas e peças no tabuleiro.
    - [`Board.tsx`](ui/src/pages/Board.tsx), [`Board.scss`](ui/src/pages/Board.scss), [`GameScreen.scss`](ui/src/pages/GameScreen.scss) e [`ActionsToolbar.scss`](ui/src/pages/ActionsToolbar.scss) com cálculo de altura responsivo, `touch-action: none` para pinch/pan tátil, HUD compacta e alvos `44px+` em todos os controles e modais sem overflow horizontal.
- **Bloco 5 Concluído: Ritmo Clássico de Tabuleiro, Assunção/Retomada por Bot no Multiplayer e Ordem de Turnos Aleatória:**
  - **Ritmo de Mesa, Dados 2D6 Animados e Destaques em Desktop/Mobile:**
    - Controle de velocidade no HUD (`🐢 Normal (1x)` / `⚡ Rápido (0.5x)` persistido em `catan_game_speed_v1` via [`tabletopPacing.ts`](ui/src/utils/tabletopPacing.ts)), desacelerando ações dos Bots conforme o tipo da jogada (`1800ms` para rolagem de dados, `1200ms` construções/compras, `950ms` trocas, `650ms` fim de turno e `400ms` descarte em `1x`, com reação imediata de `250ms` quando há prompt humano pendente).
    - Novo estágio central [`DiceRollOverlay.tsx`](ui/src/components/DiceRollOverlay.tsx) (`Rolando...` com faces animadas -> `Total X` / `Total 7 — Ladrão!`) sincronizado com `.dice-widget-pill.is-rolling` em [`ActionsToolbar.tsx`](ui/src/pages/ActionsToolbar.tsx).
    - Halos dourados temporários de `2,2s` para construções e compras recentes (`.node--recent`, `.edge--recent`, `.cu-stat--recent`) e `.action-spotlight-toast` unificado tanto em Desktop (`>=600px`) quanto em Mobile (`<600px`).
  - **Presença Multiplayer, Assunção por Bot (`45s` / Saída Voluntária) e Retomada do Assento:**
    - Backend (*serverless-safe* sem threads em background em [`models.py`](catanatron/catanatron/web/models.py) e [`api.py`](catanatron/catanatron/web/api.py) espelhados em `api/catanatron/web/`): `POST /api/games/<id>/heartbeat` (`10s` no cliente), promoção automática preguiçosa após `45s` sem heartbeat exclusivamente em partidas multiplayer com `>= 2` humanos originais (nunca em jogos Solo e nunca no último humano vivo), `POST /api/games/<id>/abandon` (**`🚪 Sair (Bot Assume)`** com diálogo de confirmação) e `POST /api/games/<id>/reclaim` (**`↩️ Retomar Meu Assento`** no banner de [`GameScreen.tsx`](ui/src/pages/GameScreen.tsx)).
    - Eleição de coordenador único no cliente (`electBotCoordinator`) usando `POST /api/games/<id>/actions?bot_only=1` (safe no-op quando não for mais turno de bot) e `polling` de `700ms` para pares sincronizarem na mesma cadência.
    - Justiça no Ranking Global: assento assumido por bot que termina a partida sem ser retomado conta como `seat_kind = "BOT"` (`username = null`), exibindo `"<NomeOriginal> (Bot)"` + indicador `"🤖 Bot assumiu"` e preservando o avatar customizado original no lugar de substituir pelo avatar de um bot padrão; paridade local completa em [`localEngine.ts`](ui/src/utils/localEngine.ts).
  - **Ordem de Turnos e Jogador Inicial Garantidamente Aleatórios:**
    - Seeds CSPRNG (`secrets.randbits(63)`) quando `seed` não é informado na API Python e embaralhamento Fisher-Yates com `crypto.getRandomValues` em `localCreateGame` preservando o vínculo cor <-> jogador/avatar.
    - Anúncio da ordem sorteada no início da partida (`state_index === 0`: `"Ordem sorteada: Você inicia a partida!"` / `"Ordem sorteada: <Nome> inicia a partida!"`) e barra [`PlayerTopBar.tsx`](ui/src/components/PlayerTopBar.tsx) renderizada na ordem ativa de turnos sem selos numéricos (`1º`–`4º`).
  - **Bateria de Testes Verificada (Bloco 5):**
    - Backend (`.\.venv\Scripts\python.exe -m pytest -o addopts="" tests/web tests/test_game.py tests/test_domestic_trade.py tests/test_web_view.py -v`): **97/97 passando** (`53/53` em `tests/web/`, incluindo `test_takeover_and_turn_order.py` e paridade do espelho Vercel).
    - Frontend (`npx tsc --noEmit`, `npx vitest run` e `npm run build` em `ui/`): **0 erros TS**, **25 arquivos / 119 testes passando** e build de produção Vite concluído.
- **Bloco 6 Concluído: Anti-Hoarding dos Bots, Encerramento de Salas, Seletor Único de Dificuldade, Dados Equilibrados, Chat & Provocações:**
  - **Home em Alta Resolução:** Banner [`lobby_hero.webp`](ui/public/assets/illustrations/ui/lobby_hero.webp) substituído por versão em alta definição (`panoramic_view.jpg`).
  - **IA Anti-Hoarding (`apply_action.py`, `players/search.py`, `value.py`, `tree_search_utils.py`, `weighted_random.py` & `localEngine.ts`):**
    - Bots gastam ou negociam cartas excedentes em vez de passar turno com mãos gigantes; avaliadores penalizam excesso sobre `discard_limit` e descarte pendente, priorizando alvos de maior ameaça com cartas ao mover o Ladrão e descartando excedentes antes de quebrar mão de Cidade.
  - **Gerenciamento Real de Salas Abertas (`POST /api/rooms/<code>/close`, `DELETE /api/rooms/<code>`, `POST /api/rooms/<code>/leave`):**
    - Anfitriões podem encerrar salas em `WAITING` ou `IN_PROGRESS` (ou sair se convidado), com verificação de propriedade por token de assento/usuário autenticado/mapa `X-Room-Tokens` e ocultação automática de salas finalizadas em [`OpenLobbyModal.tsx`](ui/src/components/home/OpenLobbyModal.tsx).
  - **Lobby Simplificado, Perfis Oficiais & `Assento livre` ([`botCatalog.ts`](ui/src/config/botCatalog.ts), [`MatchSetupModal.tsx`](ui/src/components/home/MatchSetupModal.tsx), [`RoomLobbyPage.tsx`](ui/src/pages/RoomLobbyPage.tsx)):**
    - Seletor único de dificuldade dos bots (`Fácil`, `Moderado`, `Difícil`), lista explícita dos 5 perfis oficiais (`Creitu`, `Felire`, `Guiri`, `Jaó`, `Angeleri`) com nomes respeitados na mesa, vagas abertas nomeadas **`Assento livre`** substituídas pelo nome do jogador que entrar e rótulos de mapa **Padrão (Mapa aleatório)**, **Mini** e **Torneio (Mapa fixo)** com prévia visual em [`MapTemplatePreview.tsx`](ui/src/components/home/MapTemplatePreview.tsx).
  - **Dados Equilibrados (`dice_mode = "balanced"`), Histograma & Almanaque:**
    - Baralho de 36 combinações de `2d6` com saque sem reposição e reembaralhamento automático ao restarem `<= 5` cartas (`tests/test_balanced_dice.py`), histograma ao vivo em [`DiceHistogram.tsx`](ui/src/components/DiceHistogram.tsx) e modal de consulta [`AlmanacModal.tsx`](ui/src/components/AlmanacModal.tsx).
  - **Bate-Papo & Provocações Animadas na Partida (`GET/POST /api/games/<id>/messages`, [`GameChatPanel.tsx`](ui/src/components/GameChatPanel.tsx), [`tauntCatalog.ts`](ui/src/config/tauntCatalog.ts)):**
    - Chat persistente por partida (online + espelho em `localEngine.ts`), frases rápidas, prévia toast, contador de não lidas e catálogo de provocações/saudações animadas (`TAUNT`, cooldown `3s`) exibidas no retrato e balão do jogador com síntese de áudio.
- **Bloco 7 Concluído: Oceano Realista ao Pôr do Sol, Portos Ilustrados, Dados 3D, Peças Artesanais, Cadência Ampliada & Dock Vertical:**
  - **Identidade *Rule the Isle* no Tabuleiro (`GameIcons.tsx`, `Tile.tsx`, `Board.tsx`, `OceanBackdrop.tsx`, `PlayerTopBar.tsx`):**
    - Peças artesanais `SettlementSvgPiece` (cabanas enxaimel), `CitySvgPiece` (cidadela/torre) e `RoadSvgPiece` (calçadão de madeira/pedra); estrelas douradas `AwardStarSvg` posicionadas diretamente ao lado do ícone de Cavaleiro/Estrada no card do jogador (sem medalhões isolados).
    - Ilha totalmente cercada por oceano panorâmico realista ao pôr do sol ([`ocean_backdrop.webp`](ui/public/assets/illustrations/ui/ocean_backdrop.webp) + ondas e brilhos em [`OceanBackdrop.tsx`](ui/src/components/OceanBackdrop.tsx), halo marinho e rosa dos ventos em [`Board.scss`](ui/src/pages/Board.scss)) e **portos ilustrados** ([`HarborPortSvg`](ui/src/components/icons/GameIcons.tsx)) com píer, carga e caravelas no lugar dos círculos antigos.
  - **Dados 3D Reais (`Dice3D.tsx` & `Dice3D.scss`):**
    - Cubos 3D CSS `preserve-3d` com 6 faces chanfradas em marfim/bronze, presentes tanto no estágio central [`DiceRollOverlay.tsx`](ui/src/components/DiceRollOverlay.tsx) quanto no console inferior [`ActionsToolbar.tsx`](ui/src/pages/ActionsToolbar.tsx).
  - **Ritmo Ampliado & Feedback Público de Mesa (`tabletopPacing.ts` & `GameScreen.tsx`):**
    - Apresentação inicial **"Boa Guerra"** estendida para **`10s`** (`INTRO_SPLASH_MS = 10000`) com barra de progresso e botão **Zarpar para a Ilha**.
    - Velocidades **`Normal (4x)`**, **`Rápida (1x)`** e **`Turbo (0.5x)`**, com atrasos das ações dos bots dobrados em todas as faixas, mensagem de transição **`"Vez de <Nome>"`** dobrada para **`3s`** (`TURN_TRANSITION_MS = 3000`) e duração do giro/overlay dos dados 3D dobrada para humanos e bots.
    - Descarte animado público ao rolar 7 (mostrando as cartas descartadas sobre o card do jogador), ganhos de recursos/PV flutuantes, avisos do Ladrão (`.game-robber-notice`) e confirmação opcional de jogada (`Confirmar jogada`).
  - **Dock Vertical Esquerdo Clicável & Enquadramento Responsivo:**
    - Hierarquia explícita de `z-index` em [`GameScreen.scss`](ui/src/pages/GameScreen.scss) garantindo clique imediato na `.game-left-dock` (`z-index: 44`), medição real do container do mapa via `ResizeObserver` em [`ZoomableBoard.tsx`](ui/src/pages/ZoomableBoard.tsx) (`numLevels = 7.0`) e centralização segura das cartas e cards de jogadores em desktop (`1280x800`) e larguras intermediárias (`769–980px`).
  - **Bateria de Testes e Build Verificada (Blocos 6 e 7):**
    - Backend (`.\.venv\Scripts\python.exe -m pytest -o addopts="" tests/web tests/test_game.py tests/test_domestic_trade.py tests/test_web_view.py tests/test_anti_hoarding.py tests/test_balanced_dice.py -v`): **112/112 passando** (incluindo `test_game_chat.py`, `test_rooms_and_bots.py` e verificação de espelho `api/catanatron` == `catanatron/catanatron`).
    - Frontend (`npx tsc --noEmit`, `npx vitest run` e `npm run build` em `ui/`): **0 erros TS**, **32 arquivos / 160 testes passando** e build de produção Vite (`ui/dist/`) concluído com sucesso; verificado ao vivo no navegador em `1280x800` e `769x769`.
- **Bloco 8 Concluído: Otimização de Carregamento Vite & Velocidade dos Bots (Offline Permanente vs Online Pré-Partida):**
  - **Carregamento Rápido do Vite (`App.tsx`, `ReplayBox.tsx`, `seatStorage.ts`, `vite.config.ts`):**
    - Substituído *barrel import* de `@mui/icons-material` em `ReplayBox.tsx` por *path imports* (`ArrowBackIos` / `ArrowForwardIos`), reduzindo os módulos transformados de `11.872` para `1.118`; *code splitting* via `React.lazy` + `Suspense` para `GameScreen`, `RoomLobbyPage` e `ReplayScreen`; extração de `seatStorage.ts` para eliminar conflito de chunk estático/dinâmico.
  - **Velocidade dos Bots (`models.py`, `api.py`, `api/catanatron/`, `botCatalog.ts`, `localEngine.ts`, `MatchSetupModal.tsx`, `RoomLobbyPage.tsx`, `GameScreen.tsx`):**
    - Seletor **Velocidade dos Bots** (`🐢 Normal`, `⏩ Rápida`, `⚡ Turbo`) adicionado tanto na criação de partida Solo quanto na criação de Sala Online (`MatchSetupModal.tsx`) e editável pelo anfitrião no lobby pré-partida (`RoomLobbyPage.tsx`, `POST /api/rooms` & `PATCH /api/rooms/<code>` validando `bot_speed`).
    - **Offline (Solo):** botão de velocidade no dock lateral esquerdo permanece acessível e editável durante toda a partida (`localStorage["catan_game_speed_v1"]`).
    - **Online (Salas):** velocidade é gravada em `StoredRoom.config_json["bot_speed"]`, propagada em `GameState.bot_speed` e **travada** durante a partida (`is-locked` + ícone `🔒` no dock).
  - **Bateria de Testes e Build Verificada (Bloco 8):**
    - Backend: **113/113 passando** (`pytest`, incluindo `test_room_bot_speed_pre_match_config_and_game_exposure` e paridade `api/catanatron/`).
    - Frontend: `npx tsc --noEmit` (**0 erros**), **32 arquivos / 164 testes passando** (`vitest`) e `npm run build` concluído (`1.118` módulos, `37.98s`).
- **Bloco 9 Concluído (branch `layout-topbar`): Sistema de Avatares 3D Modulares WebGL, Estúdio 3D com Cores Livres & Preparação de Monetização VIP:**
  - **Especificação & Plano:** Documentados em [`docs/superpowers/specs/2026-11-12-avatar-3d-monetization-design.md`](docs/superpowers/specs/2026-11-12-avatar-3d-monetization-design.md), [`docs/superpowers/plans/2026-11-12-avatar-3d-monetization.md`](docs/superpowers/plans/2026-11-12-avatar-3d-monetization.md) e [`docs/AVATAR_3D_ASSET_GUIDE.md`](docs/AVATAR_3D_ASSET_GUIDE.md).
  - **Backend V2 & Entitlements (`catanatron/web/` + espelho `api/catanatron/web/`):** Catálogo V2 com `20` slots, tabela `user_entitlements`, validação de `portraitSnapshot` WebP/PNG (`<= 64 KB`), exposição de `entitlements` em `/api/auth/me` e trava HTTP `403 locked_items` no `PATCH /api/auth/profile` para itens conquistáveis por vitórias e SKUs VIP não possuídos.
  - **Pipeline 3D Modular (`build_starter_3d_assets.mjs` & `verify_starter_3d_assets.mjs`):** `55/55` arquivos `.glb` verificados cobrindo corpos, cabeças, cabelos, barbas, trajes, pernas/botas, capas, chapéus, itens de mão, acessórios de costas, mascotes, montarias e pedestais com materiais reservados (`mat_*`) para coloração dinâmica em tempo real.
  - **Engine Three.js & Retrato 2D (`Avatar3DCanvas.tsx`, `sceneComposer.ts`, `materialTint.ts`, `PlayerAvatar.tsx`):** Carregamento e cache glTF em `9` sockets + `faceSlot` dinâmico (olhos, sobrancelhas, nariz, boca com material próprio `mat_lips` e cicatriz `mat_scar`, escala corporal em `bodyType`) + auras em partículas (`sun_motes`, `sea_mist`, `imperial_flame`), `capturePortraitSnapshot()` (`256×256` WebP) e prioridade ao snapshot no `<PlayerAvatar />` com moldura `vip_dragon` e fallback SVG V2.
  - **Estúdio 3D & Palcos (`AvatarStudioModal.tsx`, `HomePage.tsx`, `RoomLobbyPage.tsx`):** Estúdio com palco 3D fixo durante a rolagem (`.avatar-studio-preview-pinned`), câmera **Corpo Inteiro / Rosto**, `7` abas modulares, `7` canais de cor em **Cores Livres** + `<input type="color">`, filtros (`Todos`, `Desbloqueados`, `👑 VIP`), fluxo **Modo Provador (Try-On VIP)** antes de salvar, palco 3D interativo na Home e 4 Hero Cards 3D na Sala Multiplayer.
  - **Verificação e Ajustes em Produção Preview (commits até `e4d2c65`):** `55/55` GLBs verificados, `npx tsc --noEmit` limpo, suíte Vitest + `npm run build` concluídos (`ui/dist/`), além de validação ao vivo em WebGL (`http://localhost:3000`, `1280×800`, 0 erros JS/WebGL) confirmando preview imóvel na rolagem e troca visual em todas as variações faciais e corporais; publicado em `origin/layout-topbar` para o preview da Vercel.
  - **Refino Anatômico, Esqueleto Articulado de Montaria e Solucionador de Encaixes (Bloco 9B, branch `layout-topbar`):**
    - Escultura orgânica loftada (`makeLoftedSection` com soldagem de normais centrais + `buildContouredBoneLimb` + **mãos esculpidas com 5 dedos**, polegar opositor e falanges) em todos os `55` `.glb` com núcleos cobertos recuados para que `Robusto` (`sturdy`), `Atlético` e `Esguio` vistam qualquer túnica/traje/bota sem atravessamento (`>= +18 mm` de folga auditada).
    - Hierarquia canônica articulada compartilhada (`rig_hips`, `rig_torso`, `rig_skirt_front/back`, `rig_shoulder_l/r`, `rig_upper_arm_l/r`, `rig_forearm_l/r`, `rig_hand_l/r`, `rig_thigh_l/r`, `rig_calf_l/r`, `rig_foot_l/r`, `rig_cape_collar/drape`) em [`build_starter_3d_assets.mjs`](ui/scripts/build_starter_3d_assets.mjs) e [`sceneComposer.ts`](ui/src/components/avatar3d/sceneComposer.ts), colocando o avatar **realmente montado na sela** (`MOUNT_PROFILES`, `rig.riderPivot`, pernas abraçando a sela, botas nos estribos, mão esquerda nas rédeas, braço direito com arma à frente e câmera **Rosto** acompanhando o cavaleiro elevado em [`Avatar3DCanvas.tsx`](ui/src/components/avatar3d/Avatar3DCanvas.tsx)).
    - Diferenciação clara entre espécies em Mascotes (`owl` coruja corpulenta de disco facial vs `parrot` arara esguia de cauda longa vs `falcon` falcão rapinante) e Montarias (`island_horse` corcel com crina vs `snow_wolf` lobo sem cascos com focinho/garras/cauda espessa vs `royal_stag` cervo com galhada ramificada ampla vs `imperial_griffin` grifo águia-leão com garras, cauda com tufo e asas emplumadas varridas para trás da sela), além de solucionador automático de compatibilidade (`hair_crown_mass` sob chapéus/elmos, `crown_gold` sobre coques, capa vs mochila/escudo, ombreiras vs mascote e sincronia de empunhadura `handPropFit`).
  - **Montarias Orgânicas Estanques, Câmera Automática no Estúdio, Tintura de Mochila e Simulação Real de Partidas (Bloco 10, branch `layout-topbar`):**
    - **Montarias Fechadas sem Buracos:** Recriação geométrica das 4 montarias (`island_horse`, `snow_wolf`, `royal_stag`, `imperial_griffin`) com volumes sólidos estanques, costuras soldadas, olhos de alta expressividade com esclera/íris/pupila/brilho no padrão da Arara, focinhos modelados e arreios/selas integrados sem fendas.
    - **Foco Automático de Câmera no Estúdio:** Câmera no [`AvatarStudioModal.tsx`](ui/src/components/AvatarStudioModal.tsx) comutando dinamicamente entre `Rosto` (nariz, formato facial, olhos, barba, sobrancelha, boca, cabelo, tom de pele, cor do cabelo/olhos) e `Corpo Inteiro` (corpo, túnica, calças/botas, montaria, mascote, itens de costas, cores do traje/mochila).
    - **Canal de Cor Independente para Mochila (`backpack_color`):** Suporte de ponta a ponta a 8 canais de tintura cromática livre (`skin`, `hair`, `eyes`, `eyebrows`, `mouth`, `outfit`, `legs`, `backpack`), desacoplando a mochila do tecido principal em Python e TypeScript.
    - **Fix Crítico de Memória e Travamento no Motor Local ([`localEngine.ts`](ui/src/utils/localEngine.ts)):** Introdução de cache em memória de alta performance (`cachedGamesMap` e `lastStorageRaw`) e poda limpa de snapshots (`MAX_PERSISTED_SNAPSHOTS = 1`, sem arrays de `null`), reduzindo o payload de armazenamento de ~500 KB para ~25 KB e cortando 99,5% do overhead de `JSON.parse`/`JSON.stringify`. Eliminado o erro de estufamento de memória do V8 (`heap out of memory`) e congelamentos de frames em turnos sucessivos de bots.
    - **Simulação Real Ponta a Ponta ([`simulateRealMatches.test.ts`](ui/src/utils/simulateRealMatches.test.ts)):** Nova suíte de 25 partidas completas em 5 cenários reais (4 bots Catanatron, bots mistos Catanatron/F/MCTS/Random, 1 Humano + 3 Bots, mapa Mini com 8 PVs e dados aleatórios, mapa Torneio sem ladrão amigável). 100% de vitórias válidas sem stalls, loops de troca ou deadlocks de IA.
  - **Refinamentos Visuais do Tabuleiro, Renomeação 'Ovelha', Rolagem sobre o Mar com Visão Superior, Descarte com Cartas Reais, Animação de Compra Dev, Avatar 1.5x e Pino do Ladrão (Bloco 14, branch `layout-topbar`):**
    - **Preenchimento Total dos Hexágonos (Full-Bleed):** Recorte das margens brancas dos pedestais de estúdio nas ilustrações Diorama (888×1024 via Lanczos, cantos 100% preenchidos sem margens brancas) e suavização sutil do contorno biselado (`1.4px` amber suave).
    - **Renomeação Lã -> Ovelha:** Atualização sistemática de rótulos em todo o aplicativo (`assetRegistry.ts`, tooltips de ações, `ActionsToolbar.tsx`, testes).
    - **Rolagem de Dados sobre o Mar & Visão Superior (Top-Down):** Remoção completa da caixa sólida de nogueira central que sobrepunha o tabuleiro; dados agora rolam à direita sobre o mar aberto com ondulação translúcida d'água (`sea-water-ripple`) e tags flutuantes foscas; perspectiva 3D recalculada para visualização superior (visão de cima / tabletop top-down, `rotateX(56deg) rotateZ(-12deg)`) com as faces sorteadas exibidas no topo superior do cubo.
    - **Tela de Descarte com Cartas Reais ([`DiscardPlannerDialog.tsx`](ui/src/components/DiscardPlannerDialog.tsx)):** Substituição dos antigos botões de texto por cartas físicas interativas com arte completa (`CardArtIllustration`), indicador de quantidade em mãos, distintivo de descarte (`-X`), seletores de incremento/decremento (`+`/`-`), barra de progresso e rack visual de cartas selecionadas para entrega ao ladrão.
    - **Animação de Compra de Carta de Desenvolvimento ([`DevCardDrawOverlay.tsx`](ui/src/components/DevCardDrawOverlay.tsx)):** Ao adquirir uma carta de desenvolvimento na barra de ações, ela surge no centro da tela em um pop-up holográfico dourado visível exclusivamente ao jogador comprador, exibindo arte, nome e descrição por ~1,1s, e em seguida desliza suavemente até se acomodar na mão/doca inferior.
    - **Avatar 3D no Lobby (1.5x e Alinhado à Esquerda):** Palco hero 3D redimensionado em 1,5x (`630px` de largura, até `645px` de altura) e posicionado harmonicamente à esquerda do lobby (`justify-content: flex-start; padding-left: clamp(24px, 8vw, 130px)`), destacando o modelo do jogador sobre o mar.
    - **Harmonização do Botão "Criar sala online":** Cor ajustada do azul elétrico dissonante para gradiente náutico marinho profundo (`#0d4661` a `#072d42`) com borda ciano suave e sombra integrada à paleta da Home.
    - **Pino Preto Clássico do Ladrão ([`Robber.tsx`](ui/src/pages/Robber.tsx)):** Substituição do ícone anterior pelo tradicional peão de madeira preto laqueado em formato clássico Catan Universe (base torneada, anel de colarinho, cabeça esférica com reflexo especular e sombra radial de contato no hexágono).
    - **Cobertura de Testes & Build:** 218 testes Vitest aprovados (40/40 suítes, incluindo novos testes para `DevCardDrawOverlay` e `DiscardPlannerDialog`), 64 testes Pytest web aprovados, `tsc --noEmit` limpo e build de produção Vite concluído em 5s.

- **Bloco 15 Concluído (main & Produção Vercel): HUD Flutuante Imersivo, Tabuleiro +40% Ampliado, Zoom Macio a 60/120 FPS com Aceleração GPU & Dados 3D Top-Down de Mesa:**
  - **Promoção para Produção:** Branch `layout-topbar` incorporada na `main` via fast-forward limpo (`2fdd16e`), ativando todas as novidades dos Blocos 9 a 14 no domínio público de produção da Vercel (eliminando o bloqueio de autorização do WhatsApp em links de preview).
  - **Auditoria de Conforto Visual & Superpowers Visual Companion:** Identificada compressão vertical de ~240-344px que forçava hexágonos a encolherem para raio ~33px em notebooks; criado simulador interativo no localhost (`http://localhost:49985`) via Superpowers para testar e validar o novo layout imersivo com o usuário.
  - **Especificação & Plano TDD:** Documentados em [`docs/superpowers/specs/2026-11-13-immersive-floating-hud-game-screen-design.md`](docs/superpowers/specs/2026-11-13-immersive-floating-hud-game-screen-design.md) e [`docs/superpowers/plans/2026-11-13-immersive-floating-hud-game-screen.md`](docs/superpowers/plans/2026-11-13-immersive-floating-hud-game-screen.md).
  - **Tabuleiro Full-Bleed e Reescalonamento (+40% Maior em `Board.tsx`):** O contêiner do mapa passa a ocupar 100% da viewport (`inset: 0`), eliminando as deduções estáticas de altura e aplicando margens dinâmicas de segurança para portos e placards de comércio 2:1/3:1. Raio dos hexágonos aumentado de ~33px para ~48px-52px, tornando números de dados, estradas e portos imediatamente legíveis.
  - **Zoom & Pan Suave com GPU (`ZoomableBoard.tsx` & `GameScreen.scss`):** Promovidas as camadas do tabuleiro para a GPU (`will-change: transform`, `transform: translate3d(0, 0, 0)` e `contain: layout size style`), eliminando repaints contínuos nos filtros SVG do mar e sombras de aldeias. Suavização refinada da rodinha do mouse (`wheel={{ step: 0.05, smoothStep: 0.002 }}`), desaceleração cúbica macia (`easeOutCubic`) e limites elásticos do mapa para a ilha não se perder da tela.
  - **TopBar & Console Inferior Flutuantes em Glassmorphism:** A barra do sistema e os 4 perfis de jogadores unificados no dock flutuante `.game-top-hud-container` (`backdrop-filter: blur(12px)`, `pointer-events: none` no invólucro e `auto` nos botões), permitindo que a água do oceano corra sob as barras. O console inferior virou um dock flutuante centralizado (`bottom: 12px; max-width: 1040px; backdrop-filter: blur(16px)`).
  - **Dock de Câmera Desacoplado na Margem Direita:** Botões (+, −, centralizar, 2 cliques) ancorados em `bottom: 120px; right: 16px`, eliminando sobreposição com as cartas de recursos na mão do jogador ou com notificações de chat.
  - **Correção da Perspectiva dos Dados 3D (Lógica de Mesa Real / Top Face):**
    - Corrigidas as matrizes de rotação em [`Dice3D.tsx`](ui/src/components/Dice3D.tsx) para que o valor sorteado fique posicionado **exatamente na FACE SUPERIOR (TOP FACE)** do cubo (apontando diretamente para o teto), correspondendo à forma como dados físicos reais são jogados e lidos sobre a mesa (onde a face de cima é a que conta, e não a parede frontal).
    - Ajustado o ângulo de inclinação da câmera em [`Dice3D.scss`](ui/src/components/Dice3D.scss) de `56°` para **`24°`** (visão superior autêntica de mesa / *tabletop top-down*), onde a face de cima domina mais de 85% do dado com leitura imediata, com paredes laterais aparecendo apenas como relevo 3D sutil para dar sensação de volume e sombra física.
  - **Cobertura de Testes e Build:** Nova suíte dedicada [`Dice3D.test.tsx`](ui/src/components/Dice3D.test.tsx) testando e validando todas as 6 faces sem inversão, 34 testes unitários passando em Vitest (`Board`, `ZoomableBoard`, `GameScreen`, `Dice3D`, `DiscardPlannerDialog`, `boardSkin`), zero erros de TypeScript (`tsc --noEmit`) e build de produção Vite concluído com sucesso.

- **Bloco 16 Concluído (main & Produção Vercel): Confirmação de Construção Estilo Catan Universe, Alto Contraste de Peças e Enquadramento Safe-Area ("All-in-View"):**
  - **Confirmação Obrigatória em 2 Etapas Ativa por Padrão ([`ZoomableBoard.tsx`](ui/src/pages/ZoomableBoard.tsx)):**
    - Corrigido o problema de jogadas irreversíveis com clique único acidental. `confirmPlacement` passa a ser ativo por padrão (`loadSavedConfirmPlacement() === true`).
    - **Peça Fantasma Iluminada ("Provisional Ghost Piece" em [`Node.tsx`](ui/src/pages/Node.tsx) e [`Edge.tsx`](ui/src/pages/Edge.tsx)):** Ao selecionar um vértice ou aresta disponível, a peça (aldeia, cidade ou estrada) da cor do jogador é colocada provisoriamente no local com opacidade de 92%, anel/borda de pulso dourado suave (`@keyframes ghost-piece-pulse`) e retícula de encaixe.
    - **Botão Catan Universe `[✔]` ([`Board.scss`](ui/src/pages/Board.scss)):** Criado o dock flutuante `.cu-placement-confirm-dock` na lateral direita com botão proeminente verde esmeralda (`#10b981` a `#047857`) com borda luminosa, ícone de checkmark grande e pulsação suave idêntico ao Catan Universe, acompanhado de botão de cancelamento circular `[✕]`.
    - **Confirmação Flexível:** O jogador pode confirmar clicando no botão verde `[✔]` **ou** dando um segundo clique direto na própria peça fantasma no tabuleiro. Clicar em outro nó ou no `[✕]` cancela a jogada sem nenhum gasto.
  - **Novo Modelo e Alto Contraste para Peças ([`GameIcons.tsx`](ui/src/components/icons/GameIcons.tsx)):**
    - **Paleta Saturada e Vibrante (`getPiecePalette`):** Eliminados tons marrons escuros e bases de pedra lamacentas que se confundiam com os hexágonos de floresta e tijolo. Vermelho carmim puro, azul royal vívido, laranja âmbar reluzente e branco marfim nobre com detalhes dourados.
    - **Aldeias (+25% em `SettlementSvgPiece`):** Casa clássica com telhado de 2 águas pontudo, chaminé em destaque, fachada frontal colorida e contorno duplo de 2.2px de alto contraste. Escala visual ampliada no nó (`size * 0.80`).
    - **Cidades (+25% em `CitySvgPiece`):** Fortaleza imponente com duas torres, ameias (crenellations), estandarte no topo e contorno reforçado. Escala visual ampliada no nó (`size * 0.90`).
    - **Estradas (+25% de espessura em `RoadSvgPiece`):** Viga chanfrada com 22px de altura (18px em mobile), deck iluminado, chanfros 3D e sulcos divisórios de alto contraste.
    - **Sombra Projetada Tátil (`Board.scss`):** Filtro multi-ângulo `drop-shadow` que faz todas as peças saltarem fisicamente do mapa em qualquer um dos 5 biomas de terreno.
  - **Enquadramento Padrão Calibrado ao Print 2 & Vértices Mais Discretos ([`Board.tsx`](ui/src/pages/Board.tsx) & [`Board.scss`](ui/src/pages/Board.scss)):**
    - **Visual Padrão Ampliado (+24% em `Board.tsx`):** `numLevels` ajustado para **`6.7`**, fazendo o tabuleiro abrir por padrão exatamente na escala ampliada do Print 2 (equivalente a 1 clique de zoom in).
    - **Posicionamento Vertical Nudged (+22px):** Centro vertical deslocado sutilmente para baixo para deixar ~30px de mar abaixo da barra de jogadores/banner de fase e ~15px de mar acima do console inferior, enquadrando 100% da ilha e dos 9 portos com presença imponente.
    - **Vértices Pulsantes Refinados (-50% de diâmetro em `Board.scss`):** Os discos dourados de vértices disponíveis (`.node .pulse`) foram reduzidos de ~26px para **`14px`** (17px em touch mobile) com borda branca fina de 1.6px e glow concentrado. A área de clique permanece ampla e confortável no nó (`38-56px`), mas os 54 cruzamentos ficam visualmente elegantes, limpos e sem poluição visual sobre os biomas.
    - Ponto central vertical (`center[1]`) calibrado no centro geométrico exato entre as duas barras flutuantes. O botão "Centralizar tabuleiro" da câmera restaura instantaneamente essa visão panorâmica completa.
  - **Validação de Testes e Build:** 28 testes passando nas suítes principais de tela e tabuleiro (`Board`, `ZoomableBoard`, `GameScreen`), TypeScript sem erros (`tsc --noEmit`) e build de produção Vite concluído em 16s.

---

## 6. Guia de Variáveis de Ambiente (Vercel & Supabase Gratuito)

Para colocar o backend em produção na **Vercel** com persistência no **Supabase**:

| Variável | Onde obter | Descrição |
|---|---|---|
| `DATABASE_URL` | **Supabase Dashboard** -> Project Settings -> Database -> Connection Pooling (Session ou Transaction mode, porta `6543` / IPv4) | URL de conexão PostgreSQL (ex: `postgresql://postgres.[ref]:[senha]@aws-0-[regiao].pooler.supabase.com:6543/postgres`). Evita problemas de IPv6 na Vercel Serverless. As tabelas e colunas são criadas/migradas automaticamente pelo `models.py` na inicialização. |
| `GOOGLE_CLIENT_ID` | **Google Cloud Console** -> APIs & Services -> Credentials -> OAuth 2.0 Client IDs (Web application) | ID do cliente Google para login com 1 clique (ex: `123456...apps.googleusercontent.com`). Adicionar `http://localhost:3000`, `http://localhost:5173` e a URL da Vercel (`https://*.vercel.app`) em *Authorized JavaScript origins*. Opcionalmente defina também `VITE_GOOGLE_CLIENT_ID` no ambiente do Vite. |
| `SECRET_KEY` | Qualquer string aleatória | Chave de segurança usada internamente pelo Flask para assinar sessões. |

> **Nota sobre o plano gratuito do Supabase:** Nossa arquitetura de login utiliza Google OAuth via ID Token + PBKDF2 direto no banco SQL. Isso significa que **nenhum e-mail transacional é disparado pelo Supabase**, garantindo que o sistema funcione 100% dentro dos limites do plano gratuito sem bloqueios de cota de SMTP!

---

## 7. Próximos Passos

1. ~~**Bloco 2 — Customização de Avatar e Perfil**~~ *(Concluído)*
2. ~~**Bloco 3 — Redesign da Tela Inicial e Lobby Aberto**~~ *(Concluído)*
3. ~~**Bloco 4 — Fix Home/Google OAuth, Bots & Avatares Oficiais, Troca Entre Jogadores e Mobile-First**~~ *(Concluído)*
4. ~~**Bloco 5 — Ritmo de Tabuleiro com Dados 2D6 Animados, Assunção/Retomada por Bot Multiplayer e Turnos Aleatórios**~~ *(Concluído)*
5. ~~**Bloco 6 — Bots Anti-Hoarding, Encerramento de Salas, Dificuldade Única, Dados Equilibrados, Chat & Provocações**~~ *(Concluído)*
6. ~~**Bloco 7 — Oceano ao Pôr do Sol, Portos Ilustrados, Dados 3D, Peças Artesanais, Ritmo 10s/3s/2x & Dock Vertical**~~ *(Concluído e publicado em `main` + `layout-topbar`)*
7. ~~**Bloco 8 — Otimização Vite (1.118 módulos) & Velocidade dos Bots (Offline Permanente / Online Pré-Partida Travada)**~~ *(Concluído e publicado em `main` + `layout-topbar`)*
8. ~~**Bloco 9 — Avatar 3D Modular WebGL, Estúdio 3D (Cores Livres + 55 GLBs) & Estrutura VIP (`layout-topbar`)**~~ *(Concluído e publicado no preview `layout-topbar`)*
9. ~~**Bloco 10 — Montarias Orgânicas Estanques, Câmera Automática no Estúdio, Tintura de Mochila e Simulação Real de Partidas (`layout-topbar`)**~~ *(Concluído, 209 testes passando, 25 partidas simuladas, 0 deadlocks)*
10. ~~**Bloco 11 — Correção de Perspectiva de Assento em Partidas Solo Offline com Bots (`layout-topbar`)**~~ *(Concluído: corrigido stall no 1º turno humano onde a perspectiva não sincronizada com o jogador causava 0 vértices clicáveis e travamento da barra; auto-binding do assento humano e persistência em `localEngine`, `MatchSetupModal`, `HomePage`, `GameScreen` e `stateUtils`; 210 testes Vitest e 64 testes Pytest 100% verdes)*
11. ~~**Bloco 12 — Nova Ilustração Artesanal do Hexágono de Tijolo / Olaria (`layout-topbar`)**~~ *(Concluído: substituição da ilustração anterior de cânion rochoso por olaria artesanal em `ui/public/assets/illustrations/tiles/brick.webp`, apresentando forno abobadado com brasa, galpão de secagem, pilhas de tijolos de terracota e bordas em grama verde perfeitamente integradas ao estilo Catan Universe)*
12. ~~**Bloco 13 — Sistema de Temas/Skins de Tabuleiro & Novo Padrão 'Diorama 3D' (`layout-topbar`)**~~ *(Concluído)*
13. ~~**Bloco 14 — Refinamento Visual de Tabuleiro, 'Ovelha', Rolagem no Mar Superior, Descarte Real, Animação Dev Card, Avatar 1.5x e Pino Ladrão**~~ *(Concluído e incorporado na `main`)*
14. ~~**Bloco 15 — HUD Flutuante Imersivo, Tabuleiro +40% Maior, Zoom Suave com GPU & Dados 3D Top-Down de Mesa**~~ *(Concluído e publicado em produção na Vercel)*
15. ~~**Bloco 16 — Enquadramento Padrão de Tabuleiro Calibrado (+24%), Confirmação de Construção Catan Universe e Vértices Reduzidos**~~ *(Concluído e publicado em produção na Vercel)*
16. ~~**Bloco 17 — Peças de Alto Contraste (Base Padrão) e Sistema de Skins de Peças com Variante Vilarejo**~~ *(Concluído: implementação dos novos modelos de alto contraste aprovados via Visual Companion — Aldeia com contorno duplo preto/branco, Estrada em barra retangular perfeitamente reta eliminando o formato tubular, e Cidade com a silhueta clássica de torre alta pontiaguda + salão nobre e acabamento de alto contraste; criação de `pieceSkin.ts` com persistência em `localStorage` e hook reativo `usePieceSkin()`; botão de alternância com ícone 🏰 no dock lateral esquerdo do HUD; 234 testes Vitest 100% verdes, build de produção validado)*
17. **Loja VIP & Checkout (Stripe / Pix):** Conectar os SKUs `vip_*` do catálogo ao checkout e gravação de `user_entitlements`, além de permitir substituição opcional de `.glb` iniciais por modelos refinados no Blender seguindo [`docs/AVATAR_3D_ASSET_GUIDE.md`](docs/AVATAR_3D_ASSET_GUIDE.md).
18. **Expansão de Ilustrações Originais:** Gerar arte dedicada extra para cartas de desenvolvimento/terrenos opcionais e polir efeitos sonoros/hápticos em dispositivos móveis.
