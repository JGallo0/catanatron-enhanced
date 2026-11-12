import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import { getResourceMeta } from "../config/assetRegistry";
import { useLanguage } from "../i18n";
import type { ResourceCard } from "../utils/api.types";
import "./AlmanacModal.scss";

type AlmanacTab = "builds" | "dev" | "modes";

interface AlmanacModalProps {
  open: boolean;
  onClose: () => void;
}

function getAlmanacBuildingCosts(isEnglish: boolean): Array<{
  title: string;
  vp: string;
  icon: string;
  limit: string;
  summary: string;
  cost: Partial<Record<ResourceCard, number>>;
}> {
  if (isEnglish) {
    return [
      {
        title: "Road",
        vp: "0 VP",
        icon: "🛤️",
        limit: "Max. 15 pieces",
        summary:
          "Expands your network along island edges to reach new intersections and compete for Longest Road.",
        cost: { WOOD: 1, BRICK: 1 },
      },
      {
        title: "Settlement",
        vp: "+1 VP",
        icon: "🏡",
        limit: "Max. 5 pieces",
        summary:
          "Collects 1 resource whenever an adjacent hex has its number rolled. Must stay at least 2 edges from any other building.",
        cost: { WOOD: 1, BRICK: 1, SHEEP: 1, WHEAT: 1 },
      },
      {
        title: "City",
        vp: "+2 VP (+1 net)",
        icon: "🏰",
        limit: "Max. 4 pieces",
        summary:
          "Upgrades an existing Settlement, doubling its harvest to 2 resource cards per roll.",
        cost: { WHEAT: 2, ORE: 3 },
      },
      {
        title: "Development Card",
        vp: "Effect / VP",
        icon: "📜",
        limit: "25 in deck",
        summary:
          "Draws the top card from the deck. May only be played starting on your next turn (except Victory Points).",
        cost: { SHEEP: 1, WHEAT: 1, ORE: 1 },
      },
    ];
  }
  return [
    {
      title: "Estrada",
      vp: "0 PV",
      icon: "🛤️",
      limit: "Máx. 15 peças",
      summary:
        "Expande sua malha pelas arestas da ilha para alcançar novos vértices e disputar a Maior Estrada.",
      cost: { WOOD: 1, BRICK: 1 },
    },
    {
      title: "Aldeia",
      vp: "+1 PV",
      icon: "🏡",
      limit: "Máx. 5 peças",
      summary:
        "Coleta 1 recurso sempre que um hexágono adjacente tem o número sorteado nos dados. Deve respeitar distância mínima de 2 arestas.",
      cost: { WOOD: 1, BRICK: 1, SHEEP: 1, WHEAT: 1 },
    },
    {
      title: "Cidade",
      vp: "+2 PV (+1 saldo)",
      icon: "🏰",
      limit: "Máx. 4 peças",
      summary:
        "Evolui uma Aldeia já existente, dobrando a colheita para 2 cartas de recurso por rolagem.",
      cost: { WHEAT: 2, ORE: 3 },
    },
    {
      title: "Carta de Desenvolvimento",
      vp: "Efeito / PV",
      icon: "📜",
      limit: "25 no baralho",
      summary:
        "Compra a carta do topo do baralho. Só pode ser ativada a partir do próximo turno (exceto Pontos de Vitória).",
      cost: { SHEEP: 1, WHEAT: 1, ORE: 1 },
    },
  ];
}

