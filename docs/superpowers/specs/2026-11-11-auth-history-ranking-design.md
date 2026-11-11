# Rule the Isle — Especificação de Design (Bloco 1)
## Login Persistente, Banco em Nuvem, Histórico de Partidas e Ranking Global

**Data:** 2026-11-11  
**Branch alvo:** `layout-topbar`  
**Escopo deste documento:** Bloco 1 de 3 da reformulação do lobby e sistema de contas do **Rule the Isle** (fundação de dados e contas que sustentará o **Bloco 2: Criador de Avatar** e o **Bloco 3: Nova Tela Inicial Aberta**).

---

## 1. Objetivo e Regras de Negócio Acordadas

1. **Persistência Real Multi-Dispositivo:** Contas de usuário, sessões ativas, partidas concluídas e ranking global devem persistir em PostgreSQL na nuvem (Supabase Free via `DATABASE_URL` na Vercel), mantendo SQLite em desenvolvimento local e fallback offline no navegador (`localEngine.ts`).
2. **Entrada Flexível (Conta + Convidado):**
   - Usuários podem entrar com **Google (OAuth / 1 clique, sem envio de e-mail)** ou por **Usuário + Senha (sem exigir e-mail)** em abas separadas (**Entrar** e **Criar Conta**).
   - Usuários sem conta ainda podem jogar como **Convidados** em partidas rápidas ou salas via link de convite, sem pontuar no Ranking Global.
3. **Gravação Completa do Histórico:**
   - **Todas as partidas concluídas** (Solo vs IA ou Multiplayer Online) são gravadas no histórico, **inclusive quando uma IA vence**.
   - Partidas não concluídas (abandonadas em andamento) não geram registro no histórico nem afetam estatísticas.
4. **Ranking Exclusivo de Humanos Registrados:**
   - O Ranking Global exibe **apenas usuários humanos cadastrados** (Bots e Convidados não aparecem como linhas do Ranking).
   - O percentual de vitórias é calculado exclusivamente sobre as partidas que aquele usuário concluiu:
     $$\text{Win\%} = \frac{\text{Vitórias do Usuário}}{\text{Partidas Jogadas pelo Usuário}} \times 100$$
   - Ordenação padrão do Ranking: **Vitórias ↓**, **% de Vitórias ↓**, **Partidas Jogadas ↓**, **Username ↑**.

---

## 2. Arquitetura e Banco de Dados (`catanatron/catanatron/web/models.py`)

### 2.1 Conexão e Migração Idempotente (`__init__.py`)
- [`create_app`](../../catanatron/catanatron/web/__init__.py) continua lendo `DATABASE_URL` ou `POSTGRES_URL` (com fallback SQLite em `/tmp/catanatron.db` no local/testes).
- Para Supabase Free em produção na Vercel, será usada a connection string do **Pooler IPv4** (`postgresql://...`), compatível com `psycopg2-binary` e `pool_pre_ping=True`.
- Após `db.create_all()`, um helper `_ensure_schema_columns(db.engine)` verifica colunas existentes via SQLAlchemy `inspect(engine)` e executa `ALTER TABLE ... ADD COLUMN` de forma idempotente caso `users`, `games` ou `rooms` já existam de versões anteriores.

### 2.2 Modelos de Dados

#### `users` (`StoredUser` — evoluído)
| Coluna | Tipo | Restrição | Finalidade |
|---|---|---|---|
| `username` | `String(32)` | PK | Identificador único em minúsculas (`[a-z0-9_-]`) |
| `display_name` | `String(48)` | NOT NULL | Nome exibido nas mesas, salas e ranking |
| `password_hash` | `String(256)` | NULLABLE | Hash `pbkdf2_sha256` com salt aleatório (`$salt$digest`); nulo em contas exclusivamente Google |
| `pin_hash` | `String(128)` | NULLABLE | Mantido para leitura/migração transparente de contas antigas; atualizado para `password_hash` no login |
| `google_sub` | `String(64)` | UNIQUE, INDEX, NULLABLE | ID imutável da conta Google |
| `email` | `String(255)` | INDEX, NULLABLE | E-mail verificado retornado pelo Google (nunca usado para SMTP) |
| `avatar_json` | `Text` | NOT NULL, default `'{}'` | Configuração de avatar preparada para o Bloco 2 |
| `auth_token` | `String(64)` | NULLABLE | Mantido apenas por retrocompatibilidade legada |
| `created_at` | `Integer` | NOT NULL | Epoch UTC em segundos |

