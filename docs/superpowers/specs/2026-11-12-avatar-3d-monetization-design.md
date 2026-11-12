# Rule the Isle — Especificação de Design (Avatar 3D V2)
## Motor 3D Modular (WebGL .glb), Recolor Dinâmico, Emblema Snapshot e Arquitetura VIP/Monetização

**Data:** 2026-11-12  
**Branch alvo:** `layout-topbar`  
**Escopo:** Evolução completa do sistema de avatares para **Corpo Inteiro 3D Interativo** (Home, Lobby da Sala e Estúdio 3D) mantendo **Emblema 2D de alta definição com zero WebGL em partida**, sistema de **recolor universal por canal de material**, provador **Try-On livre** e estrutura **server-authoritative** no Neon Postgres preparada para conquistas e futura loja VIP.

---

## 1. Princípios de Arquitetura e Performance

1. **Dual-Render (3D Heroico fora da partida × Emblema 2D leve na partida):**
   - **Corpo Inteiro 3D (`Avatar3DCanvas` via `React.lazy`):** carregado sob demanda apenas na **Home (`HomePage`)**, no **Estúdio 3D (`AvatarStudioModal`)** e nos **Cards Verticais do Lobby da Sala (`RoomLobbyPage`)**.
   - **Emblema 2D (`PlayerAvatar`):** ao salvar o perfil no Estúdio 3D, o cliente renderiza e anexa um retrato `256×256` em `.webp` (DataURL compactado `<= 48 KB`) do busto/rosto do personagem 3D. Todas as superfícies de alta densidade ou gameplay (`PlayerTopBar`, `LeaderboardModal`, `OpenLobbyModal`, `TradeModal`, `TradeOfferDecisionDialog`, `HomeIdentityPill`) exibem esse retrato 2D dentro da moldura animada escolhida — **zero contextos WebGL rodando sobre o tabuleiro**.
2. **Engine 3D Escolhida:**
   - Wrapper dedicado em **Vanilla `three` (`THREE.WebGLRenderer`, `GLTFLoader`, `DRACOLoader`, `OrbitControls`)** sob `ui/src/components/avatar3d/` carregado via `React.lazy`.
   - Motivo técnico: zero risco de conflito de `peerDependencies` com **React 19** (`react@^19.1.0`), menor sobrecarga de bundle que wrappers declarativos, descarte explícito de geometrias/texturas em unmount e controle direto de `canvas.toDataURL("image/webp", 0.86)` para o Snapshot do Emblema HUD.
3. **Graceful Degradation (jsdom / sem WebGL):**
   - `isWebGLSupported()` verifica capacidade WebGL antes de instanciar `WebGLRenderer`. Em ambientes sem GPU/WebGL (testes Vitest/jsdom ou dispositivos muito restritos), `Avatar3DCanvas` renderiza uma visualização estática segura usando o `portraitSnapshot` (ou o retrato SVG V2 aprimorado + card estilizado), sem lançar exceções.
4. **Impacto Zero na Vercel / Serverless:**
   - O backend Python/Flask em Vercel continua manipulando apenas JSONs compactos no Neon Postgres. Modelos `.glb` ficam como ativos estáticos versionados em `ui/public/assets/models/avatars/` com cache longo de CDN e carregamento estritamente sob demanda dos itens equipados.

---

## 2. Contrato de Modelos 3D Modulares (.glb) e Recolor Universal

### 2.1 Estrutura de Pastas de Assets 3D
```text
ui/public/assets/models/avatars/
  rigs/           # Manequim/esqueleto padrão RuleTheIsleRig.glb
  bodies/         # Corpos base (athletic, sturdy, slender)
  heads/          # Formatos de rosto, olhos, sobrancelhas, narizes e bocas
  hair/           # Cabelos 3D
  beards/         # Barbas e bigodes 3D
  hats/           # Chapéus, bandanas, elmos, coroas
  outfits/        # Túnicas, casacos, armaduras superiores
  legs/           # Calças e botas 3D
  capes/          # Capas, mantos e ombreiras
  props_hand/     # Luneta, espada, cetro, mapa, bússola, caneca
  props_back/     # Espada embainhada, escudo, mochila de explorador
  pets/           # Papagaio, falcão, coruja (ombro)
  mounts/         # Corcel, lobo das neves, cervo real, grifo
  pedestals/      # Bases hexagonais (madeira, pedra rúnica, mármore ouro, obsidiana)
```

