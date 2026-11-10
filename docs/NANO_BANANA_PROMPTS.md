# Guia de Ilustrações — Nano Banana Pro (Catanatron Enhanced)

Este documento define as especificações técnicas, caminhos de arquivos e **prompts otimizados para o Nano Banana Pro** (inspirados na direção de arte de *Catan Universe* da Steam) para substituir ou enriquecer os terrenos, cartas de recursos e cartas de desenvolvimento.

---

## Como o Sistema de Ilustrações Funciona

O **Catanatron Enhanced** possui um sistema híbrido em [`ui/src/config/assetRegistry.ts`](../ui/src/config/assetRegistry.ts):
1. Por padrão, o jogo renderiza **ilustrações vetoriais estilizadas em múltiplas camadas** (SVGs com gradientes, chanfros dourados, sombras internas e ícones detalhados).
2. Assim que você colocar uma imagem gerada pelo **Nano Banana Pro** na pasta `ui/public/assets/illustrations/...` (e ativar `useCustomIllustrations: true` ou o caminho correspondente em `assetRegistry.ts`), o tabuleiro e as cartas passam a exibir automaticamente a sua arte recortada dentro da máscara hexagonal (`<clipPath>`) com moldura de madeira/ouro e iluminação dinâmica!

---

## 1. Terrenos Hexagonais (`ui/public/assets/illustrations/tiles/`)

* **Resolução recomendada:** `1024x1024 px` (proporção `1:1`, formato `.webp` ou `.png`).
* **Enquadramento:** O motor SVG recorta um hexágono *pointy-top* inscrito no quadrado. Mantenha o elemento principal (montanha, moinho, rebanho, oásis) nos **75% centrais** da imagem, deixando as bordas com vegetação/terreno contínuo.
* **Lembrete de UI:** O centro inferior/central do hexágono recebe a **ficha numérica circular (Token 2–12)**. Evite colocar detalhes minúsculos essenciais exatamente no ponto central `(512, 512)`.

| Recurso / Terreno | Caminho do Arquivo | Prompt Recomendado (Nano Banana Pro) |
| :--- | :--- | :--- |
| **Madeira (Floresta)** | `ui/public/assets/illustrations/tiles/wood.webp` | `Top-down 45-degree isometric board game hex tile illustration of a lush ancient pine and redwood forest, stacked felled timber logs near a small clearing, warm golden sunlight filtering through deep emerald canopy, painterly digital art style inspired by Catan Universe Steam game, rich textures, vibrant emerald and pine greens, no text, no borders, square 1:1 composition.` |
| **Argila (Colinas)** | `ui/public/assets/illustrations/tiles/brick.webp` | `Top-down 45-degree isometric board game hex tile illustration of terraced red clay hills and a rustic brick quarry with warm terracotta canyon layers, wheelbarrows and stacked kilned bricks, warm sunset rim lighting, painterly digital art style inspired by Catan Universe Steam game, rich burnt orange and crimson clay tones, no text, no borders, square 1:1 composition.` |
| **Lã (Pastagem)** | `ui/public/assets/illustrations/tiles/sheep.webp` | `Top-down 45-degree isometric board game hex tile illustration of rolling sunlit pastoral meadows with fluffy white sheep grazing near a cozy wooden fence and wildflowers, bright spring greens and soft golden light, painterly digital art style inspired by Catan Universe Steam game, high contrast, charming tabletop aesthetic, no text, no borders, square 1:1 composition.` |
| **Trigo (Campos)** | `ui/public/assets/illustrations/tiles/wheat.webp` | `Top-down 45-degree isometric board game hex tile illustration of abundant golden wheat fields rippling in the wind, harvested grain sheaves and a rustic stone windmill on a gentle hill, warm amber harvest sunlight, painterly digital art style inspired by Catan Universe Steam game, glowing gold and ochre palette, no text, no borders, square 1:1 composition.` |
| **Minério (Montanha)** | `ui/public/assets/illustrations/tiles/ore.webp` | `Top-down 45-degree isometric board game hex tile illustration of jagged granite mountain peaks with exposed veins of silver and iron ore, mine cart tracks entering a timbered cavern, dramatic alpine lighting with cool slate blue and metallic silver highlights, painterly digital art style inspired by Catan Universe Steam game, no text, no borders, square 1:1 composition.` |
| **Deserto (Dunas)** | `ui/public/assets/illustrations/tiles/desert.webp` | `Top-down 45-degree isometric board game hex tile illustration of windswept golden desert sand dunes with a small dry oasis, sun-bleached rocks and desert Nomad ruins, warm saharan light, painterly digital art style inspired by Catan Universe Steam game, sandy gold and warm ochre tones, no text, no borders, square 1:1 composition.` |

