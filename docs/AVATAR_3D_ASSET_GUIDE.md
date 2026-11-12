# Guia de Criação de Assets 3D Modulares — *Rule the Isle* (Avatar V2)

Este guia documenta o padrão técnico oficial (escala, eixos, *bone sockets*, materiais recoloríveis e pastas) e o fluxo completo **100% gratuito + Google One** para criar, converter e integrar novas peças 3D (`.glb`) ao motor de avatares do **Rule the Isle**.

---

## 1. Estrutura de Pastas

Todos os modelos 3D estáticos são servidos pelo frontend Vite a partir de `ui/public/assets/models/avatars/`:

```text
ui/public/assets/models/avatars/
├── bodies/       # Corpos base (athletic, sturdy, slender)
├── heads/        # Cabeças com olhos, sobrancelhas, nariz e orelhas (oval, square, heart, chiseled)
├── hair/         # Penteados 3D (short, wavy, bun, braids, curly, long, navigator, royal_bun)
├── beards/       # Barbas e bigodes 3D (goatee, full, mustache, captain_trimmed, full_viking)
├── outfits/      # Trajes de tronco/ombros (settler, captain, armor, merchant, imperial_lord)
├── legs/         # Calças e botas (traveler, cuffed_boots, greaves, royal_greaves)
├── capes/        # Capas e mantos (traveler, navy_commander, royal_mantle)
├── hats/         # Chapéus, bandanas, elmos e coroas (captain, explorer, bandana, helm, crown_gold, admiral_bicorne)
├── props_hand/   # Adereços de mão direita (spyglass, scroll, royal_scepter, sun_rapier)
├── props_back/   # Adereços de costas (explorer_pack, sheathed_sword, imperial_shield)
├── pets/         # Mascotes de ombro esquerdo (owl, parrot, falcon)
├── mounts/       # Montarias atrás-direita (island_horse, snow_wolf, royal_stag, imperial_griffin)
└── pedestals/    # Bases hexagonais (stone_wood, runic_gold, obsidian_crown)
```

> **Kit inicial reproduzível:** você pode gerar ou restaurar todos os 55 `.glb` iniciais a qualquer momento executando dentro de `ui/`:
> ```bash
> npm run build:avatars3d
> npm run verify:avatars3d
> ```

---

## 2. Escala, Eixos e Tabela de Sockets (*Bone Sockets*)

### Sistema de Coordenadas Global
- **Unidade:** `1 unidade = 1 metro` (padrão glTF 2.0 / Three.js / Blender).
- **Eixo Vertical:** `+Y` para cima. O chão fica em `Y = 0.00`.
- **Frente do Personagem:** `+Z` (olhando para a câmera).
- **Lado Esquerdo / Direito:** `+X` é o lado esquerdo do personagem (direita de quem olha na tela); `-X` é o lado direito do personagem.
- **Altura Total do Avatar:** `~1.75 m` (dos pés em `Y = 0` até o topo da cabeça/cabelo em `~1.72–1.78 m`).

### Tabela de *Sockets* e Origem de Exportação

As peças são divididas entre **Espaço do Rig/Mundo** (exportadas já posicionadas no corpo em relação a `(0, 0, 0)` no chão) e **Espaço Local do Socket** (exportadas com o ponto de encaixe/pivô na origem `(0, 0, 0)` para serem acopladas dinamicamente pelo `sceneComposer.ts`):