### 2.2 Contrato de Bone Sockets (Âncoras de Encaixe)
Todo esqueleto base (`RuleTheIsleRig`) expõe âncoras padronizadas onde acessórios se conectam em runtime sem offsets customizados por peça:
- `socket_head`: rosto, cabelo, barba, chapéu/coroa
- `socket_torso`: peitoral/túnica/armadura
- `socket_legs`: calça e botas
- `socket_cape`: capa e ombreiras
- `socket_hand_r` / `socket_hand_l`: adereços empunhados
- `socket_back`: escudo, espada embainhada ou mochila
- `socket_shoulder_l`: pet de ombro (papagaio, falcão, coruja)
- `socket_mount`: montaria posicionada atrás/sob o personagem
- `socket_pedestal`: base sob os pés

### 2.3 Sistema de Recolor Universal em Runtime (`materialTint.ts`)
Um único arquivo `.glb` suporta seleção livre de cores no Estúdio sem duplicação de arquivos. Ao carregar qualquer modelo, `applyAvatarMaterials(root, colors)` percorre `Mesh`es e aplica `THREE.Color` aos materiais pelos seguintes nomes reservados (case-insensitive, com suporte a sufixos como `mat_primary.001`):
- `mat_skin` → `config.colors.skin` (pele)
- `mat_hair` → `config.colors.hair` (cabelo e barba)
- `mat_eyes` → `config.colors.eyes` (íris)
- `mat_primary` → `config.colors.outfitPrimary` (cor principal de roupa/capa/calça)
- `mat_secondary` → `config.colors.outfitSecondary` (cor secundária / detalhes de tecido)
- `mat_metal` → `config.colors.outfitTrim` (fivelas, ombreiras, coroas, metais)
- `mat_mount` → `config.colors.mount` (pelagem/armadura principal da montaria)

### 2.4 Iluminação *Rule the Isle* e Auras 3D
- **Key Light:** dourada quente (`#ffd27d`, intensidade `1.85`) simulando o pôr-do-sol de `lobby_hero.webp`.
- **Fill Light:** azul oceânica (`#38bdf8`, intensidade `0.65`) para contraste marítimo.
- **Rim Light:** âmbar traseira (`#f59e0b`, intensidade `1.2`) recortando o personagem contra fundos escuros.
- **Auras VIP (`aura`):** anel rúnico giratório e partículas leves no pedestal (ativadas apenas no Palco/Estúdio).

---

## 3. Esquema de Dados `AvatarConfig` V2 e Retrocompatibilidade

### 3.1 Estrutura JSON (`users.avatar_json` e `seat_avatars`)
Contas V1 antigas continuam válidas: `resolveAvatarConfig(raw, username)` migra campos V1 automaticamente para V2 preservando aparência equivalente e escolhas antigas.

