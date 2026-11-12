import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import { RESOURCE_META } from "../config/assetRegistry";
import type { ResourceCard } from "../utils/api.types";
import "./AlmanacModal.scss";

type AlmanacTab = "builds" | "dev" | "modes";

interface AlmanacModalProps {
  open: boolean;
  onClose: () => void;
}

const BUILDING_COSTS: Array<{
  title: string;
  vp: string;
  icon: string;
  limit: string;
  summary: string;
  cost: Partial<Record<ResourceCard, number>>;
}> = [
  {
    title: "Estrada",
    vp: "0 PV",
    icon: "🛤️",
    limit: "Máx. 15 peças",
    summary: "Expande sua malha pelas arestas da ilha para alcançar novos vértices e disputar a Maior Estrada.",
    cost: { WOOD: 1, BRICK: 1 },
  },
  {
    title: "Aldeia",
    vp: "+1 PV",
    icon: "🏡",
    limit: "Máx. 5 peças",
    summary: "Coleta 1 recurso sempre que um hexágono adjacente tem o número sorteado nos dados. Deve respeitar distância mínima de 2 arestas.",
    cost: { WOOD: 1, BRICK: 1, SHEEP: 1, WHEAT: 1 },
  },
  {
    title: "Cidade",
    vp: "+2 PV (+1 saldo)",
    icon: "🏰",
    limit: "Máx. 4 peças",
    summary: "Evolui uma Aldeia já existente, dobrando a colheita para 2 cartas de recurso por rolagem.",
    cost: { WHEAT: 2, ORE: 3 },
  },
  {
    title: "Carta de Desenvolvimento",
    vp: "Efeito / PV",
    icon: "📜",
    limit: "25 no baralho",
    summary: "Compra a carta do topo do baralho. Só pode ser ativada a partir do próximo turno (exceto Pontos de Vitória).",
    cost: { SHEEP: 1, WHEAT: 1, ORE: 1 },
  },
];

