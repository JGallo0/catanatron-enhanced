# Rule the Isle — Especificação de Design (Bloco 2)
## Criador Modular de Avatar, Perfil do Jogador e Recompensas por Vitórias

**Data:** 2026-11-11  
**Branch alvo:** `layout-topbar`  
**Escopo deste documento:** Bloco 2 de 3 da reformulação do **Rule the Isle** — construção do sistema completo de Avatar SVG modular + presets, desbloqueio de molduras/coroas por mérito no Ranking, Studio de Perfil em modal e exibição universal do avatar personalizado em todas as telas do jogo.

---

## 1. Objetivos e Regras Acordadas

1. **Criação Híbrida (Modular SVG + Presets + Aleatório):**
   - O jogador cria seu avatar combinando camadas vetoriais nítidas (pele, expressão/olhos, cabelo, cor de cabelo, barba, chapéu/acessório, traje, cor do traje, fundo e moldura) **e/ou** parte rapidamente de 6 arquétipos prontos (*Modelos da Ilha*) ou de um sorteio aleatório (`🎲 Aleatório`).
2. **Base Livre + Progressão por Mérito no Ranking:**
   - Todos os traços de personagem, roupas, fundos e acessórios iniciais vêm liberados desde a criação da conta (`0` vitórias).
   - **Molduras e itens de prestígio** são desbloqueados conforme o total de vitórias registradas do usuário no Ranking Global (Tabela `matches` / `localGetLeaderboard`):
     - `0 vitórias` (padrão): **Moldura Madeira de Colono** (`wood`)
     - `1 vitória`: **Moldura Bronze de Navegador** (`bronze`)
     - `3 vitórias`: **Moldura Prata da Guilda** (`silver`)
     - `5 vitórias`: **Moldura Ouro Real** (`gold`)
     - `7 vitórias`: **Coroa Dourada do Soberano** (`hat: "crown_gold"`)
     - `10 vitórias`: **Moldura Imperial da Ilha** (`imperial` — borda esmeralda & ouro com brilho sutil)
   - A validação de desbloqueios ocorre **tanto no servidor** (`PATCH /api/auth/profile` retorna `403` caso o usuário tente equipar item bloqueado) **quanto no fallback offline** (`localEngine.ts`).
3. **Exibição Universal em Todo o App (Estilo Catan Universe):**
   - **Home (`HomePage`)** e futuro Lobby (Bloco 3): avatar clicável no card da conta logada + botão `🎨 Personalizar Avatar`.
   - **Sala de Espera Multiplayer (`RoomLobbyPage`)**: exibe o avatar personalizado nos assentos ocupados por usuários cadastrados e permite editar o próprio perfil/avatar sem sair da sala.
   - **Ranking Global (`LeaderboardModal`)**: mini avatar com moldura ao lado de cada usuário na classificação.
   - **Partida em Andamento (`PlayerTopBar`)**: quando o assento pertence a um usuário cadastrado (`seat_kind === "USER"`), exibe o avatar customizado dentro do card na cor do jogador; **Bots e Convidados sem conta** continuam exibindo os retratos clássicos da ilha (`/assets/illustrations/avatars/{red,blue,orange,white}.webp`).

---

## 2. Esquema de Dados (`AvatarConfig`) e Catálogo

### 2.1 Estrutura JSON salva em `users.avatar_json`
```ts
export type AvatarConfig = {
  skin: "porcelain" | "fair" | "warm" | "tan" | "brown" | "deep";
  eyes: "calm" | "cheerful" | "sharp" | "wise";
  hair: "none" | "short" | "wavy" | "bun" | "braids" | "curly" | "long";
  hairColor: "brown" | "black" | "blonde" | "red" | "silver" | "navy";
  beard: "none" | "goatee" | "full" | "mustache";
  hat: "none" | "captain" | "explorer" | "bandana" | "helm" | "crown_gold";
  outfit: "settler" | "captain" | "armor" | "merchant";
  outfitColor: "crimson" | "royal" | "emerald" | "amber" | "slate";
  background: "ocean" | "sunset" | "forest" | "mountain" | "gold" | "crimson";
  frame: "wood" | "bronze" | "silver" | "gold" | "imperial";
};
```

### 2.2 Fallback Determinístico (`resolveAvatarConfig`)
- Contas antigas ou criadas via Google cujo `avatar_json` ainda seja `"{}"` não quebram nem ficam sem rosto: `resolveAvatarConfig(rawConfig, username)` calcula um índice determinístico a partir do `username` sobre as opções iniciais desbloqueadas (`0` vitórias) e mescla quaisquer chaves válidas já configuradas.

### 2.3 Modelos Prontos ("Arquétipos da Ilha")
Todos os 6 presets utilizam exclusivamente itens de `0` vitórias:
1. **Capitão dos Mares** (`captain` hat, casaco `captain`, barba cheia, fundo `ocean`)
2. **Exploradora do Norte** (`braids`, `explorer` chapéu, túnica `emerald`, fundo `forest`)
3. **Cavaleiro da Colina** (`helm`, `armor` `slate`, expressão `sharp`, fundo `mountain`)
4. **Mercador de Trigo** (`wavy`, `merchant` `amber`, bigode, fundo `gold`)
5. **Artífice das Montanhas** (`short`, `wise` expressão, `goatee`, `settler` `crimson`)
6. **Navegadora do Sol** (`bun`, `bandana`, `settler` `royal`, fundo `sunset`)