#### `user_sessions` (`StoredSession` — nova)
| Coluna | Tipo | Restrição | Finalidade |
|---|---|---|---|
| `token` | `String(64)` | PK | Token aleatório (`secrets.token_hex(24)`) da sessão ativa |
| `username` | `String(32)` | FK `users.username`, INDEX, NOT NULL | Dono da sessão |
| `created_at` | `Integer` | NOT NULL | Data de criação (epoch UTC) |
| `last_seen_at` | `Integer` | NOT NULL | Última validação via `/api/auth/me` |
| `expires_at` | `Integer` | NOT NULL | Expiração padrão de 90 dias |

- Múltiplas sessões por usuário permitem permanecer logado simultaneamente no desktop e no celular. O logout revoga somente o token enviado.

#### `games` (`StoredGame` — adição de metadados)
- Nova coluna `seat_metadata_json` (`Text`, nullable): lista ordenada por cor (`RED`, `BLUE`, `ORANGE`, `WHITE`) com `{ color, seat_kind: "USER" | "GUEST" | "BOT", username: string | null, player_key: string, display_name: string }`.

#### `rooms` (`StoredRoom` — enriquecimento em `seats_json`)
- Cada item de `seats_json` passa a incluir `seat_kind` (`"USER"` | `"GUEST"` | `"BOT"`) e `username` (`string | null`) quando o jogador ocupar a cadeira autenticado.

#### `matches` (`StoredMatch` — nova)
| Coluna | Tipo | Restrição | Finalidade |
|---|---|---|---|
| `game_id` | `String(64)` | PK | Chave única do jogo finalizado (garante idempotência) |
| `room_code` | `String(16)` | INDEX, NULLABLE | Código da sala se veio de lobby multiplayer |
| `mode` | `String(16)` | NOT NULL | `"MULTIPLAYER"` (2+ assentos humanos ou criado via sala) ou `"SOLO"` |
| `map_template` | `String(24)` | NOT NULL | `"BASE"`, `"MINI"` ou `"TOURNAMENT"` |
| `vps_to_win` | `Integer` | NOT NULL | Meta de pontos configurada |
| `num_turns` | `Integer` | NOT NULL | Quantidade de turnos da partida |
| `winning_color` | `String(16)` | NOT NULL | Cor vencedora (`RED`, `BLUE`, `ORANGE`, `WHITE`) |
| `winner_name` | `String(64)` | NOT NULL | Nome exibido do vencedor (Usuário, Convidado ou IA) |
| `winner_username` | `String(32)` | INDEX, NULLABLE | `username` do vencedor, ou `NULL` se IA/Convidado venceu |
| `winner_is_bot` | `Boolean` | NOT NULL | `true` quando uma IA venceu a partida |
| `finished_at` | `Integer` | INDEX, NOT NULL | Timestamp UTC de conclusão |

#### `match_participants` (`StoredMatchParticipant` — nova)
| Coluna | Tipo | Restrição | Finalidade |
|---|---|---|---|
| `id` | `Integer` | PK autoincrement | Identificador da participação |
| `game_id` | `String(64)` | FK `matches.game_id`, INDEX, NOT NULL | Partida correspondente |
| `color` | `String(16)` | NOT NULL | Cor do assento na partida |
| `seat_kind` | `String(16)` | NOT NULL | `"USER"`, `"GUEST"` ou `"BOT"` |
| `username` | `String(32)` | FK `users.username`, INDEX, NULLABLE | Preenchido **somente** quando `seat_kind == "USER"` |
| `player_key` | `String(32)` | NOT NULL | `"HUMAN"`, `"CATANATRON"`, `"MCTS"`, etc. |
| `display_name` | `String(64)` | NOT NULL | Nome exibido naquela partida |
| `victory_points` | `Integer` | NOT NULL | Pontos de vitória finais reais (`ACTUAL_VICTORY_POINTS`) |
| `is_winner` | `Boolean` | NOT NULL | `true` para o vencedor |

---

## 3. Fluxos e Endpoints da API (`catanatron/catanatron/web/api.py`)

