# Rule the Isle — Especificação de Design (Bloco 3)
## Redesign da Tela Inicial (Palco Aberto A2) e Lobby Aberto Modular

**Data:** 2026-11-11  
**Branch alvo:** `layout-topbar`  
**Escopo deste documento:** Bloco 3 de 3 da reformulação do **Rule the Isle** — substituição do card sólido central da Tela Inicial pelo palco aberto panorâmico sobre `lobby_hero.webp` (Layout **A2**), apresentação do avatar e `#rank` oficial do jogador no cabeçalho, doca dedicada com os 5 modos principais, extração dos fluxos em 3 modais modulares (`AuthModal`, `MatchSetupModal`, `OpenLobbyModal`) e exposição de `leaderboard_rank` no backend e espelho offline.

---

## 1. Objetivos e Decisões Acordadas

1. **Palco Aberto sobre `lobby_hero.webp` (Layout A2):**
   - Remover o card central sólido (`.setup-card`) e a máscara pesada (`rgba(11, 25, 44, 0.86)`) que ocultavam a ilha, o castelo e os barcos.
   - Manter apenas degradês sutis de leitura nas bordas superior e inferior da tela, preservando **100% do centro da tela descoberto**.
   - **Cabeçalho Simétrico em 3 Colunas (A2):**
     - **Esquerda (Identidade):** avatar [`PlayerAvatar`](../../ui/src/components/PlayerAvatar.tsx) (`56px`), nome de exibição, `@username` e moldura atual (quando logado; clicável para abrir [`AvatarStudioModal`](../../ui/src/components/AvatarStudioModal.tsx)); ou card compacto de visitante com atalho `Entrar` quando deslogado.
     - **Centro (Título Monumental):** `RULE THE ISLE` em destaque ampliado (Cinzel dourado com brilho e sombra profunda) acompanhado de subtítulo curto (`Mãos Privadas no Multiplayer • Estratégia em Português`).
     - **Direita (Placar & Conta):** posição real **`#<rank> no Ranking`**, Vitórias, Partidas, `% Aproveitamento` e botão `Sair` quando logado; ou botão destacado `👤 Entrar / Criar Conta` + indicação `🏆 Ranking Global ativo` quando deslogado.
2. **Doca Inferior com os 5 Botões Dedicados:**
   - **`⚔️ Partida Rápida (Solo/IA)`** — CTA dourado principal -> abre `MatchSetupModal` no modo `solo`.
   - **`🌐 Criar Sala Online`** — CTA azul royal -> abre `MatchSetupModal` no modo `room`.
   - **`🧭 Salas Abertas`** — exibe contador dinâmico `activeRooms.length` quando maior que zero (ex.: `🧭 Salas Abertas (3)`, sincronizado com `Todas (N)` dentro do modal) -> abre `OpenLobbyModal`.
   - **`🏆 Ranking & Histórico`** — abre [`LeaderboardModal`](../../ui/src/components/LeaderboardModal.tsx).
   - **`🎨 Personalizar Avatar`** — abre [`AvatarStudioModal`](../../ui/src/components/AvatarStudioModal.tsx) se logado; caso contrário abre `AuthModal` com abertura automática do Studio após login/cadastro.
3. **Lobby Aberto Unificado sem Alteração de Schema no Banco:**
   - Todas as salas ativas continuam sendo listadas em `GET /api/rooms` e `localListActiveRooms` sem criar nova coluna de privacidade/visibilidade no SQLite/Postgres.
   - O novo `OpenLobbyModal` organiza a experiência com filtros locais (`Todas`, `Com Vagas`, `Minhas`), entrada por código (`#K7M4P9`), faixa visual de assentos com `<PlayerAvatar />` dos participantes e ação contextual (`Entrar`, `▶ Retomar`, `👁 Assistir`).
4. **Posição Real no Ranking (`leaderboard_rank`):**
   - Exposta tanto no backend (`models.py`) quanto no espelho offline (`localEngine.ts`) sem alterar as chaves existentes de `stats` (`wins`, `losses`, `games_played`, `win_rate`).