---

## 2. Cartas de Recursos (`ui/public/assets/illustrations/cards/`)

* **Resolução recomendada:** `768x1024 px` (proporção `3:4`, formato `.webp` ou `.png`).

| Carta | Caminho do Arquivo | Prompt Recomendado (Nano Banana Pro) |
| :--- | :--- | :--- |
| **Madeira** | `ui/public/assets/illustrations/cards/wood.webp` | `Fantasy board game resource card illustration: freshly cut oak and pine timber logs bound with rope beside a forest river sawmill, warm sunlight, lush green pines in background, Catan Universe Steam digital card art style, vertical 3:4 aspect ratio, no text, no card frame.` |
| **Argila** | `ui/public/assets/illustrations/cards/brick.webp` | `Fantasy board game resource card illustration: neatly stacked warm terracotta bricks and wet red clay beside a glowing brickmaker kiln, Catan Universe Steam digital card art style, vertical 3:4 aspect ratio, no text, no card frame.` |
| **Lã** | `ui/public/assets/illustrations/cards/sheep.webp` | `Fantasy board game resource card illustration: soft bales of freshly sheared white wool and a friendly puff-coated sheep in a sunlit green highland pasture, Catan Universe Steam digital card art style, vertical 3:4 aspect ratio, no text, no card frame.` |
| **Trigo** | `ui/public/assets/illustrations/cards/wheat.webp` | `Fantasy board game resource card illustration: golden sheaves of ripe wheat tied with twine in a sunlit harvest field with a windmill on the horizon, Catan Universe Steam digital card art style, vertical 3:4 aspect ratio, no text, no card frame.` |
| **Minério** | `ui/public/assets/illustrations/cards/ore.webp` | `Fantasy board game resource card illustration: gleaming chunks of raw iron and silver ore with crystalline veins resting on a blacksmith anvil inside a mountain cavern, Catan Universe Steam digital card art style, vertical 3:4 aspect ratio, no text, no card frame.` |

---

## 3. Cartas de Desenvolvimento (`ui/public/assets/illustrations/dev/`)

* **Resolução recomendada:** `768x1024 px` (proporção `3:4`, formato `.webp` ou `.png`).

| Carta | Caminho do Arquivo | Prompt Recomendado (Nano Banana Pro) |
| :--- | :--- | :--- |
| **Cavaleiro (`KNIGHT`)** | `ui/public/assets/illustrations/dev/knight.webp` | `Medieval board game development card illustration: a noble armored knight on horseback holding a lance and heraldic shield, patrolling a coastal island road at dawn, Catan Universe Steam digital painting style, vertical 3:4, no text.` |
| **Monopólio (`MONOPOLY`)** | `ui/public/assets/illustrations/dev/monopoly.webp` | `Medieval board game development card illustration: a wealthy renaissance merchant at a harbor counting house with scales of gold and crates of tutte resources, dramatic warm lighting, Catan Universe Steam digital painting style, vertical 3:4, no text.` |
| **Ano da Fartura (`YEAR_OF_PLENTY`)** | `ui/public/assets/illustrations/dev/year_of_plenty.webp` | `Medieval board game development card illustration: an overflowing golden cornucopia on a festive wooden table filled with grain, timber, wool, brick and ore under a rainbow sky, Catan Universe Steam digital painting style, vertical 3:4, no text.` |
| **Construção de Estradas (`ROAD_BUILDING`)** | `ui/public/assets/illustrations/dev/road_building.webp` | `Medieval board game development card illustration: medieval guildsmen and masons paving a cobblestone trade road and stone bridge across a green valley, Catan Universe Steam digital painting style, vertical 3:4, no text.` |
| **Ponto de Vitória (`VICTORY_POINT`)** | `ui/public/assets/illustrations/dev/victory_point.webp` | `Medieval board game development card illustration: a grand sunlit cathedral and university square in a prosperous island citadel with festive banners and golden laurels, Catan Universe Steam digital painting style, vertical 3:4, no text.` |