### 3.1 Autenticação e Sessão
- **Extração de token:** Helper `_extract_auth_token()` aceita `Authorization: Bearer <token>`, campo JSON `token`/`auth_token` ou query `?token=`.
- **`GET /api/auth/config`:** Retorna `{ google_enabled: bool, google_client_id: string | null }` a partir de `os.environ.get("GOOGLE_CLIENT_ID")`. Permite habilitar/trocar o Client ID na Vercel sem reconstruir o bundle Vite.
- **`POST /api/auth/register`:**
  - Recebe `{ username, password, display_name }`.
  - Valida `username` (`2–24` caracteres `[a-z0-9_-]`), `password` (`4–128` caracteres) e `display_name` (até `32` caracteres; se omitido, usa `username`).
  - Retorna **`409 Conflict`** se o usuário já existir (nunca sobrescreve conta existente).
  - Cria `StoredUser` com hash `pbkdf2_hmac("sha256", ...)` + `StoredSession` e retorna `{ user, auth_token }`.
- **`POST /api/auth/login`:**
  - Recebe `{ username, password }` (aceitando alias `pin` e senhas legadas com `>= 3` caracteres para migração sem atrito).
  - Verifica `password_hash` (ou legado `pin_hash` fazendo upgrade silencioso para `password_hash`).
  - Retorna **`401 Unauthorized`** se usuário não existir ou senha não conferir (corrige o bug anterior de auto-criar contas em erro de digitação).
  - Cria nova `StoredSession` e retorna `{ user, auth_token }`.
- **`POST /api/auth/google`:**
  - Recebe `{ credential }` (ID Token JWT do *Google Identity Services*).
  - Valida via HTTPS em `https://oauth2.googleapis.com/tokeninfo?id_token=...` (usando `urllib.request` padrão sem dependências pesadas):
    - Confere `aud == GOOGLE_CLIENT_ID`, `iss in ("accounts.google.com", "https://accounts.google.com")`, `exp` não expirado (`int(exp) > time.time()`), `email_verified` verdadeiro e `sub` válido.
  - Se `GOOGLE_CLIENT_ID` não estiver configurado, retorna `503`; se o token falhar, retorna `401`.
  - Busca por `google_sub`; se não existir, gera `username` único sanitizado a partir do prefixo do e-mail/nome (com sufixo numérico se necessário) e cria `StoredUser` com `is_new = true`. Cria `StoredSession` e retorna `{ user, auth_token, is_new }`.
- **`GET /api/auth/me`:**
  - Valida sessão em `user_sessions` (e fallback legado em `users.auth_token`), atualiza `last_seen_at` e devolve perfil + estatísticas resumidas (`wins`, `games_played`, `win_rate`). Retorna `401` se inválido/expirado.
- **`POST /api/auth/logout`:**
  - Remove a linha correspondente da `user_sessions`.
- **`PATCH /api/auth/profile`:**
  - Permite usuário autenticado atualizar `display_name` (e futuramente `avatar_config`).

### 3.2 Registro de Partidas e Identidade
- **`POST /api/games`:** Aceita opcionalmente `auth_token` e `host_name`. Quando a sessão é válida, preenche a primeira cadeira humana como `"USER"` vinculado ao `username` do usuário autenticado; bots viram `"BOT"`; humano sem sessão vira `"GUEST"`.
- **`POST /api/rooms`, `/api/rooms/<code>/join`, `PATCH /api/rooms/<code>`:** Resolvem `auth_token` via `StoredSession`; quando presente e válido, vinculam `seat["username"]` e `seat["seat_kind"] = "USER"`. Ao iniciar a partida (`/start`), copiam esses metadados para `StoredGame.seat_metadata_json`.
- **Conclusão de Partida (`post_action_endpoint`):**
  - Logo após executar jogada humana ou de Bot que resulte em `game.winning_color() is not None`, chama `record_completed_match(game)`.
  - **`record_completed_match(game)`:**
    1. Consulta se `StoredMatch` já existe para `game.id`; se sim, retorna imediatamente.
    2. Lê os metadados de assento (`seat_metadata_json`, ou de `StoredRoom` associado como fallback; se ambos estiverem ausentes em jogos legados, infere `"BOT"` para bots e `"GUEST"` para humanos sem bloquear o encerramento) e lê os PV reais finais de cada cor pelo motor (`get_actual_victory_points(game.state, color)`).
    3. Grava `StoredMatch` + 1 `StoredMatchParticipant` por cor. Em caso de corrida simultânea entre clientes (`IntegrityError`), faz `rollback()` limpo e ignora duplicata.
    4. Garante que um mesmo `username` não seja creditado em duplicidade na mesma partida caso ocorra cenário atípico de assento repetido.