---

## 2. Arquitetura Backend (`catanatron/catanatron/web/models.py`)

Nenhuma tabela nem migração destrutiva de banco é necessária.

### 2.1 Helper Compartilhado `_build_leaderboard_rows()` e `get_user_rank()`
- Extrair a lógica de contagem e ordenação de `get_leaderboard()` para um helper interno `_build_leaderboard_rows() -> list[dict]` usando exatamente a mesma chave de ordenação já consolidada no Bloco 1:
  ```python
  (-item["wins"], -item["win_rate"], -item["games_played"], item["username"])
  ```
- `get_leaderboard(limit: int = 100)` retorna `_build_leaderboard_rows()[:limit]` com `"rank"` de `1` a `N`.
- `get_user_rank(username: str) -> int | None` localiza `username` nas linhas ranqueadas e retorna seu `rank` (inteiro `>= 1`), ou `None` caso o usuário não exista na tabela `users`.

### 2.2 Exposição em `serialize_user(user, stats=None)`
- Quando `stats is not None` (`GET /api/auth/me`, `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/google`, `PATCH /api/auth/profile`), `serialize_user` adiciona no nível raiz do payload:
  ```python
  payload["leaderboard_rank"] = get_user_rank(user.username)
  ```
- O objeto `payload["stats"]` mantém exatamente as 4 chaves atuais (`wins`, `losses`, `games_played`, `win_rate`), garantindo 100% de retrocompatibilidade com clientes e testes existentes.

---

## 3. Arquitetura Frontend (`ui/src/`)

### 3.1 Tipos, API Client e Espelho Offline
- **`ui/src/utils/apiClient.ts` (`PlayerAccount` & `fetchCurrentAccount`):**
  - Adicionar `leaderboard_rank?: number | null;` diretamente no tipo `PlayerAccount` (que já é importado por `localEngine.ts`, `HomePage.tsx` e `AvatarStudioModal.tsx`).
  - Em `fetchCurrentAccount()`: quando houver erro de rede e o cliente usar o snapshot salvo em `localStorage` (`saved`), hidratar `stats` e `leaderboard_rank` a partir de `localGetLeaderboard()` se ausentes ou em sessão `local_`/`acct_`, mantendo o card do topo consistente offline.
- **`ui/src/utils/localEngine.ts`:**
  - Adicionar helper `computeLocalUserRankAndStats(username)` que consulta `localGetLeaderboard()`:
    - Garante o usuário no diretório local via `ensureLocalUserDirectoryEntry` (ou registro já existente) para refletir posição e estatísticas consistentes.
    - Preenche `stats` (`wins`, `losses`, `games_played`, `win_rate`) e `leaderboard_rank` em `localRegisterUser`, `localLoginUser` e `localUpdateProfile`.

