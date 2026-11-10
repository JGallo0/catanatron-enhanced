# 🎨 Pasta de Ilustrações Customizadas (Nano Banana Pro)

Basta salvar suas imagens geradas no **Nano Banana Pro** dentro das subpastas abaixo (em formato `.webp`, `.png` ou `.jpg`).
O componente [`HybridIllustration`](../../../src/components/icons/GameIcons.tsx) detecta automaticamente qualquer arquivo `.webp`, `.png` ou `.jpg` com o nome correspondente e substitui a arte vetorial padrão!

## 1. `tiles/` — Hexágonos do Tabuleiro (`1:1`, ex: `1024x1024`)
- `wood.webp` (ou `wood.png`) — Floresta (Madeira)
- `brick.webp` (ou `brick.png`) — Colinas (Argila)
- `sheep.webp` (ou `sheep.png`) — Pastagem (Lã)
- `wheat.webp` (ou `wheat.png`) — Campos (Trigo)
- `ore.webp` (ou `ore.png`) — Montanha (Minério)
- `desert.webp` (ou `desert.png`) — Deserto (Oásis)
- `water.webp` (ou `water.png`) — Oceano / Mar *(opcional)*

## 2. `cards/` — Cartas de Matéria-Prima (`3:4`, ex: `768x1024`)
- `wood.webp` (ou `wood.png`) — Carta de Madeira
- `brick.webp` (ou `brick.png`) — Carta de Argila
- `sheep.webp` (ou `sheep.png`) — Carta de Lã
- `wheat.webp` (ou `wheat.png`) — Carta de Trigo
- `ore.webp` (ou `ore.png`) — Carta de Minério

## 3. `dev/` — Cartas de Desenvolvimento (`3:4`, ex: `768x1024`)
- `knight.webp` (ou `knight.png`) — Cavaleiro
- `victory_point.webp` (ou `victory_point.png`) — Ponto de Vitória
- `road_building.webp` (ou `road_building.png`) — Construção de Estradas
- `year_of_plenty.webp` (ou `year_of_plenty.png`) — Ano da Fartura
- `monopoly.webp` (ou `monopoly.png`) — Monopólio
- `card_back.webp` (ou `card_back.png`) — Verso da Carta *(opcional)*

## 4. `ui/` — Peças Especiais e Banner (`1:1` / `16:9`)
- `robber.webp` (ou `robber.png`) — Peão do Ladrão (`512x512` fundo transparente)
- `largest_army.webp` (ou `largest_army.png`) — Medalha Maior Exército (`512x512`)
- `longest_road.webp` (ou `longest_road.png`) — Medalha Maior Estrada (`512x512`)
- `lobby_hero.webp` (ou `lobby_hero.png`) — Banner de Fundo da Tela Inicial (`1920x1080`)