---

## 3. Arquitetura Backend (`catanatron/catanatron/web/`)

Nenhuma nova tabela nem migração destrutiva de banco é necessária — toda a estrutura (`users.avatar_json` e `games.seat_metadata_json`) já foi criada no Bloco 1.

### 3.1 Regras de Desbloqueio e Validação (`models.py`)
- Constantes explícitas:
  - `AVATAR_VALID_VALUES`: dicionário de chaves/valores permitidos por campo de `AvatarConfig`. Valores desconhecidos são descartados de forma segura (sanitização) e strings inesperadas ignoradas.
  - `AVATAR_UNLOCK_REQUIREMENTS`:
    ```python
    AVATAR_UNLOCK_REQUIREMENTS = {
        "frame": {"bronze": 1, "silver": 3, "gold": 5, "imperial": 10},
        "hat": {"crown_gold": 7},
    }
    ```
- Em `update_user_profile(user, display_name=..., avatar_config=...)`:
  1. Se `avatar_config` for enviado, valida o tipo (`dict`) e sanitiza para aceitar apenas chaves pertencentes a `AVATAR_VALID_VALUES`.
  2. Verifica `wins = get_user_stats(user.username)["wins"]`.
  3. Para cada `(field, rules)` em `AVATAR_UNLOCK_REQUIREMENTS`, se `sanitized.get(field)` estiver em `rules` e `wins < rules[val]`, chama `abort(403, description=f"Este item requer {required} vitória(s) no Ranking para ser desbloqueado (você tem {wins}).")`.
  4. Persiste `user.avatar_json = json.dumps(sanitized)`.

### 3.2 Propagação Zero N+1 em Salas e Partidas (`models.py` & `api.py`)
- **Batch Helper `_load_avatars_by_username(usernames)`:** Busca em uma única query `db.session.query(StoredUser).filter(StoredUser.username.in_(...))` e retorna `{ username: parsed_avatar_dict }`.
- **`serialize_room(room, caller_token)`:** Para cada assento em `seats_json`, inclui:
  - `seat_kind`: `"BOT" | "USER" | "GUEST"`
  - `username`: `seat.get("username")` (ou `None`)
  - `avatar_config`: `avatars.get(username, {})` se `seat_kind == "USER"`, senão `{}`.
- **`_enrich_view_with_seats(game, view)` (substituindo `_enrich_view_with_room` em `api.py`):**
  - Lê `StoredGame.seat_metadata_json` (disponível tanto em jogos Solo quanto em Salas Multiplayer) e `StoredRoom` (se houver `room_code`).
  - Preenche:
    - `view["room_code"]` (quando aplicável)
    - `view["seat_names"]`: `{ COLOR: display_name }`
    - `view["seat_avatars"]`: `{ COLOR: { "seat_kind": ..., "username": ..., "avatar_config": ... } }`
  - Acionado em `GET /api/games/<id>/states/<idx>` e `POST /api/games/<id>/actions` (inclusive na ação de vitória).

---

## 4. Arquitetura Frontend (`ui/src/`)

### 4.1 Tipos e API Client (`api.types.ts`, `apiClient.ts`, `localEngine.ts`)
- **`api.types.ts`:**
  - Define `AvatarConfig`, `SeatAvatarMeta` (`{ seat_kind, username, avatar_config }`).
  - Atualiza `RoomSeat` para incluir `seat_kind?: "USER" | "GUEST" | "BOT"`, `username?: string | null`, `avatar_config?: Partial<AvatarConfig> | null`.
  - Atualiza `GameState` para incluir `seat_avatars?: Partial<Record<Color, SeatAvatarMeta>>`.
- **`apiClient.ts`:**
  - `PlayerAccount.avatar_config?: Partial<AvatarConfig>`.
  - `updateProfile({ displayName, avatarConfig })`: propaga erros `4xx` (como `403` de item bloqueado) em vez de cair silenciosamente no offline; faz fallback para `localUpdateProfile` apenas quando o backend estiver inacessível (`network/5xx`).
- **`localEngine.ts`:**
  - `LocalUserRecord` armazena `avatar_config?: AvatarConfig`.
  - Exporta `localUpdateProfile({ username, displayName, avatarConfig })`, validando as mesmas regras de desbloqueio contra `localGetLeaderboard()` e atualizando `catan_player_account`.
  - `localCreateGame`, `localGetState`, `localGetRoom`, `localStartRoomGame` e `localGetLeaderboard` preenchem e propagam `avatar_config` e `seat_avatars`.