| Socket / Categoria | Espaço de Origem | Coordenada no Rig `(X, Y, Z)` | Referência Anatômica e Regra de Encaixe |
|---|---|---|---|
| `socket_torso` (`bodies/`, `outfits/`) | Mundo / Rig | `(0, 0, 0)` | Pés em `Y = 0`; tronco/ombros entre `Y = 0.92..1.42`; pescoço termina em `Y = 1.48`. |
| `socket_legs` (`legs/`) | Mundo / Rig | `(0, 0, 0)` | Solas das botas apoiadas exatamente em `Y = 0.00`, cobrindo até a cintura em `Y = 0.95`. |
| `socket_cape` (`capes/`) | Mundo / Rig | `(0, 0, 0)` | Ombros em `Y = 1.41`, caída pelas costas ao longo de `Z = -0.16` até `Y = 0.35..0.52`. |
| `socket_mount` (`mounts/`) | Mundo / Rig | `(0.42, 0, -0.42)` | Patas/cascos em `Y = 0.00`, posicionada atrás à direita (`X = +0.42, Z = -0.42`) dentro do raio do pedestal (`0.85 m`). |
| `socket_pedestal` (`pedestals/`) | Mundo / Rig | `(0, 0, 0)` | Plinto hexagonal escalonado de `Y = -0.16` até `Y = 0.00` (topo exatamente em `Y = 0`), raio `~0.85 m`. |
| `socket_head` (`heads/`) | Local `(0, 0, 0)` | `(0, 1.46, 0)` | Base do pescoço em `(0, 0, 0)`; centro da cabeça em `(0, 0.12, 0)`; topo do crânio em `Y = 0.25`. |
| `socket_head` (`hair/`, `beards/`) | Local `(0, 0, 0)` | `(0, 1.46, 0)` | Modelados em torno da cabeça centrada em `(0, 0.12, 0)` sem invadir o rosto (`Z > 0.09`). |
| `socket_head` (`hats/`) | Local `(0, 0, 0)` | `(0, 1.46, 0)` | Apoiados no topo da cabeça ao redor de `(0, 0.22, 0)`. |
| `socket_hand_r` (`props_hand/`) | Local `(0, 0, 0)` | `(-0.36, 0.88, 0.12)` | Ponto da empunhadura (cabo/pegada) em `(0, 0, 0)`, estendendo-se para `+Y` / `+Z`. |
| `socket_back` (`props_back/`) | Local `(0, 0, 0)` | `(0, 1.15, -0.17)` | Centro de fixação na mochila/escudo/bainha em `(0, 0, 0)`, voltado para `-Z`. |
| `socket_shoulder_l` (`pets/`) | Local `(0, 0, 0)` | `(0.27, 1.41, 0.01)` | Garras apoiadas exatamente em `(0, 0, 0)`, corpo da ave voltado para `+Z`. |

---

## 3. Materiais Reservados (Recolor Universal em Runtime)

O motor `materialTint.ts` percorre os materiais de cada `.glb` e substitui em tempo real a cor conforme a paleta escolhida pelo jogador no Estúdio 3D. **Nunca crie variações de arquivo `.glb` apenas para mudar cor** — basta nomear os materiais do Blender/glTF com os prefixos reservados abaixo (*case-insensitive*; sufixos do Blender como `.001` são aceitos automaticamente):

| Nome Reservado | Canal em `AvatarColors` | Onde Usar |
|---|---|---|
| `mat_skin` | `colors.skin` | Pele (corpo, rosto, orelhas, nariz, mãos) |
| `mat_hair` | `colors.hair` | Cabelos, barbas, bigodes e sobrancelhas |
| `mat_eyes` | `colors.eyes` | Íris dos olhos |
| `mat_primary` | `colors.outfitPrimary` | Tecido principal (túnica, casaco, calça, capa, chapéu, mochila, plumagem principal do pet) |
| `mat_secondary` | `colors.outfitSecondary` | Tecido/couro secundário (forro, botas, cintos, pergaminho, selas, detalhe secundário do pet/pedestal) |
| `mat_metal` | `colors.outfitTrim` | Metais e ornamentos (fivelas, ombreiras, lâminas, coroas, luneta, chifres/adornos, bordas do pedestal) |
| `mat_mount` | `colors.mount` | Pelagem ou corpo principal da montaria |

> **Materiais Fixos (não recoloridos):** qualquer material cujo nome **não** comece pelos 7 nomes acima (por exemplo `mat_sclera` branco dos olhos, `mat_pupil` preto ou `mat_fixed_stone`) mantém sua cor original do `.glb` intacta.