### 3.3 Ranking Global e Histórico
- **`GET /api/leaderboard`:**
  - Consulta todos os usuários em `StoredUser` agregando apenas linhas de `StoredMatchParticipant` onde `seat_kind == "USER"` e `username == StoredUser.username`:
    - `wins = COUNT(case is_winner = true)`
    - `games_played = COUNT(participações)`
    - `losses = games_played - wins`
    - `win_rate = round((wins / games_played) * 100, 1) if games_played > 0 else 0.0`
  - Ordenação padrão: `(-wins, -win_rate, -games_played, username)`.
  - Retorna array com `{ rank, username, display_name, avatar_config, wins, losses, games_played, win_rate }`.
- **`GET /api/matches`:**
  - Aceita `?username=<user>` e `?limit=<n>` (padrão 25, máx. 100).
  - Retorna partidas ordenadas por `finished_at DESC`, incluindo array `participants` ordenado por vencedor primeiro e `victory_points DESC`.

---

## 4. Integração Frontend (`ui/`) — Escopo do Bloco 1

- **Cliente HTTP (`ui/src/utils/apiClient.ts` & `api.types.ts`):**
  - Envia token salvo automaticamente em `getSavedAccount()` no header `Authorization: Bearer <token>` ou payload ao criar partidas rápidas e entrar/criar salas.
  - Adiciona funções tipadas: `getAuthConfig`, `registerAccount`, `loginAccount`, `loginWithGoogle`, `fetchCurrentAccount`, `logoutAccount`, `updateProfile`, `getLeaderboard` e `getMatchHistory`.
  - Mantém hidratação automática de sessão no boot do app (`fetchCurrentAccount` valida token salvo e sincroniza `display_name`/estatísticas reais).
- **Fallback Offline (`ui/src/utils/localEngine.ts`):**
  - Quando a API Python não estiver acessível (ex.: desenvolvimento local só com Vite ou falta de rede), grava partidas concluídas localmente no `localStorage` e devolve ranking/histórico local com flag `is_offline_fallback: true` para transparência ao usuário.
- **Interface Temporária do Bloco 1 (`HomePage.tsx`):**
  - Atualiza a barra de conta atual na `HomePage` com abas **Entrar** / **Criar Conta** (Usuário + Senha sem e-mail) + botão **Entrar com Google** (exibido quando `google_enabled === true`) + modais/abas de **Ranking Global** e **Histórico de Partidas** para validar o sistema ponta a ponta antes da reformulação visual do **Bloco 3**.

---

## 5. Plano de Testes e Critérios de Sucesso

1. **Testes Backend (`pytest` em ambiente isolado SQLite em memória/tmp):**
   - Registro bloqueia usuário duplicado com `409`; login exige senha válida (`401` em erro ou usuário inexistente); múltiplos tokens de sessão funcionam em paralelo e logout revoga apenas o token usado.
   - Login Google mockando resposta `tokeninfo` cria conta nova em `google_sub` inédito, reutiliza no segundo acesso e rejeita `aud` inválido ou e-mail não verificado (`401`).
   - Partida concluída com vitória humana incrementa `wins` e `games_played`; partida onde uma IA vence é gravada em `matches` (`winner_is_bot=True`) e incrementa `games_played` (reduzindo `win_rate`) do humano sem adicionar a IA ao `/api/leaderboard`.
   - Chamadas repetidas ao final da mesma partida não duplicam registros nem vitórias.
   - Fórmula de `% de vitórias` validada com múltiplos usuários em diferentes quantidades de partidas (ex.: `2/4 = 50.0%`, `0/0 = 0.0%`).
2. **Testes Frontend (`npx tsc --noEmit`, `npx vitest run`, `npm run build`):**
   - Todos os testes existentes continuam passando + novos testes unitários para cálculo/renderização de Ranking, Histórico e separação Entrar vs Criar Conta.
