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
  - `CardArtIllustration`: Arte de fundo das cartas de Recurso e Desenvolvimento.
  - `SettlementSvgPiece` & `CitySvgPiece`: Peças 3D de tabuleiro para Aldeia (1 PV) e Cidade (2 PV) na cor de cada jogador.
  - `DiceFaceSvg` & `RobberPawnSvg`: Dados visuais 2D6 e peão do Ladrão.
- **Tabuleiro e Câmera (`ui/src/pages/`):**
  - [`Board.tsx`](ui/src/pages/Board.tsx) & [`Board.scss`](ui/src/pages/Board.scss): Cálculo centralizado da ilha descontando a barra lateral esquerda (`300px`) e a doca inferior (`175px`), garantindo que o tabuleiro nasça centralizado na tela.
  - [`ZoomableBoard.tsx`](ui/src/pages/ZoomableBoard.tsx): Controle de zoom/pan (`react-zoom-pan-pinch`) com exclusão de classes clicáveis (`node--buildable`, `edge--buildable`, `pulse`) para que cliques em vértices e estradas nunca sejam engolidos pelo arrasto da câmera.
  - [`Tile.tsx`](ui/src/pages/Tile.tsx) & [`Tile.scss`](ui/src/pages/Tile.scss): Renderização dos hexágonos com costa de areia dourada, fichas numéricas com pontos de probabilidade (`•` a `•••••`) e portos marítimos (`3:1` e `2:1`).
  - [`Node.tsx`](ui/src/pages/Node.tsx) & [`Edge.tsx`](ui/src/pages/Edge.tsx): Vértices (Aldeias/Cidades) e Arestas (Estradas) com indicadores pulsantes de construção.
- **HUD, Jogadores, Cartas e Modais (`ui/src/components/` & `ui/src/pages/`):**
  - **[`PlayerTopBar.tsx`](ui/src/components/PlayerTopBar.tsx) & [`PlayerTopBar.scss`](ui/src/components/PlayerTopBar.scss):** Barra superior de jogadores inspirada fielmente no **Catan Universe (Steam)**. Exibe cards horizontais para cada jogador:
    - **Lado Esquerdo:** Retrato/avatar estilizado e nome sobre fundo na cor do jogador, com badge animado de turno `↻` embutido sem sobreposição de texto.
    - **Lado Direito (Grid 2×3 em ardósia escura):** Estatísticas com ícones vetoriais nítidos para Cavaleiros `🗡️`, Sequência de Estrada `〰️`, Cartas de Recurso `🂠` (com alerta pulsante se > 7 cartas), Cartas de Desenvolvimento `🎴` e Pontos de Vitória `🏆` em fonte grande colorida.
    - **Destaque Ativo:** Borda de `2.5px` e brilho luminoso na cor do jogador ativo.
  - **[`LeftDrawer.tsx`](ui/src/components/LeftDrawer.tsx):** Gaveta lateral recolhível (acionada pelo botão `📜 Histórico` no topo) contendo o histórico detalhado de jogadas em `pt-BR`, meta de PV, turno atual e alternador de perspectiva (`Espectador` / `Visão do Assento`).
  - [`ResourceCards.tsx`](ui/src/components/ResourceCards.tsx): Renderiza tanto a versão compacta quanto o **baralho completo ilustrado (`showEmptySlots={true}`)** na doca inferior do jogador, mostrando sempre os 5 tipos de recurso (`Madeira`, `Argila`, `Lã`, `Trigo`, `Minério`) e as Cartas de Desenvolvimento.
  - [`ActionsToolbar.tsx`](ui/src/pages/ActionsToolbar.tsx) & [`ActionsToolbar.scss`](ui/src/pages/ActionsToolbar.scss): Doca inferior com dados 2D6, mão de cartas ilustradas e botões de ação (`Custos`, `Usar Carta`, `Construir`, `Trocar`, `Rolar Dados` / `Passar Vez`).
  - [`TradeModal.tsx`](ui/src/components/TradeModal.tsx): Bancada visual de Troca Marítima e Portos (`4:1`, `3:1`, `2:1`).
  - [`RobberVictimModal.tsx`](ui/src/components/RobberVictimModal.tsx): Modal para escolher de qual jogador roubar ao mover o Ladrão.
  - [`RightDrawer.tsx`](ui/src/components/RightDrawer.tsx): Gaveta recolhível de análise de IA MCTS (aberta pelo botão `📊 Chances (IA)` no topo).
- **Lobby, Contas e Motor Local Fallback:**
  - [`HomePage.tsx`](ui/src/pages/HomePage.tsx) & [`RoomLobbyPage.tsx`](ui/src/pages/RoomLobbyPage.tsx): Tela inicial em palco panorâmico **A2** (`lobby_hero.webp` descoberto ao centro, cabeçalho de 3 colunas com avatar/`#rank` e doca inferior com 5 modos), apoiada pela suíte modular de diálogos em `ui/src/components/home/` ([`AuthModal.tsx`](ui/src/components/home/AuthModal.tsx), [`MatchSetupModal.tsx`](ui/src/components/home/MatchSetupModal.tsx), [`OpenLobbyModal.tsx`](ui/src/components/home/OpenLobbyModal.tsx)), além da sala de espera multiplayer (`/rooms/:roomCode`) com link compartilhável, adição de Bots (`RANDOM`, `WEIGHTED_RANDOM`, `VICTORY_POINT`, `AB_2`, `AB_4`) e partida rápida.
  - [`ui/src/utils/apiClient.ts`](ui/src/utils/apiClient.ts) & [`ui/src/utils/localEngine.ts`](ui/src/utils/localEngine.ts): Cliente de API com fallback automático (`localEngine.ts`) que executa toda a lógica de Catan, salas, contas e Bots diretamente no navegador caso o backend serverless da Vercel sofra *cold start* ou perda de memória efêmera entre funções.

