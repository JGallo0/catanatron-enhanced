# Pasta de Ilustrações — Nano Banana Pro

Coloque suas ilustrações geradas no **Nano Banana Pro** nas subpastas abaixo (formato `.webp` recomendado):

```text
ui/public/assets/illustrations/
├── tiles/
│   ├── wood.webp          # Floresta (1024x1024, 1:1)
│   ├── brick.webp         # Colinas / Argila (1024x1024, 1:1)
│   ├── sheep.webp         # Pastagem / Lã (1024x1024, 1:1)
│   ├── wheat.webp         # Campos / Trigo (1024x1024, 1:1)
│   ├── ore.webp           # Montanha / Minério (1024x1024, 1:1)
│   └── desert.webp        # Deserto (1024x1024, 1:1)
├── cards/
│   ├── wood.webp          # Carta de Madeira (768x1024, 3:4)
│   ├── brick.webp         # Carta de Argila (768x1024, 3:4)
│   ├── sheep.webp         # Carta de Lã (768x1024, 3:4)
│   ├── wheat.webp         # Carta de Trigo (768x1024, 3:4)
│   └── ore.webp           # Carta de Minério (768x1024, 3:4)
└── dev/
    ├── knight.webp        # Cavaleiro (768x1024, 3:4)
    ├── monopoly.webp      # Monopólio (768x1024, 3:4)
    ├── year_of_plenty.webp # Ano da Fartura (768x1024, 3:4)
    ├── road_building.webp # Construção de Estradas (768x1024, 3:4)
    └── victory_point.webp # Ponto de Vitória (768x1024, 3:4)
```

Consulte os prompts prontos em [`docs/NANO_BANANA_PROMPTS.md`](../../../../docs/NANO_BANANA_PROMPTS.md).
O motor do **Catanatron Enhanced** detecta automaticamente esses arquivos e os aplica com recorte hexagonal, chanfro dourado e iluminação sem precisar alterar código!
