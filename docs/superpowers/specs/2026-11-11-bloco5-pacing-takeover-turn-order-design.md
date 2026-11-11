# Rule the Isle — Especificação de Design (Bloco 5)
## Ritmo de Tabuleiro com Animação de Dados, Substituição por Bot em Abandono/Queda e Ordem Aleatória Garantida

**Data:** 2026-11-11  
**Branch alvo:** `layout-topbar`  
**Escopo deste documento:** Bloco 5 do **Rule the Isle** — desaceleração tática das jogadas de IA para ritmo de tabuleiro clássico com animação 2D6 e destaque visual/sonoro em desktop e mobile, detecção serverless-safe de abandono ou queda de conexão no multiplayer com tomada automática de assento por bot e opção de retomada ao reconectar, e garantia estatística de ordem de turnos aleatória tanto no servidor Python quanto no motor local offline (`localEngine.ts`).

---

## 1. Diagnóstico do Estado Atual

1. **Velocidade Excessiva & Baixa Visibilidade (`GameScreen.tsx`, `GameScreen.scss`, `ActionsToolbar.tsx`):**
   - `ROBOT_THINKING_TIME = 300` ms faz turnos inteiros com múltiplos bots terminarem em fração de segundo.
   - O componente `dice-widget-pill` exibe faces 2D6 estáticas, sem transição ou rolagem animada quando alguém joga os dados.
   - Em [`GameScreen.scss`](../../ui/src/pages/GameScreen.scss#L11-L15), `@media (min-width: 600px) { #root .snackbar-container { display: none; } }` oculta completamente os avisos flutuantes de ação no desktop, deixando apenas o banner estreito no topo piscar por ~300 ms.
   - Em salas multiplayer, [`GameScreen.tsx`](../../ui/src/pages/GameScreen.tsx) chama `postAction(gameId)` sem parâmetro `?bot_only=1` nem eleição de coordenador, podendo gerar avanço simultâneo de bots quando dois humanos assistem juntos.

2. **Ausência de Substituição por Bot em Queda/Abandono (`models.py`, `api.py`, `localEngine.ts`):**
   - Partidas multiplayer travam indefinidamente se um participante fechar a aba, perder internet ou voltar ao lobby (`← Lobby`), pois seu assento permanece marcado como `HumanPlayer` (`is_bot = False`).
   - Como o backend precisa rodar de forma stateless tanto em Flask local quanto em Vercel Serverless (`api/index.py`), não é possível depender de threads ou daemons em segundo plano.

3. **Impressão de Sempre Iniciar Primeiro (`localEngine.ts`):**
   - Em [`catanatron/state.py`](../../catanatron/catanatron/state.py#L100), o motor Python embaralha `self.players = self.random.sample(players, len(players))`.
   - Porém, em [`localEngine.ts`](../../ui/src/utils/localEngine.ts#L1584), `localCreateGame` nunca embaralhava `colors` (`SEAT_COLORS.slice(...)`), mantendo sempre `RED` = `"HUMAN"` na posição 0 (`current_color = colors[0]`) sempre que o cliente operava em modo local/fallback (ou sem servidor Python ativo).

---

## 2. Arquitetura Acordada (Abordagem A)

**Fila Visual Orientada a Eventos no Cliente + Controle Serverless de Presença/Heartbeat no Backend:**
- O motor (Python/Flask e `localEngine.ts`) continua executando exatamente **1 ação por chamada** `POST /actions` sem `time.sleep` bloqueante.
- O frontend mantém uma **fila de apresentação cronometrada** que reproduz cada transição (`state_index`), anima os dados 2D6, destaca peças construídas no tabuleiro, exibe toast/feed tanto no desktop quanto no mobile e controla a velocidade pelo seletor do HUD.
- A tomada de assento no multiplayer utiliza **heartbeat HTTP periódico + checagem preguiçosa** durante leituras/avanços de estado e endpoint dedicado para abandono imediato ou retomada segura.

---

## 3. Especificação Detalhada por Frente

### Frente 1 — Ritmo de Tabuleiro Clássico, Animação 2D6 e Visibilidade de Ações

1. **Seletor de Velocidade no HUD Superior (`.game-top-hud`):**
   - Botão toggle no HUD direito (e disponível no mobile):
     - **`Normal (1x)`** (padrão — *Ritmo de Tabuleiro Clássico*)
     - **`Rápido (0.5x)`** (multiplica todos os intervalos por `0.5`)
   - Preferência salva em `localStorage` (`catan_game_speed_v1` = `"normal" | "fast"`).

2. **Tabela de Tempos Base (`Normal 1x`):**
   - `ROLL`: **1800 ms**
     - Primeiros **550 ms**: animação de rolagem dos dois dados 2D6 (tremor, rotação e ciclagem de faces) acompanhada de `playDiceSound()`.
     - Restantes **1250 ms**: exibição nítida do resultado `[d1, d2]` e soma, mantendo hexágonos produtores destacados no tabuleiro.
   - `BUILD_SETTLEMENT`, `BUILD_CITY`, `BUILD_ROAD`, `BUY_DEVELOPMENT_CARD`, `PLAY_*`, `MOVE_ROBBER`, `MARITIME_TRADE`: **1200 ms**.
   - `OFFER_TRADE`, `ACCEPT_TRADE`, `REJECT_TRADE`, `CONFIRM_TRADE`, `CANCEL_TRADE`: **950 ms** (se a transição exigir resposta imediata do humano local em `DECIDE_TRADE`/`DECIDE_ACCEPTEES`, o diálogo abre logo após breve transição).
   - `END_TURN`: **650 ms**.
   - `DISCARD_RESOURCE` em sequência de bots: **400 ms** por carta descartada (para não travar mesas com 7+ cartas no descarte 1 a 1).

3. **Animação de Rolagem de Dados (`DiceRollOverlay` + `dice-widget-pill`):**
   - Sempre que chegar uma transição cuja última ação seja `ROLL`:
     - O widget de dados no console inferior entra em estado animado (`.is-rolling`), alternando faces provisórias antes de cravar o valor real.
     - Um selo compacto flutuante no palco do tabuleiro (`.tabletop-dice-stage`) aparece durante a rolagem de qualquer jogador (humano ou bot) exibindo **quem rolou**, os **dois dados 2D6 animados** e o **total sorteado**, desaparecendo suavemente ao fim do intervalo sem bloquear cliques no tabuleiro após assentamento.

4. **Destaque Visual no Tabuleiro e Toast Visível em Todas as Telas:**
   - **Feed / Toast Flutuante Unificado (`.action-spotlight-toast`):** posicionado abaixo da barra superior de jogadores, visível tanto em Desktop (`>= 600px`) quanto em Mobile (`< 600px`), exibindo ícone da ação, borda na cor do jogador, nome e descrição em `pt-BR` via `humanizeActionRecordPt`.
   - **Destaque de Construção Recente no Tabuleiro:** [`Board.tsx`](../../ui/src/pages/Board.tsx), [`Node.tsx`](../../ui/src/pages/Node.tsx) e [`Edge.tsx`](../../ui/src/pages/Edge.tsx) destacam por ~2,2s o último vértice (`node--recent`) ou estrada (`edge--recent`) construído no último `action_record`, permitindo identificar imediatamente onde o bot construiu.
   - **Destaque de Compra de Carta no Card:** quando o último evento for `BUY_DEVELOPMENT_CARD`, o card do jogador em [`PlayerTopBar.tsx`](../../ui/src/components/PlayerTopBar.tsx) recebe pulso discreto e o toast anuncia claramente a compra.

5. **Coordenação de Bots em Salas Multiplayer:**
   - Clientes enviam `POST /api/games/<id>/actions?bot_only=1` (e o backend já ignora no-op caso outro cliente tenha avançado antes).
   - Para evitar chamadas concorrentes entre vários navegadores numa mesma sala, apenas o **coordenador humano eleito** (o primeiro assento humano não-bot ativo na ordem de `colors`, preferindo o primeiro humano com sessão viva) dispara o `postAction(gameId, undefined, { botOnly: true })`; demais participantes recebem atualizações por polling (`700ms` quando há bots ou outro jogador ativo) e enfileiram na UI os novos `state_index` para reproduzir as mesmas animações localmente.
   - Ações humanas locais cancelam imediatamente espera residual e aplicam o novo estado sem atraso perceptível.

---

### Frente 2 — Substituição por Bot em Abandono ou Desconexão + Retomada

1. **Regra de Elegibilidade (Multiplayer vs Solo):**
   - A tomada automática por timeout de desconexão aplica-se exclusivamente a partidas **Multiplayer** (definidas como partidas vinculadas a uma sala `StoredRoom` ou criadas com `>= 2` assentos humanos iniciais).
   - Partidas **Solo** (`1` humano contra bots) nunca substituem o único humano por timeout ao recarregar ou trocar de aba.
   - Mesmo em partidas multiplayer, o servidor **nunca** converte por timeout passivo o *último* humano restante online (pelo menos 1 outro assento humano precisa continuar com heartbeat recente `< 45s`, evitando transformar toda a sala em bot vs bot caso ambos desconectem brevemente).

2. **Modelo de Presença & Metadados no Servidor (`StoredGame.seat_metadata_json` + `player_specs`):**
   - Sem necessidade de alterar colunas de tabela SQL existentes: cada entrada por cor em `StoredGame.seat_metadata_json` armazena:
     - Campos públicos: `color`, `seat_kind` (`"USER" | "GUEST" | "BOT"`), `username`, `player_key`, `display_name`, `avatar_config`.
     - Campos estendidos de sessão/presença (filtrados antes de ir ao cliente quando sensíveis):
       - `seat_token`: token secreto da sala copiado ao iniciar (`start_room_endpoint`).
       - `original_player_key`: spec inicial antes de eventual tomada (`"HUMAN"`).
       - `original_seat_kind`, `original_username`, `original_display_name`, `original_avatar_config`.
       - `last_seen_at`: epoch Unix (segundos) inicializado com `created_at` no início do jogo e atualizado por `/heartbeat` e por `POST /actions` do próprio jogador.
       - `taken_over_by_bot`: `bool` (`false` por padrão).
       - `takeover_reason`: `"ABANDONED" | "DISCONNECTED" | null`.
   - Ao promover um assento humano para bot (`BOT_SPEC = "CATANATRON"`):
     - Localiza o índice da cor em `document["colors"]` (`head_state` e `base_state`) e atualiza `StoredGame.player_specs[idx]` de `"HUMAN"` para `"CATANATRON"`.
     - Atualiza `seat_metadata_json[color]`: `taken_over_by_bot = True`, `player_key = "CATANATRON"`, `seat_kind = "BOT"`, `display_name = "<original_display_name> (Bot)"`.
     - Assim `get_game_state()` passa a instanciar `Catanatron` (`AlphaBeta`) para aquela cor, `web_view()` inclui essa cor em `bot_colors`, e os bots jogam normalmente sua vez (inclusive fase inicial, descarte, ladrão e respostas de troca).
   - Ao retomar o assento (`reclaim`):
     - Restaura `StoredGame.player_specs[idx] = "HUMAN"`, `taken_over_by_bot = False`, `takeover_reason = None`, `seat_kind = original_seat_kind`, `username = original_username`, `display_name = original_display_name`, `avatar_config = original_avatar_config`, e atualiza `last_seen_at = now`.

3. **Novos Endpoints da API (`catanatron/web/api.py` + `models.py`):**
   - `POST /api/games/<game_id>/heartbeat`:
     - Identifica o assento do chamador via `color`/`seat` + autorização (`seat_token` correspondente ou usuário autenticado cujo `username` coincida com `original_username`).
     - Atualiza `last_seen_at = now` se o assento ainda estiver humano (não tomado por bot).
     - Executa a checagem preguiçosa de timeout (`TAKEOVER_TIMEOUT_SECONDS = 45`) nos demais assentos humanos elegíveis.
     - Retorna `{ "ok": true, "bot_colors": [...], "taken_over_colors": [...], "my_seat_taken_over": bool }`.
   - `POST /api/games/<game_id>/abandon`:
     - Valida posse do assento (token ou sessão autenticada) em partida em andamento (`winning_color is None`).
     - Promove imediatamente o assento para `"CATANATRON"` (`takeover_reason = "ABANDONED"`), mantendo o `state_index` inalterado e atualizando `bot_colors` para que o coordenador ativo da mesa execute o turno do bot substituto na cadência visual padrão (`?bot_only=1`).
     - Retorna a `web_view` enriquecida atualizada.
   - `POST /api/games/<game_id>/reclaim`:
     - Valida posse do assento (`seat_token` ou `username` autenticado igual a `original_username`) para assento com `taken_over_by_bot == True`.
     - Restaura `StoredGame.player_specs` para `"HUMAN"` (preservando cartas, pontos, construções e ordem na mesa), ajusta `last_seen_at = now` e retorna `{ ...web_view, reclaimed_color }` para o cliente reaplicar a perspectiva correta imediatamente.
   - **Checagem Preguiçosa Centralizada (`maybe_promote_disconnected_seats(game_id)`):**
     - Invocada com segurança em `GET /api/games/<id>/states/latest`, `POST /api/games/<id>/actions` (antes de verificar `current_player().is_bot`) e `POST /api/games/<id>/heartbeat`.
     - Só promove assento `c` quando:
       1. A partida não terminou e possui `>= 2` assentos originalmente humanos (`original_player_key == "HUMAN"`).
       2. `now - last_seen_at(c) >= 45`.
       3. Existe pelo menos outro assento humano ativo com `not taken_over_by_bot` e `now - last_seen_at(other) < 45` (ou seja, há pelo menos um humano vivo acompanhando a partida).

4. **Consistência em Ranking & Histórico (`record_completed_match`):**
   - Se a partida terminar com um assento **ainda sob controle do bot** (`taken_over_by_bot == True`), `StoredMatchParticipant` grava `seat_kind = "BOT"`, `username = None`, `player_key = "CATANATRON"`, garantindo que ninguém ganhe pontos/vitórias no ranking sem ter jogado a partida até o fim (e exibindo `<Nome> (Bot)` no histórico).
   - Se o jogador **retomou seu assento antes do fim da partida** (`taken_over_by_bot == False`), seu histórico e estatísticas no ranking contabilizam normalmente.

5. **Experiência no Frontend (`GameScreen.tsx`, `RoomLobbyPage.tsx`, `localEngine.ts`):**
   - `RoomLobbyPage.tsx` e `GameScreen.tsx` passam a preservar o `seat_token` da sala (`catan_room_token_<ROOM_CODE>`) nas chamadas de `/heartbeat`, `/abandon` e `/reclaim`.
   - Envio automático de heartbeat a cada `10s` em partidas multiplayer enquanto o jogador está com a tela ativa e não abandonou.
   - Novo botão no HUD superior em partidas em andamento multiplayer: **`🚪 Sair (Bot Assume)`** com diálogo rápido de confirmação chamando `abandonGame()` e navegando para `/`; o link **`← Lobby`** continua apenas navegando de volta (sem forçar abandono imediato caso o jogador retorne em < 45s).
   - Caso o assento do visitante/usuário reconectado esteja com `seat_takeover[mySeat]?.taken_over === true` (detectado via `?seat`, `getSavedGameSeat`, ou `original_username === account.username`), exibe banner destacado no topo do console/HUD com botão **`↩️ Retomar Meu Assento`**, chamando `reclaimGame()`.
   - **`localEngine.ts`**: implementa `localGameHeartbeat`, `localAbandonGame` e `localReclaimGame` com a mesma estrutura de retorno para manter 100% de compatibilidade quando offline ou em testes unitários frontend.
   - Enriquecimento seguro em `_enrich_view_with_seats`: expõe `taken_over_colors: string[]` e `seat_takeover: Record<Color, { taken_over: boolean; reason: string | null; original_username?: string | null }>` (sem jamais expor `seat_token`).

---

### Frente 3 — Ordem Aleatória Garantida em Todas as Partidas

1. **Correção da Causa Raiz em `localEngine.ts` (`localCreateGame`):**
   - Antes de criar `state`, montar a lista pareada `seatPairs = colorsOrdered.map((color, idx) => ({ color, playerKey: options.players[idx] }))`, resolver `seatMeta` indexado por `pair.color` (mantendo a cor de cada participante conforme configurada no setup/sala) e então executar **embaralhamento Fisher-Yates** sobre `seatPairs` usando `crypto.getRandomValues` (com fallback para `Math.random`).
   - Derivar `colors = seatPairs.map(p => p.color)`, `botColors`, `initialQueue` e `current_color = colors[0]` já a partir da ordem embaralhada.

2. **Paridade & Segurança de Entropia no Backend (`catanatron`):**
   - Validar que `State.__init__` continua sorteando `self.players = self.random.sample(players, len(players))` com semente independente por partida (`secrets.randbits(64)` em `api.py` ao criar jogos pela web caso `seed` não seja passado explicitamente, preservando determinismo quando `seed` é passado em testes unitários).
   - Garantir que `build_seat_metadata_for_game` e `start_room_endpoint` preservam `seatMeta` indexado por `color` sem assumir que `colors[0] == "RED"`, e que `record_completed_match` continua mapeando cada cor corretamente após o sorteio.

3. **Apresentação na Interface (`PlayerTopBar.tsx` + Anúncio Inicial):**
   - [`PlayerTopBar.tsx`](../../ui/src/components/PlayerTopBar.tsx) renderiza os cartões na ordem de `gameState.colors` (ordem de turnos sorteada na mesa), **sem exibir badges ou números de posição (`1º`, `2º`, `3º`, `4º`) nos cards** conforme acordado.
   - No início da partida (`state_index === 0`), o banner superior e um toast inicial anunciam claramente quem abriu o jogo após o sorteio (ex.: *"🎲 Ordem sorteada: Felire inicia a partida!"* ou *"🎲 Ordem sorteada: Você inicia a partida!"*).

---

## 4. Critérios de Aceite e Plano de Verificação

1. **Testes Backend (`pytest -o addopts=""`):**
   - `tests/test_game.py` & `tests/web/test_api.py` & `tests/web/test_rooms.py`:
     - Teste estatístico de aleatoriedade na criação de jogos via `/api/games` e `/api/rooms/<code >/start`: distribuindo quem inicia entre todas as posições (`RED` não fica preso em índice 0).
     - Teste de ciclo completo `/heartbeat`, timeout automático após 45s (simulando avanço de relógio/monkeypatch de `time.time`), proteção contra conversão em solo ou quando só resta 1 humano vivo, `/abandon` imediato e `/reclaim` restaurando mão e jogabilidade.
     - Teste de contabilização no ranking/histórico quando assento termina tomado por bot (`BOT`) vs retomado antes do fim (`USER`).
     - Verificação estrita de paridade zero-diff entre `catanatron/catanatron` e `api/catanatron`.

2. **Testes Frontend (`npx tsc --noEmit`, `npx vitest run`, `npm run build`):**
   - `localEngine.test`: verificar que `localCreateGame` embaralha `colors`, mantém `seatMeta`/`bot_colors`/`initialQueue` consistentes e que `localAbandonGame`/`localReclaimGame` alternam `bot_colors` sem perder peças ou cartas.
   - Testes de componentes UI para seletor de velocidade (`1x`/`0.5x`), animação/estágio de dados 2D6, exibição do toast de jogadas em desktop/mobile, botão de abandonar e banner de retomada no multiplayer, e ausência de badges de posição numérica no `PlayerTopBar`.