function getAlmanacDevCardsInfo(isEnglish: boolean): Array<{
  name: string;
  count: number;
  icon: string;
  desc: string;
}> {
  if (isEnglish) {
    return [
      {
        name: "Knight",
        count: 14,
        icon: "⚔️",
        desc: "Moves the Robber to another hex, blocks its production, and steals 1 random card from an adjacent opponent.",
      },
      {
        name: "Victory Point",
        count: 5,
        icon: "🏆",
        desc: "Stays hidden from opponents until you reach the match Victory Point goal.",
      },
      {
        name: "Road Building",
        count: 2,
        icon: "🛣️",
        desc: "Lets you place up to 2 free Roads connected to your existing network.",
      },
      {
        name: "Year of Plenty",
        count: 2,
        icon: "🌾",
        desc: "Immediately take any 2 resource cards of your choice from the Bank.",
      },
      {
        name: "Monopoly",
        count: 2,
        icon: "💰",
        desc: "Choose one resource type: every other player must give you all cards of that type.",
      },
    ];
  }
  return [
    {
      name: "Cavaleiro",
      count: 14,
      icon: "⚔️",
      desc: "Move o Ladrão para outro hexágono, bloqueia sua produção e rouba 1 carta aleatória de um vizinho.",
    },
    {
      name: "Ponto de Vitória",
      count: 5,
      icon: "🏆",
      desc: "Fica oculto aos adversários até você atingir a meta de pontos da partida.",
    },
    {
      name: "Construção de Estradas",
      count: 2,
      icon: "🛣️",
      desc: "Permite posicionar até 2 Estradas gratuitamente conectadas à sua rede.",
    },
    {
      name: "Ano da Fartura",
      count: 2,
      icon: "🌾",
      desc: "Recebe imediatamente 2 recursos à sua escolha diretamente do Banco.",
    },
    {
      name: "Monopólio",
      count: 2,
      icon: "💰",
      desc: "Escolha um tipo de recurso: todos os outros jogadores entregam a você todas as cartas dele.",
    },
  ];
}

function ResourceChip({
  resource,
  count,
}: {
  resource: ResourceCard;
  count: number;
}) {
  const { language } = useLanguage();
  const meta = getResourceMeta(language)[resource];
  return (
    <span
      className="almanac-cost-chip"
      style={{ borderColor: meta.accentColor }}
    >
      <span
        className="almanac-cost-chip__dot"
        style={{ background: meta.secondaryColor }}
      />
      <span>
        {count}× {meta.label}
      </span>
    </span>
  );
}

