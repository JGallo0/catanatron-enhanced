# Rule the Isle — Especificação de Design (Bloco 4)
## Login com Google, Retângulo Preto na Home, Troca Entre Jogadores (P2P + IA), Otimização Mobile, Avatares Originais em SVG e Nomes Oficiais de Bots

**Data:** 2026-11-11  
**Branch alvo:** `layout-topbar`  
**Escopo deste documento:** Bloco 4 do **Rule the Isle** — correção definitiva do retângulo preto sobre a Home, garantia de visibilidade e funcionamento do Login com Google, substituição total de retratos herdados em `.webp` por `<PlayerAvatar />` vetorial original (com prioridade absoluta ao avatar montado interativamente pelo jogador), identidade oficial dos bots (`Creitu`, `Felire`, `Guiri`, `Jaó`, `Angeleri` — zero nomes de cores), sistema completo de troca entre jogadores (**Player-to-Player Domestic Trade**) no motor Python/IA/Web/Offline, e otimização **mobile-first** com leitura confortável e zero overflow horizontal.

---

## 1. Objetivos e Decisões Acordadas

1. **Correção do Retângulo Preto na Home (`HomePage.tsx`):**
   - **Causa raiz:** [`ReplayScreen.scss`](../../ui/src/pages/ReplayScreen.scss#L3) e [`GameScreen.scss`](../../ui/src/pages/GameScreen.scss#L44) declaram seletores globais `main { background: ... }` que vazam para `<main className="home-stage-window" />` em [`HomePage.tsx`](../../ui/src/pages/HomePage.tsx#L227), pintando um retângulo preto/opaco sobre `lobby_hero.webp`.
   - **Correção:** Escopar exclusivamente como `main.catan-replay-screen` e `main.catan-game-screen` (adicionando as classes também nos estados de *loading* de [`GameScreen.tsx`](../../ui/src/pages/GameScreen.tsx#L214) e [`ReplayScreen.tsx`](../../ui/src/pages/ReplayScreen.tsx#L49)), além de remover `fixed` da propriedade `background` em [`HomePage.scss`](../../ui/src/pages/HomePage.scss#L21) para evitar falhas de repintura em viewports mobile.

2. **Login com Google Robusto e Visível (Localhost, Vercel e Mobile):**
   - **Auto-carregamento de `.env`:** [`create_app()`](../../catanatron/catanatron/web/__init__.py) passa a carregar `.env` e `.env.local` (sem sobrescrever variáveis já definidas no ambiente) e aplica cabeçalho `Cross-Origin-Opener-Policy: same-origin-allow-popups` em todas as respostas Flask e em [`vercel.json`](../../vercel.json).
   - **Aliases de Client ID no Backend:** `_get_google_client_id()` em [`api.py`](../../catanatron/catanatron/web/api.py) aceita `GOOGLE_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_ID` ou `VITE_GOOGLE_CLIENT_ID`.
   - **Fallback de Runtime no Frontend:** Se o backend não retornar client ID mas o build Vite possuir `import.meta.env.VITE_GOOGLE_CLIENT_ID`, [`getAuthConfig()`](../../ui/src/utils/apiClient.ts) utiliza esse ID de forma transparente.
   - **Componente [`GoogleSignInButton.tsx`](../../ui/src/components/GoogleSignInButton.tsx):** callback ref resiliente, largura responsiva compatível com modais mobile, e tratamento explícito `onerror` quando o script `https://accounts.google.com/gsi/client` estiver bloqueado por rede/extensão.
   - **Visibilidade Garantida em [`AuthModal.tsx`](../../ui/src/components/home/AuthModal.tsx):** o bloco *"ou entrar com Google"* é **sempre visível**:
     - Quando configurado: renderiza o botão oficial GSI (e fallback de erro legível se bloqueado).
     - Quando não configurado no servidor/deploy: exibe aviso claro em `pt-BR` informando o estado (`Login com Google aguardando configuração de GOOGLE_CLIENT_ID no servidor/Vercel`) sem ocultar o recurso silenciosamente.

3. **Nomes Oficiais das IAs (`Creitu`, `Felire`, `Guiri`, `Jaó`, `Angeleri`):**
   - Lista fechada oficial: `("Creitu", "Felire", "Guiri", "Jaó", "Angeleri")`.
   - Nenhuma mesa, sala online, partida solo, banner superior, prompt de turno ou histórico de jogadas exibe nome de cor (`Vermelho`, `Azul`, `Laranja`, `Branco`) ou prefixo técnico (`IA (CATANATRON)`, `Bot (RANDOM)`, `🤖 Mestre da Ilha`) para bots.
   - Em toda mesa ou sala criada/atualizada, cada assento `BOT` recebe um nome distinto sorteado/atribuído de forma única dentre os 5 nomes oficiais (sem repetir nomes na mesma mesa).
   - O endpoint técnico `GET /api/players` mantém `HUMAN -> "Human"` e `R -> "Random"` com chaves de registro intactas para compatibilidade com a suíte de testes de API.

4. **Substituição Total dos Retratos Catan Universe & Prioridade do Avatar Interativo:**
   - **Remoção física:** Remover `ui/public/assets/illustrations/avatars/{red,blue,orange,white}.webp`.
   - **100% `<PlayerAvatar />` SVG:** Em [`PlayerTopBar.tsx`](../../ui/src/components/PlayerTopBar.tsx), [`OpenLobbyModal.tsx`](../../ui/src/components/home/OpenLobbyModal.tsx) e [`RoomLobbyPage.tsx`](../../ui/src/pages/RoomLobbyPage.tsx), todos os assentos (`USER`, `GUEST` e `BOT`) renderizam [`PlayerAvatar`](../../ui/src/components/PlayerAvatar.tsx). A regra CSS `.WHITE &__portrait-col { background: #1b6535 }` herdada da Mia é removida.
   - **Precedência Absoluta ao Avatar do Jogador:**
     1. Visitantes (`GUEST`) podem abrir o [`AvatarStudioModal`](../../ui/src/components/AvatarStudioModal.tsx) diretamente na Home (`🎨 Personalizar Avatar`) sem obrigatoriedade de login prévio, salvando apelido + `avatar_config` em `localStorage` (`catan_guest_profile_v1`).
     2. Visitantes e contas logadas propagam `avatar_config` ao criar partida solo (`POST /api/games`), criar sala (`POST /api/rooms`), entrar em sala (`POST /api/rooms/<code >/join`) e fazer cadastro ou login Google pela primeira vez (`POST /api/auth/register`, `POST /api/auth/google`).
     3. No backend (`StoredGame.seat_metadata_json`, `StoredRoom.seats_json`, `_enrich_view_with_seats`) e em [`localEngine.ts`](../../ui/src/utils/localEngine.ts), assentos `USER` sempre priorizam `user.avatar_config` persistido, assentos `GUEST` preservam seu `avatar_config` customizado (ou derivam fallback determinístico via apelido/cor), e assentos `BOT` utilizam [`BOT_AVATAR_PROFILES`](../../ui/src/config/botCatalog.ts) originais (que harmonizam com os tons marinhos e dourados do *Rule the Isle*).
   - **6 Modelos Prontos Refrescados (`AVATAR_PRESETS`):** Recriados em `pt-BR` alinhados à paleta original do jogo (*Capitão Dourado*, *Navegadora dos Ventos*, *Artífice das Colinas*, *Mercadora da Guilda*, *Guardiã da Floresta*, *Almirante da Ilha*).

5. **Troca Entre Jogadores (Player-to-Player Domestic Trade):**
   - **Motor Python ([`game.py`](../../catanatron/catanatron/game.py)):**
     - Endurecer `is_valid_action` e `is_valid_trade` para `OFFER_TRADE`: rejeitar se `state.is_initial_build_phase`, `state.is_road_building`, `state.is_resolving_trade`, formato inválido (não-inteiros/booleanos/negativos), ou se o proponente não possuir todas as cartas ofertadas (`player_resource_freqdeck_contains(state, action.color, offering)`).
   - **Busca em Árvore ([`tree_search_utils.py`](../../catanatron/catanatron/players/tree_search_utils.py)):**
     - Incluir `OFFER_TRADE`, `ACCEPT_TRADE`, `REJECT_TRADE`, `CONFIRM_TRADE` e `CANCEL_TRADE` em `DETERMINISTIC_ACTIONS` para que `execute_spectrum` simule respostas e confirmações sem erro durante buscas `AlphaBeta` e `MCTS`.
   - **Avaliador Estratégico para IAs ([`trade_evaluator.py`](../../catanatron/catanatron/players/trade_evaluator.py)):**
     - Novo módulo dedicado para decisão de bots sobre propostas (`DECIDE_TRADE` -> `ACCEPT_TRADE` vs `REJECT_TRADE`) e seleção de parceiro (`DECIDE_ACCEPTEES` -> `CONFIRM_TRADE` vs `CANCEL_TRADE`).
     - Critério combinado: melhora na função heurística base/contender ou conclusão imediata de compra/construção estratégica (`CITY`, `SETTLEMENT`, `ROAD`, `DEV_CARD`), com desempate seguro quando `ACCEPT_TRADE` não está disponível ou piora o adversário próximo da vitória.
     - Integrado em `ValueFunctionPlayer`, `AlphaBetaPlayer`/`SameTurnAlphaBetaPlayer`/`Catanatron`, `MCTSPlayer`, `WeightedRandomPlayer`, `VictoryPointPlayer` e `GreedyPlayoutsPlayer`. `RandomPlayer` permanece intacto para preservar determinismo dos testes base do motor.
   - **Paridade Completa Offline ([`localEngine.ts`](../../ui/src/utils/localEngine.ts)):**
     - Implementar máquina de estados completa `PLAY_TURN -> DECIDE_TRADE -> DECIDE_ACCEPTEES / CANCEL -> PLAY_TURN` respeitando `current_trade` (11 elementos), `acceptees` (array booleano) e `is_resolving_trade`, com geração automática de `ACCEPT_TRADE`/`REJECT_TRADE` e `CONFIRM_TRADE`/`CANCEL_TRADE` e heurística de resposta para bots.
   - **Interface e Fluxo de Jogo (`ui/`):**
     - [`TradeModal.tsx`](../../ui/src/components/TradeModal.tsx) reestruturado com 2 abas:
       - **`🤝 Entre Jogadores`** (padrão pós-rolagem quando houver cartas na mão): seletor visual *"Você Oferece"* e *"Você Pede"* com contadores `-`/`+` em tempo real, validação contra troca idêntica ou oferta vazia e botão `Enviar Proposta`.
       - **`⚓ Porto & Banco`**: fluxo 4:1 / 3:1 / 2:1 preservado integralmente.
     - Novo [`TradeOfferDecisionDialog.tsx`](../../ui/src/components/TradeOfferDecisionDialog.tsx) acionado automaticamente em [`GameScreen.tsx`](../../ui/src/pages/GameScreen.tsx) quando o assento local (`perspective` / humano único) for o respondente de `DECIDE_TRADE` ou o proponente escolhendo parceiros em `DECIDE_ACCEPTEES` (com fallback amigável e botão `Aceitar`/`Recusar`, lista de quem aceitou e `Confirmar com <Jogador>`/`Cancelar Proposta`).
     - [`ActionsToolbar.tsx`](../../ui/src/pages/ActionsToolbar.tsx) libera o botão `Trocar` sempre que for vez interativa pós-rolagem em `PLAY_TURN` (mesmo com `< 4` cartas sem porto, pois é possível propor troca P2P com 1 carta!).
     - [`promptUtils.ts`](../../ui/src/utils/promptUtils.ts) e [`soundEffects.ts`](../../ui/src/utils/soundEffects.ts) ganham cobertura completa para `OFFER_TRADE`, `ACCEPT_TRADE`, `REJECT_TRADE`, `CONFIRM_TRADE`, `CANCEL_TRADE`.

6. **Otimização Mobile-First (Retrato `<= 768px` / `<= 480px` e Paisagem Compacta `max-height: 520px`):**
   - **Tabuleiro em Destaque (`~60%+` da altura útil em `375×812`):**
     - `.game-top-hud` compacto com chips essenciais em uma faixa enxuta (`<= 44px`).
     - [`PlayerTopBar.tsx`](../../ui/src/components/PlayerTopBar.tsx) em `<= 768px` exibe faixa horizontal enxuta de mini-cards (`avatar 28px`, nome, cartas, PV em destaque e indicador de vez) + *tap-to-inspect* (ao tocar em um jogador abre *popover* com peças construídas, cavaleiros, maior estrada e medalhas).
     - [`Board.tsx`](../../ui/src/pages/Board.tsx) recalcula `canvasHeight` considerando a HUD e a doca mobile compactas; [`ZoomableBoard.tsx`](../../ui/src/pages/ZoomableBoard.tsx) + [`Board.scss`](../../ui/src/pages/Board.scss) aplicam `touch-action: none` na superfície do tabuleiro e reposicionam os controles de câmera sem obstruir a mão.
     - [`ActionsToolbar.scss`](../../ui/src/pages/ActionsToolbar.scss) organiza a doca inferior com fileira horizontal deslizável de cartas + tira de ações táteis (`>= 44px` de área clicável) e orbe principal no canto direito inferior.
   - Modais (`AuthModal`, `MatchSetupModal`, `OpenLobbyModal`, `TradeModal`, `TradeOfferDecisionDialog`, `AvatarStudioModal`, `LeaderboardModal`, `DiscardPlannerDialog`) adaptam margens, grids e scroll vertical interno sem vazamento horizontal em `360px`–`430px`.

7. **Consistência de Pacote Vercel (`api/catanatron` & `api/index.py`):**
   - [`api/index.py`](../../api/index.py) passa a inserir `ROOT_DIR/catanatron` com máxima prioridade em `sys.path`, e [`api/catanatron`](../../api/catanatron) é sincronizado integralmente com `catanatron/catanatron` para evitar qualquer divergência em serverless.

---

## 2. Critérios de Aceite e Testes

1. **Pytest (`tests/` e `tests/web/`):**
   - `tests/test_domestic_trade.py`: validação estrita de `OFFER_TRADE`, expansão em árvore AlphaBeta/MCTS durante `DECIDE_TRADE`/`DECIDE_ACCEPTEES`, decisão inteligente dos 6 perfis de bots estratégicos e manutenção do determinismo do `RandomPlayer`.
   - `tests/web/test_auth_and_ranking.py` & `tests/web/test_rooms.py`: carregamento `.env.local`/alias Google, header COOP, nomes oficiais de bots sem nomes de cor em solo/salas/histórico, propagação de `avatar_config` em cadastro/Google/visitante/sala/jogo e paridade `api/catanatron` vs `catanatron/catanatron`.
2. **Frontend (`npx tsc --noEmit`, `npx vitest run`, `npm run build`):**
   - Cobertura Vitest para `HomePage` (sem card bloqueando palco e visita ao Studio livre), `AuthModal` (visibilidade da seção Google configurada ou explicativa), `AvatarStudioModal`, `PlayerTopBar` (100% SVG + popover mobile), `TradeModal` (abas `Entre Jogadores` + `Porto & Banco`), `TradeOfferDecisionDialog`, `promptUtils` (pt-BR/EN P2P) e `localEngine` (ciclo completo P2P e nomes oficiais de bots).
3. **Verificação ao Vivo no Navegador (`browser` em `1280×800` e `375×812`):**
   - `HomePage` livre do retângulo preto sobre `lobby_hero.webp`, seção Google visível no `AuthModal`, zero `.webp` antigo servido, avatares SVG customizados do usuário e dos bots (`Creitu`, `Felire`, `Guiri`, `Jaó`, `Angeleri`) em mesa real, fluxo completo de proposta e resposta P2P funcionando e zero `scrollWidth > clientWidth` no mobile.