const DEV_CARDS_INFO: Array<{
  name: string;
  count: number;
  icon: string;
  desc: string;
}> = [
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

function ResourceChip({
  resource,
  count,
}: {
  resource: ResourceCard;
  count: number;
}) {
  const meta = RESOURCE_META[resource];
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
  const [tab, setTab] = useState<AlmanacTab>("builds");

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
            <span>Almanaque & Regras — Rule the Isle</span>
            <small>Referência rápida de custos, cartas, honrarias e modos de jogo</small>
          </div>
        </div>
        <IconButton
          onClick={onClose}
          size="small"
          aria-label="Fechar almanaque"
          className="almanac-modal-close"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <div className="almanac-modal-tabs" role="tablist" aria-label="Seções do almanaque">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "builds"}
          className={`almanac-tab-btn ${tab === "builds" ? "is-active" : ""}`}
          onClick={() => setTab("builds")}
        >
          🔨 Construções & Trocas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "dev"}
          className={`almanac-tab-btn ${tab === "dev" ? "is-active" : ""}`}
          onClick={() => setTab("dev")}
        >
          📜 Cartas & Honrarias
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "modes"}
          className={`almanac-tab-btn ${tab === "modes" ? "is-active" : ""}`}
          onClick={() => setTab("modes")}
        >
          🎲 Dados & Regras da Mesa
        </button>
      </div>

      <DialogContent className="almanac-modal-body">
        {tab === "builds" && (
          <div className="almanac-section">
            <div className="almanac-build-grid">
              {BUILDING_COSTS.map((item) => (
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
                <h4>⚓ Troca Marítima & Portos</h4>
                <ul>
                  <li>
                    <strong>Banco Geral (4:1):</strong> Sempre disponível no seu turno após rolar os dados.
                  </li>
                  <li>
                    <strong>Porto Genérico (3:1):</strong> Qualquer Aldeia ou Cidade conectada a um porto <code>3:1</code> libera troca 3 para 1.
                  </li>
                  <li>
                    <strong>Porto Especializado (2:1):</strong> Troque apenas 2 cartas do recurso ilustrado por 1 de qualquer outro.
                  </li>
                </ul>
              </div>
              <div className="almanac-callout">
                <h4>🤝 Comércio & Estratégia Rápida</h4>
                <ul>
                  <li>
                    <strong>Propostas na Mesa:</strong> No seu turno, envie propostas aos adversários com contrapropostas sem travar a visão do tabuleiro.
                  </li>
                  <li>
                    <strong>Dica anti-excesso:</strong> Se o total na mão passar do Limite do Ladrão, construir Estradas ou trocar 4:1 evita perder metade das cartas no 7.
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
                <span className="almanac-honor-box__badge">★ +2 PV</span>
                <strong>Maior Estrada (5+ estradas)</strong>
                <p>
                  Conquistada pelo primeiro jogador a ligar 5 estradas contínuas sem interrupção por Aldeia adversária. Muda de dono se alguém alcançar um caminho maior.
                </p>
              </div>
              <div className="almanac-honor-box">
                <span className="almanac-honor-box__badge">⚔️ +2 PV</span>
                <strong>Maior Exército (3+ cavaleiros)</strong>
                <p>
                  Concedido ao primeiro jogador a revelar 3 cartas de Cavaleiro. Outro jogador toma o emblema apenas ao superar essa contagem.
                </p>
              </div>
            </div>

            <h4 className="almanac-subtitle">
              Composição do Baralho de Desenvolvimento (25 Cartas)
            </h4>
            <div className="almanac-dev-list">
              {DEV_CARDS_INFO.map((card) => (
                <div key={card.name} className="almanac-dev-row">
                  <span className="almanac-dev-row__icon" aria-hidden="true">
                    {card.icon}
                  </span>
                  <div className="almanac-dev-row__copy">
                    <div className="almanac-dev-row__title">
                      <strong>{card.name}</strong>
                      <span className="almanac-dev-qty">{card.count}× no baralho</span>
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
                <h4>🎴 Dados Equilibrados (Deck 36)</h4>
                <p>
                  Inspirado no modo competitivo de Catan: em vez de dois dados independentes, usa um baralho com todas as 36 combinações de <code>(1..6 × 1..6)</code>, garantindo exatamente 6 setes, 5 seis e 5 oitos por ciclo.
                </p>
                <p className="almanac-muted">
                  Quando restam <strong>5 cartas</strong> no baralho, um novo maço de 36 é embaralhado automaticamente para impedir contagem perfeita do final do ciclo.
                </p>
              </div>
              <div className="almanac-callout">
                <h4>🥷 Ladrão Amigável & Limite 7</h4>
                <p>
                  Quando o Ladrão Amigável está ativo, o Ladrão não pode ser movido contra jogadores que ainda possuem <strong>2 pontos ou menos</strong>, evitando bloqueios logo na abertura.
                </p>
                <p className="almanac-muted">
                  Ao sair um <strong>7</strong>, quem estiver acima do Limite de Cartas descarta metade (arredondado para baixo) antes da movimentação do Ladrão.
                </p>
              </div>
            </div>

            <h4 className="almanac-subtitle">Modelos de Mapa Disponíveis</h4>
            <div className="almanac-maps-grid">
              <div className="almanac-map-note">
                <strong>Padrão (Mapa aleatório)</strong>
                <p>19 terrenos e 9 portos embaralhados para rejogabilidade clássica.</p>
              </div>
              <div className="almanac-map-note">
                <strong>Mini</strong>
                <p>Ilha compacta com 7 terrenos e sem deserto — ideal para partidas rápidas.</p>
              </div>
              <div className="almanac-map-note">
                <strong>Torneio (Mapa fixo)</strong>
                <p>Terrenos e fichas numéricas idênticos e balanceados com deserto central fixo.</p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