### 3.2 Palco Principal [`HomePage.tsx`](../../ui/src/pages/HomePage.tsx) & [`HomePage.scss`](../../ui/src/pages/HomePage.scss)
- **`HomePage.tsx`:** Orquestra o estado da conta, polling de salas (`listActiveRooms` a cada 5s), abertura dos modais (`setupMode: "solo" | "room" | null`, `openLobbyOpen`, `authOpen`, `pendingAvatarStudioAfterAuth`, `leaderboardOpen`, `avatarStudioOpen`) e callbacks de navegação.
- **Estrutura Visual A2 (`HomePage.scss`):**
  - `.home-page--stage`: container `min-height: 100dvh`, `display: flex; flex-direction: column; justify-content: space-between`, fundo com `lobby_hero.webp` (`center center / cover no-repeat`) e máscara leve apenas nas bordas (`rgba(6, 13, 24, 0.58)` no topo, `0.06` no meio, `0.80` na base).
  - `.home-topbar`: grid `grid-template-columns: minmax(220px, 1fr) auto minmax(220px, 1fr)` no desktop (`>= 960px`):
    - **Esquerda (`.home-identity-pill`):** `<PlayerAvatar size={56} />`, `display_name`, `@username` e nome da moldura ativa obtido de `AVATAR_FRAME_OPTIONS`; clique abre `AvatarStudioModal` (se deslogado, exibe card neutro *Explorador da Ilha* + botão `Entrar`).
    - **Centro (`.home-hero-brand`):** `<h1 className="logo">` (`RULE THE ISLE`) com `clamp(2.2rem, 4.4vw, 3.5rem)` e subtítulo `.home-hero-subtitle`.
    - **Direita (`.home-rank-pill`):** `#<leaderboard_rank> no Ranking` quando `account.leaderboard_rank` for numérico (ou `Ranking Ativo` se nulo/ausente), contagem `Vitórias / Partidas / %` e botão `Sair` (ou botão destacado `👤 Entrar / Criar Conta` quando deslogado).
  - `.home-stage-window`: área central transparente flexível que deixa a ilha de `lobby_hero.webp` completamente livre.
  - `.home-dock-wrap`: doca flutuante translúcida na base com os 5 botões dedicados e o rodapé legal GPL-3.0 logo abaixo.
  - **Responsivo (`<= 960px` e `<= 560px`):** título sobe para a primeira linha do cabeçalho; cartões de identidade e placar ficam em 2 colunas logo abaixo (ou 1 coluna em telas muito estreitas); a doca vira grid 2 colunas com `⚔️ Partida Rápida (Solo/IA)` em largura total na primeira linha.

### 3.3 Modais Modulares em `ui/src/components/home/`

1. **[`AuthModal.tsx`](../../ui/src/components/home/AuthModal.tsx) & [`AuthModal.scss`](../../ui/src/components/home/AuthModal.scss):**
   - Props: `open`, `onClose`, `authConfig`, `promptBanner?: string`, `onAuthenticated(account: PlayerAccount)`.
   - Conteúdo: abas `Entrar` / `Criar Conta`, campos (`Usuário`, `Apelido na mesa` no cadastro, `Senha`), submissão por `Enter`, `GoogleSignInButton` quando `authConfig.google_enabled && authConfig.google_client_id`, banner opcional explicativo (ex.: ao tentar abrir o Studio deslogado) e erro inline em `pt-BR`.
   - Mantém o modal aberto em caso de erro; no sucesso chama `onAuthenticated(logged)` e `onClose()`.

2. **[`MatchSetupModal.tsx`](../../ui/src/components/home/MatchSetupModal.tsx) & [`MatchSetupModal.scss`](../../ui/src/components/home/MatchSetupModal.scss):**
   - Props: `mode: "solo" | "room" | null`, `onClose`, `availablePlayers`, `defaultHostName`, `account`, `onRoomCreated(roomCode)`, `onGameCreated(gameId)`.
   - Regras configuráveis preservadas integralmente:
     - `Modelo do Mapa`: `PADRÃO (BASE)`, `MINI (RÁPIDO)`, `TORNEIO`.
     - `Pontos para Vencer` (3–20), `Limite de Cartas (Ladrão)` (5–20), `Ladrão Amigável` com Tooltip explicativa.
     - `Jogadores na Mesa` (2–4 assentos com chip colorido, Select de Bots + Humano, `+ Adicionar Jogador`, `Remover`).
   - Diferenciação por modo:
     - `solo`: título `⚔️ Partida Rápida (Solo vs IA)`, CTA dourado `⚔️ Iniciar Partida`, chama `createGame(...)`.
     - `room`: título `🌐 Criar Sala Online`, campo `Seu Apelido na Mesa` (editável, inicializado com `account.display_name` ou `defaultHostName`), garante mínimo de 2 assentos `HUMAN` ao criar, CTA azul `🔗 Criar Sala e Gerar Link`, chama `createRoom(...)` e salva `catan_room_token_<CODE>`.
   - Exibe erro inline e restaura estado do botão caso a chamada falhe (nunca deixa tela presa em loading infinito).