```ts
export type AvatarColors = {
  skin: string;           // hex, ex: "#e4b287"
  hair: string;           // hex, ex: "#432316"
  eyes: string;           // hex, ex: "#0284c7"
  outfitPrimary: string;  // hex, ex: "#1d4ed8"
  outfitSecondary: string;// hex, ex: "#991b1b"
  outfitTrim: string;     // hex, ex: "#facc15"
  mount: string;          // hex, ex: "#e2e8f0"
};

export type AvatarConfigV2 = {
  version: 2;
  // Corpo & Rosto
  bodyType: "athletic" | "sturdy" | "slender";
  headShape: "oval" | "square" | "heart" | "chiseled";
  eyeStyle: "noble" | "fierce" | "wise" | "cheerful";
  browStyle: "arched" | "thick" | "calm" | "scarred";
  noseStyle: "straight" | "aquiline" | "broad" | "button";
  mouthStyle: "confident" | "smile" | "serious" | "smirk";
  hair: string;       // ID em AVATAR_CATALOG ("none" | "navigator" | "wavy" | "royal_bun" | ...)
  beard: string;      // ID em AVATAR_CATALOG ("none" | "captain_trimmed" | "full_viking" | ...)
  // Vestimenta & Cabeça
  outfit: string;     // tronco superior
  legsBoots: string;  // calça e botas
  cape: string;       // capa / ombreiras ("none" | "traveler" | "royal_mantle" | ...)
  hat: string;        // chapéu / elmo / coroa
  // Adereços, Pets, Montarias & Palco
  handProp: string;   // mão ("none" | "spyglass" | "rapier" | "scroll" | "scepter" | ...)
  backProp: string;   // costas ("none" | "sheathed_sword" | "kite_shield" | "explorer_pack")
  pet: string;        // ombro ("none" | "parrot" | "falcon" | "owl")
  mount: string;      // atrás ("none" | "island_horse" | "snow_wolf" | "royal_stag" | "imperial_griffin")
  pedestal: string;   // base ("stone_wood" | "runic_gold" | "obsidian_crown")
  aura: string;       // efeito ("none" | "sun_motes" | "sea_mist" | "imperial_flame")
  background: string; // cenário 2D/emblema
  frame: string;      // moldura especial do emblema/card
  // Cores dinâmicas livres (sem gerar novos .glb)
  colors: AvatarColors;
  // Snapshot 2D WebP do busto/rosto para renderização leve no tabuleiro/ranking
  portraitSnapshot?: string;
};
```

### 3.2 Segurança do `portraitSnapshot`
- O backend (`sanitize_avatar_config`) aceita `portraitSnapshot` apenas se começar com `data:image/webp;base64,` ou `data:image/png;base64,`, tiver tamanho `<= 65536` caracteres (~48 KB decodificado) e não contiver caracteres fora da alfabeto base64 válido. Qualquer valor inválido é descartado silenciosamente.
- Caso `portraitSnapshot` esteja ausente (bots, convidados ou contas antigas antes do primeiro salvamento V2), `PlayerAvatar` usa fallback seguro para renderizador SVG V2 estilizado do emblema.

---

## 4. Arquitetura de Monetização, Conquistas e Provador Livre (Try-On)

### 4.1 Metadados do Catálogo Unificado
Cada item cosmético em `ui/src/config/avatarCatalog.ts` e seu espelho em `catanatron/catanatron/web/avatar_catalog.py` (+ `api/catanatron/web/avatar_catalog.py`) possui:
- `slot`: chave de `AvatarConfigV2` (`"mount"`, `"hat"`, `"frame"`, etc.)
- `id`: identificador estável do item
- `tier`: `"free" | "earnable" | "vip"`
- `rarity`: `"common" | "rare" | "epic" | "legendary"`
- `requiredWins`: `int` (usado quando `tier == "earnable"`; `0` caso contrário)
- `sku`: `str | None` (identificador estável de produto para futura loja, ex. `"vip_mount_griffin"`)
- `priceBrlCents`: `int | None` (referência informativa para vitrine futura; cobrança não ativa neste ciclo)
- `modelPath`: caminho relativo do `.glb` sob `/assets/models/avatars/` (quando 3D)

### 4.2 Tabela `user_entitlements` (Neon Postgres / SQLite)
Nova tabela SQLAlchemy `StoredUserEntitlement` em `models.py` (e `api/catanatron/web/models.py`):
```python
class StoredUserEntitlement(Base):
    __tablename__ = "user_entitlements"
    __table_args__ = (
        UniqueConstraint("username", "item_key", name="uq_user_entitlement_item"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(32), ForeignKey("users.username"), index=True, nullable=False)
    item_key = Column(String(96), nullable=False)  # ex: "mount:imperial_griffin"
    source = Column(String(24), nullable=False, default="STORE")  # STORE | PROMO | ACHIEVEMENT | ADMIN
    transaction_ref = Column(String(128), nullable=True)
    granted_at = Column(Integer, nullable=False, default=lambda: int(time.time()))
```

### 4.3 Contratos de API e Segurança Server-Authoritative
1. `serialize_user(...)` (`GET /api/auth/me`, `/login`, `/register`, `/google`, `PATCH /api/auth/profile`) passa a incluir:
   - `entitlements`: lista ordenada de `item_key` possuídos pelo usuário em `user_entitlements`.