export default function AlmanacModal({ open, onClose }: AlmanacModalProps) {
  const { isEnglish, t } = useLanguage();
  const [tab, setTab] = useState<AlmanacTab>("builds");
  const buildingCosts = getAlmanacBuildingCosts(isEnglish);
  const devCardsInfo = getAlmanacDevCardsInfo(isEnglish);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ className: "almanac-modal-paper" }}
      aria-labelledby="almanac-modal-title"
    >
      <DialogTitle id="almanac-modal-title" className="almanac-modal-header">
        <div className="almanac-modal-header__title">
          <span aria-hidden="true">📖</span>
          <div>
            <span>
              {t(
                "Almanaque & Regras — Rule the Isle",
                "Almanac & Rules — Rule the Isle"
              )}
            </span>
            <small>
              {t(
                "Referência rápida de custos, cartas, honrarias e modos de jogo",
                "Quick reference for costs, cards, honors, and game modes"
              )}
            </small>
          </div>
        </div>
        <IconButton
          onClick={onClose}
          size="small"
          aria-label={t("Fechar almanaque", "Close almanac")}
          className="almanac-modal-close"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <div
        className="almanac-modal-tabs"
        role="tablist"
        aria-label={t("Seções do almanaque", "Almanac sections")}
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "builds"}
          className={`almanac-tab-btn ${tab === "builds" ? "is-active" : ""}`}
          onClick={() => setTab("builds")}
        >
          🔨 {t("Construções & Trocas", "Buildings & Trade")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "dev"}
          className={`almanac-tab-btn ${tab === "dev" ? "is-active" : ""}`}
          onClick={() => setTab("dev")}
        >
          📜 {t("Cartas & Honrarias", "Cards & Honors")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "modes"}
          className={`almanac-tab-btn ${tab === "modes" ? "is-active" : ""}`}
          onClick={() => setTab("modes")}
        >
          🎲 {t("Dados & Regras da Mesa", "Dice & Table Rules")}
        </button>
      </div>

      <DialogContent className="almanac-modal-body">
        {tab === "builds" && (
          <div className="almanac-section">
            <div className="almanac-build-grid">
              {buildingCosts.map((item) => (
                <article key={item.title} className="almanac-card">
                  <div className="almanac-card__head">
                    <span className="almanac-card__icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <div className="almanac-card__title-group">
                      <strong>{item.title}</strong>
                      <small>{item.limit}</small>
                    </div>
                    <span className="almanac-vp-badge">{item.vp}</span>
                  </div>
                  <p className="almanac-card__desc">{item.summary}</p>
                  <div className="almanac-card__costs">
                    {(Object.entries(item.cost) as Array<[ResourceCard, number]>).map(
                      ([res, qty]) => (
                        <ResourceChip key={res} resource={res} count={qty} />
                      )
                    )}
                  </div>
                </article>
              ))}
            </div>

            <div className="almanac-callout-row">
              <div className="almanac-callout">
                <h4>⚓ {t("Troca Marítima & Portos", "Maritime Trade & Harbors")}</h4>
                <ul>
                  <li>
                    <strong>{t("Banco Geral (4:1):", "Bank Trade (4:1):")}</strong>{" "}
                    {t(
                      "Sempre disponível no seu turno após rolar os dados.",
                      "Always available on your turn after rolling the dice."
                    )}
                  </li>
                  <li>
                    <strong>{t("Porto Genérico (3:1):", "Generic Harbor (3:1):")}</strong>{" "}
                    {t(
                      "Qualquer Aldeia ou Cidade conectada a um porto",
                      "Any Settlement or City connected to a"
                    )}{" "}
                    <code>3:1</code>{" "}
                    {t(
                      "libera troca 3 para 1.",
                      "harbor unlocks 3-for-1 trading."
                    )}
                  </li>
                  <li>
                    <strong>
                      {t("Porto Especializado (2:1):", "Specialty Harbor (2:1):")}
                    </strong>{" "}
                    {t(
                      "Troque apenas 2 cartas do recurso ilustrado por 1 de qualquer outro.",
                      "Trade just 2 cards of the shown resource for 1 of any other."
                    )}
                  </li>
                </ul>
              </div>
              <div className="almanac-callout">
                <h4>🤝 {t("Comércio & Estratégia Rápida", "Trade & Quick Tips")}</h4>
                <ul>
                  <li>
                    <strong>{t("Propostas na Mesa:", "Table Offers:")}</strong>{" "}
                    {t(
                      "No seu turno, envie propostas aos adversários com contrapropostas sem travar a visão do tabuleiro.",
                      "On your turn, send trade offers and counteroffers without blocking the board view."
                    )}
                  </li>
                  <li>
                    <strong>{t("Dica anti-excesso:", "Hand limit tip:")}</strong>{" "}
                    {t(
                      "Se o total na mão passar do Limite do Ladrão, construir Estradas ou trocar 4:1 evita perder metade das cartas no 7.",
                      "If your hand exceeds the Discard Limit, building Roads or trading 4:1 prevents losing half your cards on a 7."
                    )}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {tab === "dev" && (
          <div className="almanac-section">
            <div className="almanac-honors-grid">
              <div className="almanac-honor-box">
                <span className="almanac-honor-box__badge">
                  ★ +2 {t("PV", "VP")}
                </span>
                <strong>
                  {t(
                    "Maior Estrada (5+ estradas)",
                    "Longest Road (5+ roads)"
                  )}
                </strong>
                <p>
                  {t(
                    "Conquistada pelo primeiro jogador a ligar 5 estradas contínuas sem interrupção por Aldeia adversária. Muda de dono se alguém alcançar um caminho maior.",
                    "Awarded to the first player to connect 5 continuous roads unbroken by an opponent's Settlement. Transfers if another player builds a longer path."
                  )}
                </p>
              </div>
              <div className="almanac-honor-box">
                <span className="almanac-honor-box__badge">
                  ⚔️ +2 {t("PV", "VP")}
                </span>
                <strong>
                  {t(
                    "Maior Exército (3+ cavaleiros)",
                    "Largest Army (3+ knights)"
                  )}
                </strong>
                <p>
                  {t(
                    "Concedido ao primeiro jogador a revelar 3 cartas de Cavaleiro. Outro jogador toma o emblema apenas ao superar essa contagem.",
                    "Granted to the first player to reveal 3 Knight cards. Another player claims the badge only by strictly surpassing that count."
                  )}
                </p>
              </div>
            </div>

            <h4 className="almanac-subtitle">
              {t(
                "Composição do Baralho de Desenvolvimento (25 Cartas)",
                "Development Deck Breakdown (25 Cards)"
              )}
            </h4>
            <div className="almanac-dev-list">
              {devCardsInfo.map((card) => (
                <div key={card.name} className="almanac-dev-row">
                  <span className="almanac-dev-row__icon" aria-hidden="true">
                    {card.icon}
                  </span>
                  <div className="almanac-dev-row__copy">
                    <div className="almanac-dev-row__title">
                      <strong>{card.name}</strong>
                      <span className="almanac-dev-qty">
                        {card.count}× {t("no baralho", "in deck")}
                      </span>
                    </div>
                    <p>{card.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "modes" && (
          <div className="almanac-section">
            <div className="almanac-rules-grid">
              <div className="almanac-callout">
                <h4>
                  🎴{" "}
                  {t(
                    "Dados Equilibrados (Deck 36)",
                    "Balanced Dice (36-Card Deck)"
                  )}
                </h4>
                <p>
                  {t(
                    "Inspirado no modo competitivo de Catan: em vez de dois dados independentes, usa um baralho com todas as 36 combinações de",
                    "Inspired by competitive Catan: instead of two independent dice, uses a deck containing all 36 combinations of"
                  )}{" "}
                  <code>(1..6 × 1..6)</code>
                  {t(
                    ", garantindo exatamente 6 setes, 5 seis e 5 oitos por ciclo.",
                    ", guaranteeing exactly 6 sevens, 5 sixes, and 5 eights per cycle."
                  )}
                </p>
                <p className="almanac-muted">
                  {t(
                    "Quando restam",
                    "When"
                  )}{" "}
                  <strong>{t("5 cartas", "5 cards")}</strong>{" "}
                  {t(
                    "no baralho, um novo maço de 36 é embaralhado automaticamente para impedir contagem perfeita do final do ciclo.",
                    "remain in the deck, a fresh 36-card deck is shuffled automatically to prevent exact end-of-cycle card counting."
                  )}
                </p>
              </div>
              <div className="almanac-callout">
                <h4>
                  🥷{" "}
                  {t(
                    "Ladrão Amigável & Limite 7",
                    "Friendly Robber & 7-Card Limit"
                  )}
                </h4>
                <p>
                  {t(
                    "Quando o Ladrão Amigável está ativo, o Ladrão não pode ser movido contra jogadores que ainda possuem",
                    "When Friendly Robber is enabled, the Robber cannot be placed against players who still have"
                  )}{" "}
                  <strong>
                    {t("2 pontos ou menos", "2 Victory Points or fewer")}
                  </strong>
                  {t(
                    ", evitando bloqueios logo na abertura.",
                    ", preventing early-game lockouts."
                  )}
                </p>
                <p className="almanac-muted">
                  {t("Ao sair um", "Whenever a")} <strong>7</strong>{" "}
                  {t(
                    ", quem estiver acima do Limite de Cartas descarta metade (arredondado para baixo) antes da movimentação do Ladrão.",
                    "is rolled, anyone above the Discard Limit discards half their hand (rounded down) before the Robber moves."
                  )}
                </p>
              </div>
            </div>

            <h4 className="almanac-subtitle">
              {t("Modelos de Mapa Disponíveis", "Available Map Templates")}
            </h4>
            <div className="almanac-maps-grid">
              <div className="almanac-map-note">
                <strong>
                  {t("Padrão (Mapa aleatório)", "Standard (Random Map)")}
                </strong>
                <p>
                  {t(
                    "19 terrenos e 9 portos embaralhados para rejogabilidade clássica.",
                    "19 shuffled terrains and 9 harbors for classic replayability."
                  )}
                </p>
              </div>
              <div className="almanac-map-note">
                <strong>Mini</strong>
                <p>
                  {t(
                    "Ilha compacta com 7 terrenos e sem deserto — ideal para partidas rápidas.",
                    "Compact 7-hex island with no desert — ideal for quick matches."
                  )}
                </p>
              </div>
              <div className="almanac-map-note">
                <strong>
                  {t("Torneio (Mapa fixo)", "Tournament (Fixed Map)")}
                </strong>
                <p>
                  {t(
                    "Terrenos e fichas numéricas idênticos e balanceados com deserto central fixo.",
                    "Identical, balanced terrain and number tokens with a fixed central desert."
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