### Backend (`api/` e `catanatron/`) — Flask + Vercel Python Serverless
- **[`vercel.json`](vercel.json) & [`api/index.py`](api/index.py):** Entrada Serverless Python (`3.12` via `.python-version`) na Vercel que roteia `/api/*` para o Flask (`catanatron.web`).
- **[`catanatron/catanatron/web/api.py`](catanatron/catanatron/web/api.py) & [`models.py`](catanatron/catanatron/web/models.py):** Endpoints REST para jogos (`/api/games`), salas (`/api/rooms`), autenticação/perfil (`/api/auth/register`, `/api/auth/login`, `/api/auth/google`, `/api/auth/me`, `/api/auth/profile`) com exposição de `leaderboard_rank` no ranking global, histórico de partidas e análise MCTS.

---

## 3. Como Rodar no PC de Casa

```bash
# 1. Clonar o repositório
git clone https://github.com/JGallo0/catanatron-enhanced.git
cd catanatron-enhanced

# 2. Instalar dependências do frontend e rodar servidor de desenvolvimento
cd ui
npm install
npm start

# 3. Rodar testes e build de produção
npx vitest run
npm run build
```

> **Nota:** Graças ao [`localEngine.ts`](ui/src/utils/localEngine.ts), você pode rodar apenas `cd ui && npm start` no PC de casa sem nem precisar subir o Docker/Flask em Python para testar o visual, o tabuleiro, as cartas e partidas completas contra Bots!

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

### E. Avatares de Jogadores (`ui/public/assets/illustrations/avatars/`) — `1:1` (`256×256 px`)
23. **`red.webp` — Paul (Vermelho):**
    `Bust portrait of Paul, rugged Norse Viking settler with reddish-brown beard and hair, fur collar tunic, facing camera, solid red background, Catan Universe Steam style`
24. **`orange.webp` — Max (Laranja):**
    `Bust portrait of Max, medieval knight with dark trimmed beard wearing polished steel plate armor and helmet, warm amber golden background, Catan Universe Steam style`
25. **`white.webp` — Mia (Branco):**
    `Bust portrait of Mia, cute fluffy alpaca settler, emerald forest green background, Catan Universe Steam style`
26. **`blue.webp` — Sarah (Azul):**
    `Bust portrait of Sarah, adventurous female sea captain wearing navy tricorn hat and colonial coat, solid royal blue background, Catan Universe Steam style`

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

---

## 6. Guia de Variáveis de Ambiente (Vercel & Supabase Gratuito)

Para colocar o backend em produção na **Vercel** com persistência no **Supabase**:

| Variável | Onde obter | Descrição |
|---|---|---|
| `DATABASE_URL` | **Supabase Dashboard** -> Project Settings -> Database -> Connection Pooling (Session ou Transaction mode, porta `6543` / IPv4) | URL de conexão PostgreSQL (ex: `postgresql://postgres.[ref]:[senha]@aws-0-[regiao].pooler.supabase.com:6543/postgres`). Evita problemas de IPv6 na Vercel Serverless. As tabelas e colunas são criadas/migradas automaticamente pelo `models.py` na inicialização. |
| `GOOGLE_CLIENT_ID` | **Google Cloud Console** -> APIs & Services -> Credentials -> OAuth 2.0 Client IDs (Web application) | ID do cliente Google para login com 1 clique (ex: `123456...apps.googleusercontent.com`). Adicionar `http://localhost:5173` e a URL da Vercel (`https://*.vercel.app`) em *Authorized JavaScript origins*. |
| `SECRET_KEY` | Qualquer string aleatória | Chave de segurança usada internamente pelo Flask para assinar sessões. |

> **Nota sobre o plano gratuito do Supabase:** Nossa arquitetura de login utiliza Google OAuth via ID Token + PBKDF2 direto no banco SQL. Isso significa que **nenhum e-mail transacional é disparado pelo Supabase**, garantindo que o sistema funcione 100% dentro dos limites do plano gratuito sem bloqueios de cota de SMTP!

---

## 7. Próximos Passos

1. ~~**Bloco 2 — Customização de Avatar e Perfil**~~ *(Concluído)*
2. ~~**Bloco 3 — Redesign da Tela Inicial e Lobby Aberto**~~ *(Concluído)*
3. **Substituir os 4 Avatares Padrão:** Gerar retratos 100% originais via Nano Banana Pro em `ui/public/assets/illustrations/avatars/{red,orange,white,blue}.webp`.