### 4.2 Catálogo e Renderizador SVG (`avatarCatalog.ts`, `PlayerAvatar.tsx`, `PlayerAvatar.scss`)
- **`ui/src/config/avatarCatalog.ts`:**
  - Fonte única de verdade no frontend para: paleta de peles, olhos/expressões, estilos/cores de cabelo, barbas, chapéus/acessórios, trajes/paletas, fundos, molduras, 6 presets e regras de `requiredWins`.
  - Funções puras testáveis:
    - `resolveAvatarConfig(raw?, username?)`
    - `getAvatarItemRequirement(field, value)` -> `number` (`0` se livre)
    - `isAvatarItemUnlocked(field, value, wins)` -> `boolean`
    - `randomizeUnlockedAvatar(wins)` -> `AvatarConfig`
- **`ui/src/components/PlayerAvatar.tsx` & `PlayerAvatar.scss`:**
  - Renderizador SVG puro com camadas ordenadas: `background` -> `outfit` -> `neck/head(skin)` -> `eyes` -> `beard` -> `hair` -> `hat` -> `frame` (borda estilizada por CSS/SVG, com gradiente e brilho suave na moldura `imperial`).
  - Props: `config?: Partial<AvatarConfig> | null`, `username?: string | null`, `size?: number` (default `48`), `className?: string`, `showFrameLabel?: boolean`.

### 4.3 Modal Studio de Perfil & Avatar (`AvatarStudioModal.tsx` & `AvatarStudioModal.scss`)
- Modal Dark Slate + Gold em 2 colunas:
  - **Esquerda:** `<PlayerAvatar size={120} showFrameLabel />`, resumo de vitórias (`🏆 X Vitórias • Y%`), input editável `Apelido na Mesa`, botão `🎲 Aleatório` e grid dos 6 `Modelos Prontos`.
  - **Direita:** 5 abas (**Rosto**, **Cabelo & Barba**, **Acessórios**, **Traje & Fundo**, **🏆 Molduras**). Cada opção mostra preview visual ou swatch; itens com `requiredWins > userWins` mostram 🔒 + `"Faltam X vitórias"` (ou `"1 vitória"`) e não podem ser selecionados/salvos.
  - Rodapé com `Cancelar` e `💾 Salvar Perfil`.

### 4.4 Integração nas Telas
1. **`HomePage.tsx` / `HomePage.scss`:** Na barra `.account-bar__logged`, exibe `<PlayerAvatar config={account.avatar_config} username={account.username} size={52} />` (clicável para abrir o editor) e botão `🎨 Personalizar Avatar`. Ao salvar no modal, sincroniza `account` e `hostName` imediatamente.
2. **`RoomLobbyPage.tsx` / `RoomLobbyPage.scss`:**
   - Para assentos com `seat.seat_kind === "USER"`, renderiza `<PlayerAvatar config={seat.avatar_config} username={seat.username || seat.player_name} size={42} />`; para Bots e convidados, mantém o retrato clássico da cor.
   - Se o usuário estiver logado na sala, exibe um botão discreto `🎨 Editar Meu Avatar` no topo/cabeçalho da sala para personalizar sem sair do lobby.
3. **`LeaderboardModal.tsx` / `LeaderboardModal.scss`:**
   - Na tabela de classificação, exibe `<PlayerAvatar config={row.avatar_config} username={row.username} size={34} />` antes do nome de cada jogador.
4. **`PlayerTopBar.tsx` / `PlayerTopBar.scss`:**
   - Lê `const seatAvatar = gameState.seat_avatars?.[color];`.
   - Se `seatAvatar?.seat_kind === "USER"`, renderiza `<PlayerAvatar config={seatAvatar.avatar_config} username={seatAvatar.username || name} size={54} />` no lugar do retrato `.webp`; caso contrário, mantém `HybridIllustration` com `/assets/illustrations/avatars/${color.toLowerCase()}.webp`.

---

## 5. Plano de Verificação e Testes

1. **Testes Python (`tests/web/test_auth_and_ranking.py`):**
   - Tentar equipar `frame: "silver"` com `0` vitórias retorna HTTP `403`.
   - Após registrar `3` vitórias no banco para o usuário, equipar `frame: "silver"` via `PATCH /api/auth/profile` retorna HTTP `200` e persiste `avatar_config`.
   - Criar jogo (`POST /api/games`) ou sala (`POST /api/rooms`) com usuário autenticado propaga `seat_avatars[color].seat_kind == "USER"` e `avatar_config` na resposta do jogo e da sala.
2. **Testes Frontend (`Vitest` + Testing Library):**
   - `avatarCatalog.test.ts`: testa fallback determinístico, metas de desbloqueio e `randomizeUnlockedAvatar` nunca escolhendo item travado.
   - `AvatarStudioModal.test.tsx`: verifica troca de abas, exibição de cadeado em moldura bloqueada, aplicação de preset e envio ao clicar em **Salvar Perfil**.
   - `PlayerTopBar` / `GameScreen.test.tsx` e `LeaderboardModal.test.tsx`: garantem exibição do avatar SVG customizado para usuários registrados mantendo retratos padrão para Bots.
3. **Regressão Completa:**
   - Todos os testes Python existentes (`pytest -o addopts="" tests/web`), `npx tsc --noEmit`, `npx vitest run` e `npm run build` verdes.