3. **[`OpenLobbyModal.tsx`](../../ui/src/components/home/OpenLobbyModal.tsx) & [`OpenLobbyModal.scss`](../../ui/src/components/home/OpenLobbyModal.scss):**
   - Props: `open`, `onClose`, `rooms`, `onJoinRoom(roomCode)`, `onOpenMatch(gameId, myColor)`, `onCreateRoomClick()`, `onRefresh()`.
   - Barra superior de código direto (`Código da sala, ex: K7M4P9`, filtro `A-Z0-9`, botão `Entrar` ativo com `>= 4` caracteres) + botão manual `↻ Atualizar`.
   - Filtros rápidos em pílulas com contadores:
     - `Todas (N)`
     - `Com Vagas (M)` (`status === "WAITING"` e pelo menos um assento `!is_bot && !claimed`)
     - `Minhas (K)` (`my_color !== null`)
   - Cada card de sala exibe:
     - Cabeçalho: `#room_code`, status pill (`Aberta — X vaga(s)` ou `Em Andamento`), tag `★ Seu Assento: <Cor>`, resumo (`Mapa <template> • <vps_to_win> PV`).
     - **Faixa visual de assentos:** renderiza os 2–4 assentos da sala:
       - Assento `USER`: `<PlayerAvatar config={seat.avatar_config} username={seat.username || seat.player_name} size={28} />` + nome e chip da cor.
       - Assento `BOT`: badge 🤖 + nome do bot.
       - Assento `HUMAN` aberto: badge pontilhada `Vaga Aberta`.
       - Assento `GUEST` ocupado: badge 👤 + apelido.
     - Botão de ação: `Entrar`, `▶ Retomar` ou `👁 Assistir`.
   - Empty state amigável com botão *"Criar Nova Sala Online"* (`onCreateRoomClick()`, que fecha o Lobby Aberto e abre `MatchSetupModal` no modo `"room"`) quando nenhuma sala corresponder ao filtro.

---

## 4. Plano de Testes e Critérios de Sucesso

1. **Backend (`pytest -o addopts="" tests/web -v`):**
   - Novo teste em `tests/web/test_auth_and_ranking.py` verificando:
     - `leaderboard_rank` retornado em `/api/auth/register`, `/api/auth/login` e `/api/auth/me` refletindo a posição exata no ranking após vitórias/derrotas.
     - Compatibilidade mantida com `me["stats"] == {"wins", "losses", "games_played", "win_rate"}`.
2. **Frontend (`npx tsc --noEmit`, `npx vitest run`, `npm run build`):**
   - Atualizar [`ui/src/App.test.tsx`](../../ui/src/App.test.tsx) (adaptando-o ao novo fluxo: verificar palco A2 + 5 botões de modo e abrir o modal de *Partida Rápida* para validar os controles de partida em `pt-BR`) e criar testes dedicados para `HomePage` / `AuthModal` / `MatchSetupModal` / `OpenLobbyModal` cobrindo:
     - Renderização do palco A2 sem `.setup-card` sólido bloqueando o centro, exibição do título `Rule the Isle`, identidade/avatar, `#rank` e os 5 botões dedicados na doca.
     - Abertura de *Partida Rápida (Solo/IA)* exibindo os controles de Mapa, Pontos para Vencer, Limite de Cartas, Ladrão Amigável e Jogadores na Mesa.
     - Abertura de *Criar Sala Online* exibindo apelido e CTA de sala.
     - Abertura de *Salas Abertas* com filtro (`Com Vagas`, `Minhas`), renderização de `<PlayerAvatar />` nos assentos `USER` e entrada por código.
     - Fluxo de clicar em `🎨 Personalizar Avatar` deslogado -> `AuthModal` -> após login/cadastro abrir `AvatarStudioModal` automaticamente.
   - Build de produção `npm run build` sem erros.