2. **`PATCH /api/auth/profile`:**
   - Sanitiza `avatar_config` com suporte completo a V2 (`version: 2`, `colors`, todos os slots e `portraitSnapshot` validado).
   - Recolhe todas as chaves selecionadas e verifica elegibilidade:
     - `free` → sempre permitido.
     - `earnable` → permitido se `wins >= item.required_wins` **ou** `f"{slot}:{id}"` presente em `user_entitlements`.
     - `vip` → permitido **somente** se `f"{slot}:{id}"` estiver presente em `user_entitlements`.
   - Se houver itens não liberados, aborta com **HTTP `403`** e JSON estruturado incluindo `description` legível e `locked_items` (`[{ "slot": ..., "id": ..., "tier": ..., "required_wins": ... }]`).
3. **Fallback Offline (`localEngine.ts`):**
   - `LocalUserRecord` armazena `entitlements?: string[]` e aplica exatamente as mesmas regras de desbloqueio V2 (`free` / `earnable` por vitórias / `vip` exigindo entitlement).

### 4.4 Experiência de Provador Livre (Try-On) no `AvatarStudioModal`
- **Testar qualquer item no 3D:** Clicar em um item `earnable` travado ou `vip` equipa-o imediatamente na prévia 3D do Estúdio (com selo discreto no palco: `"Modo Provador • Contém itens VIP / Bloqueados"`).
- **Colorir livremente:** Qualquer peça (mesmo no provador) reage ao vivo ao seletor de cores (`skin`, `hair`, `eyes`, `outfitPrimary`, `outfitSecondary`, `outfitTrim`, `mount`).
- **Salvar com transparência:**
  - Se todos os itens equipados estiverem liberados → gera o `portraitSnapshot` 2D pelo renderer 3D e salva normalmente via `PATCH /api/auth/profile`.
  - Se houver itens bloqueados equipados ao clicar em **Salvar Perfil** → abre um painel/diálogo de confirmação dentro do Estúdio listando os itens bloqueados (com razão: *"Requer X vitórias"* ou *"Exclusivo VIP • Em breve na Loja"*) e oferecendo:
    1. **Remover itens bloqueados e salvar** (substitui apenas os slots bloqueados pelo último valor salvo válido/padrão gratuito e salva o restante + cores).
    2. **Continuar experimentando** (mantém no provador 3D).

---

## 5. Integração nas Telas do *Rule the Isle*

1. **`HomePage.tsx`:**
   - `home-stage-window` passa a renderizar o **Personagem 3D de Corpo Inteiro (`Avatar3DViewport`)** centralizado sobre a ilha de `lobby_hero.webp`, com pedestal sutil, rotação por arraste, tooltip/botão discreto `"🎨 Personalizar no Estúdio 3D"` e botão rápido de alternar exibição caso queira admirar só o fundo.
   - `home-identity-pill` no topo esquerdo mantém o **Emblema HUD (`PlayerAvatar` 56px)** com a moldura e nome/ranking.
2. **`RoomLobbyPage.tsx`:**
   - Os 4 assentos da sala exibem uma fileira horizontal de **4 Cards Verticais Heroicos (`LobbySeatCard`)** em estilo azul-noite + borda dourada do *Rule the Isle* (análogo à composição de lobby do *Catan Universe*), mostrando o avatar de corpo inteiro (ou vaga aberta estilizada / retrato do bot) acima do seletor de assento e ações do anfitrião.
3. **`AvatarStudioModal.tsx`:**
   - Modal largo em 2 colunas:
     - **Esquerda:** Viewport 3D 360º interativo com toggle `Corpo Inteiro / Rosto`, painel compacto de **Cores Livres** (`Pele`, `Cabelo`, `Olhos`, `Roupa 1`, `Roupa 2`, `Metal/Detalhes`), botão `🎲 Aleatório`, presets rápidos (`Arquétipos da Ilha`) e input de apelido.
     - **Direita:** 7 abas modulares (`Corpo & Rosto`, `Cabelo & Barba`, `Vestimenta`, `Adereços`, `Montarias & Pets`, `Palco & Auras`, `🏆 Molduras`), filtro de visualização (`Todos` / `Desbloqueados` / `👑 VIP`), e barra de status do Provador Try-On.