### Materiais Esperados por Categoria (Validação Automática)
O script `verify_starter_3d_assets.mjs` exige os seguintes materiais por pasta:
- `bodies/`: `mat_skin`
- `heads/`: `mat_skin`, `mat_eyes`, `mat_hair`, `mat_secondary` *(ex.: detalhe de gola/lábio; mantenha esclera em `mat_sclera`)*
- `hair/` e `beards/`: `mat_hair`
- `outfits/`, `legs/`, `capes/`, `props_back/`, `pets/`: `mat_primary`, `mat_secondary`, `mat_metal`
- `hats/`: `mat_primary` e/ou `mat_metal`
- `props_hand/`: `mat_metal`, `mat_secondary`
- `mounts/`: `mat_mount`, `mat_secondary`, `mat_metal`
- `pedestals/`: `mat_secondary`, `mat_metal`

---

## 4. Pipeline Gratuito + Google One (2D → 3D → `.glb`)

Siga este fluxo para criar novos cosméticos com aparência estilizada de nível profissional sem custo adicional:

### Passo 1: Conceito 2D em Fundo Neutro (**Gemini / Nano Banana Pro**)
Use o **Gemini** (incluído no Google One) ou **Nano Banana Pro** para gerar uma imagem de referência limpa em proporção `1:1`:

- **Regra de ouro:** peça vista **frontal ortogonal ou 3/4 leve**, **fundo branco/cinza liso e sólido**, **iluminação difusa uniforme** (sem sombras pesadas no chão), e **sem texto ou molduras**.
- **Prompt modelo — Traje / Personagem (`outfits/`, `bodies/`):**
  > `Stylized 3D game character asset concept art inspired by Catan Universe and Sea of Thieves, [DESCRIÇÃO DA PEÇA, ex: ornate navy admiral coat with gold epaulets and leather belt], standing in neutral symmetric A-pose, centered, full view, clean smooth clay-like PBR surfaces, soft studio lighting, solid plain light-gray background, no text, no shadow on floor, square 1:1.`
- **Prompt modelo — Adereço / Chapéu / Coroa (`hats/`, `props_hand/`, `props_back/`):**
  > `Single isolated 3D game prop concept art, [DESCRIÇÃO, ex: golden royal scepter topped with an amber compass orb], front orthographic view, stylized hand-painted PBR aesthetic, clean silhouette, solid plain white background, no hands holding it, no text, square 1:1.`
- **Prompt modelo — Montaria / Pet (`mounts/`, `pets/`):**
  > `Stylized 3D tabletop game miniature of [DESCRIÇÃO, ex: armored snow wolf with bronze collar], standing proud in 3/4 front-left view, clean sculpted fur geometry, solid plain white background, soft even studio light, no base, no text, square 1:1.`

Salve a imagem gerada em `.png` ou `.webp`.

---

### Passo 2: Conversão Image-to-3D Grátis (**Hunyuan3D / Tripo3D / Meshy**)
Envie o conceito 2D para uma das plataformas com geração gratuita de `.glb`:

1. **Tencent Hunyuan3D (Web / Hugging Face Space oficial)** — excelente fidelidade de silhueta e PBR gratuito sem marca d'água.
2. **Tripo3D (plano gratuito)** — gera `.glb` limpo em ~30 segundos com ótima topologia para adereços, chapéus e montarias.
3. **Meshy (plano gratuito)** — opção prática para props, escudos, mochilas e animais estilizados.

**Configurações recomendadas na exportação da ferramenta:**
- Formato: **`.glb` (glTF Binary)**
- Textura / Shading: deixe **Enable PBR / Albedo** ou **Clay/White Mesh** se você for separar os materiais manualmente no Blender (para recolor dinâmico, a separação por material `mat_*` é o mais importante!).

---

### Passo 3: Normalização e Exportação no **Blender** (Gratuito)
Abra o **Blender (4.x+)** e prepare o arquivo para o motor do *Rule the Isle*:

1. **Limpar cena:** apague câmera, luz e cubo padrão (`A` → `X` → Delete).
2. **Importar o `.glb`:** `File → Import → glTF 2.0 (.glb/.gltf)`.
3. **Conferir orientação e escala:**
   - Gire o modelo para olhar para **`+Y` ou `-Y` no Blender conforme o eixo que exporta como `+Z` no glTF** (no exportador glTF do Blender com `+Y Up` ativado, a frente do modelo no Blender deve apontar para **`-Y`**, que vira **`+Z`** no `.glb`!).
   - Ajuste a escala (`S`) até a altura bater com a tabela da Seção 2 (ex.: personagem completo `1.75 m`; coroa `~0.12 m` de altura e `~0.23 m` de largura; espada `~0.90 m`).
   - Aplique transformações: **`Ctrl + A` → `All Transforms`**.
4. **Ajustar Origem / Pivô (*Socket*):**
   - Posicione o cursor 3D (`Shift + S`) no ponto de encaixe correto da Seção 2 (ex.: pés no `(0,0,0)` para corpo/botas/montaria; empunhadura no `(0,0,0)` para arma de mão; garras no `(0,0,0)` para pet de ombro).
   - Com o objeto selecionado: `Right Click → Set Origin → Origin to 3D Cursor`, depois mova o objeto para `(0, 0, 0)` (exceto `mounts/`, cuja âncora deve ficar em `(0.42, 0, -0.42)` no espaço glTF!).
5. **Otimizar malha (se pesada):**
   - Adicione modificador **Decimate** (`Collapse`, ex. ratio `0.25–0.5`) para manter cada peça leve (`<= 8.000` a `15.000` triângulos, idealmente `< 500 KB` por `.glb`). Aplique o modificador.
6. **Configurar Materiais `mat_*`:**
   - No painel *Material Properties*, remova texturas pesadas desnecessárias ou mantenha mapas normais leves.
   - Separe as faces por área de cor (`Edit Mode → P → Selection` ou atribua múltiplos slots de material no mesmo mesh) e **renomeie exatamente** os materiais para os nomes da Seção 3: `mat_skin`, `mat_hair`, `mat_eyes`, `mat_primary`, `mat_secondary`, `mat_metal`, `mat_mount`.
   - Use cores base neutras/representativas no `Principled BSDF` (o `materialTint.ts` substituirá a cor `Base Color` em runtime mantendo `Roughness` e `Metallic` do seu material!).
7. **Exportar `.glb` com Draco:**
   - `File → Export → glTF 2.0 (.glb/.gltf)`
   - **Format:** `glTF Binary (.glb)`
   - **Include:** `Selected Objects` (selecione apenas a peça)
   - **Transform:** `+Y Up` ativado
   - **Mesh / Compression:** ative **Draco Mesh Compression** (nível padrão `6`, reduz o tamanho final em até 80%)
   - **Materials:** `Export`

---

### Passo 4: Integrar e Validar no Projeto
1. Salve o arquivo exportado no caminho exato dentro de `ui/public/assets/models/avatars/<categoria>/<id>.glb`.
2. Se for um **novo item** (além dos 55 do catálogo base), registre o `id` e `modelPath` de forma idêntica em:
   - `catanatron/catanatron/web/avatar_catalog.py`
   - `api/catanatron/web/avatar_catalog.py` *(espelho obrigatório!)*
   - `ui/src/config/avatarCatalog.ts`
   - `ui/scripts/verify_starter_3d_assets.mjs` *(adicione ao `AVATAR_MODEL_MANIFEST`)*
3. Valide todos os `.glb` executando na pasta `ui/`:
   ```bash
   npm run verify:avatars3d
   ```
   O comando deve exibir `[verify_starter_3d_assets] PASS: ...`.

---

## 5. Checklist Rápido Antes do Commit

- [ ] Arquivo `.glb` válido (versão glTF 2.0, compressão Draco opcional suportada pelo `DRACOLoader`).
- [ ] Escala em metros (`1.75 m` de altura total de referência), frente voltada para `+Z`, pés/base em `Y = 0`.
- [ ] Pivô alinhado ao *socket* correto (sem flutuar ou afundar no pedestal).
- [ ] Todos os materiais recoloríveis nomeados estritamente com `mat_skin`, `mat_hair`, `mat_eyes`, `mat_primary`, `mat_secondary`, `mat_metal` ou `mat_mount`.
- [ ] `npm run verify:avatars3d` passando sem erros.