4. **Telas de Partida e Listas (`PlayerTopBar`, `LeaderboardModal`, `OpenLobbyModal`, `TradeModal`, `TradeOfferDecisionDialog`, `MatchIntroOverlay`):**
   - Nenhuma alteração pesada: continuam usando `<PlayerAvatar />`, que passa a priorizar `portraitSnapshot` (quando presente) dentro da moldura especial CSS/SVG, ou fallback para o SVG V2 aprimorado.

---

## 6. Kit Inicial 3D e Pipeline de Expansão (`Google One + Gratuito`)

1. **Kit Base Embarcado no App:**
   - Script gerador/montador reproduzível em Node.js (`ui/scripts/build_starter_3d_assets.mjs` usando `three` puro, sem adicionar dependências Python na função Vercel) gera e empacota modelos `.glb` otimizados e testados localmente com os materiais nomeados (`mat_skin`, `mat_hair`, `mat_eyes`, `mat_primary`, `mat_secondary`, `mat_metal`, `mat_mount`) e bone sockets válidos para:
     - Corpos base e cabeças estilizadas com variações de rosto/expressão
     - Penteados e barbas modulares
     - Trajes superiores, capas, calças/botas
     - Chapéus/elmos/coroas, adereços na mão/costas, pet de ombro, montaria base e pedestais rúnicos
   - **Nota honesta de qualidade visual:** peças geométricas hard-surface (coroas, espadas, lunetas, pedestais rúnicos, molduras) têm acabamento PBR metálico/emissivo nítido diretamente em `.glb`; para personagens/rostos/montarias de nível escultura AAA, o motor usa exatamente o mesmo sistema plug-and-play de `.glb` para substituir/adicionar peças vindas de pacotes CC0 estilizados (ex.: *KayKit / Quaternius*) ou pipeline 2D→3D sem tocar em código.
2. **Guia de Criação para Expansão Contínua (`docs/AVATAR_3D_ASSET_GUIDE.md`):**
   - Documenta passo a passo o fluxo gratuito + Google One (**Gemini / Nano Banana Pro → Hunyuan3D / Tripo3D / Meshy → Blender Auto-Scale/Materials/Sockets → `ui/public/assets/models/avatars/` + registro no catálogo**).

---

## 7. Estratégia de Testes e Verificação

1. **Backend (`pytest -o addopts="" tests/web`):**
   - Migração automática criando `user_entitlements` em SQLite e PostgreSQL sem quebrar dados existentes.
   - `PATCH /api/auth/profile`: aceita `AvatarConfigV2` válido + `colors` hex + `portraitSnapshot` WebP válido; rejeita (`403`) item `earnable` sem vitórias e item `vip` sem entrada em `user_entitlements`; aceita item `vip` após registro em `user_entitlements`; descarta `portraitSnapshot` malicioso ou acima de 64 KB.
   - `GET /api/auth/me` e `/login` retornam `entitlements`.
   - Paridade obrigatória verificada entre `catanatron/catanatron/web/` e `api/catanatron/web/`.
2. **Frontend (`Vitest` + `tsc` + `vite build`):**
   - `avatarCatalog.test.ts`: retrocompatibilidade V1 → V2, validação de hex de cores, regras `free / earnable / vip`, listagem de `lockedItems`, filtro de salvamento seguro (`stripLockedAvatarItems`).
   - `materialTint.test.ts`: aplicação de cores nos materiais nomeados (`mat_skin`, `mat_primary`, etc.) em cena `THREE.Group`.
   - `AvatarStudioModal.test.tsx`: fluxo Try-On (clicar item VIP exibe prévia + aviso ao tentar salvar + ação *"Remover bloqueados e salvar"* preserva peças liberadas e cores), troca de 7 abas, seletor de cores livres, fallback limpo quando WebGL está indisponível no jsdom.
   - Regressão completa: `npx tsc --noEmit`, `npx vitest run`, `npm run build` e verificação visual real no navegador local (`localhost:3000`) com browser subagent.
