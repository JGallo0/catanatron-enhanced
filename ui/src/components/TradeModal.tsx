import { useMemo, useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import type {
  GameAction,
  MaritimeTradeAction,
  PlayerState,
  ResourceCard,
} from "../utils/api.types";
import { RESOURCE_META } from "../config/assetRegistry";
import { ResourceIcon } from "./icons/GameIcons";

const RESOURCE_ORDER: ResourceCard[] = [
  "WOOD",
  "BRICK",
  "SHEEP",
  "WHEAT",
  "ORE",
];

type TradeModalProps = {
  open: boolean;
  onClose: () => void;
  tradeActions: MaritimeTradeAction[];
  playerState: PlayerState;
  playerKey: string;
  onExecuteTrade: (action: GameAction) => void;
};

export default function TradeModal({
  open,
  onClose,
  tradeActions,
  playerState,
  playerKey,
  onExecuteTrade,
}: TradeModalProps) {
  // Parse available maritime/bank trade actions into structured options
  const parsedTrades = useMemo(() => {
    const byGive: Partial<
      Record<
        ResourceCard,
        {
          rate: number;
          actionsByReceive: Partial<Record<ResourceCard, MaritimeTradeAction>>;
        }
      >
    > = {};

    for (const action of tradeActions) {
      const payload = action[2];
      const offeredList = payload
        .slice(0, 4)
        .filter((r): r is ResourceCard => r !== null);
      const giveRes = offeredList[0];
      const rate = offeredList.length;
      const receiveRes = payload[4] as ResourceCard | null;
      if (!giveRes || !receiveRes) continue;

      const existing = byGive[giveRes];
      if (!existing || rate < existing.rate) {
        byGive[giveRes] = {
          rate,
          actionsByReceive: {
            ...(existing?.actionsByReceive ?? {}),
            [receiveRes]: action,
          },
        };
      } else if (rate === existing.rate) {
        existing.actionsByReceive[receiveRes] = action;
      }
    }
    return byGive;
  }, [tradeActions]);

  const availableGiveResources = useMemo(
    () => RESOURCE_ORDER.filter((r) => !!parsedTrades[r]),
    [parsedTrades]
  );

  const [selectedGive, setSelectedGive] = useState<ResourceCard | null>(null);
  const [selectedReceive, setSelectedReceive] = useState<ResourceCard | null>(
    null
  );

  useEffect(() => {
    if (open) {
      const firstGive = availableGiveResources[0] ?? null;
      setSelectedGive(firstGive);
      if (firstGive) {
        const firstReceive =
          RESOURCE_ORDER.find(
            (r) => r !== firstGive && parsedTrades[firstGive]?.actionsByReceive[r]
          ) ?? null;
        setSelectedReceive(firstReceive);
      } else {
        setSelectedReceive(null);
      }
    }
  }, [open, availableGiveResources, parsedTrades]);

  const activeTradeOption =
    selectedGive && selectedReceive
      ? parsedTrades[selectedGive]?.actionsByReceive[selectedReceive]
      : undefined;

  const activeRate = selectedGive ? parsedTrades[selectedGive]?.rate : undefined;

  const handleConfirm = () => {
    if (activeTradeOption) {
      onExecuteTrade(activeTradeOption);
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        className: "catan-modal-paper trade-modal-paper",
      }}
    >
      <DialogTitle className="catan-modal-title">
        <span>⚓ Comércio Marítimo & Bancário</span>
        <small className="catan-modal-subtitle">
          Troque recursos com o banco (4:1) ou use seus portos costeiros (3:1 e 2:1)
        </small>
      </DialogTitle>

      <DialogContent className="catan-modal-content">
        <div className="trade-workbench">
          {/* Step 1: Resource to Give */}
          <div className="trade-section">
            <div className="trade-section__header">
              <span>1. Você Entrega</span>
              {selectedGive && activeRate && (
                <span className="trade-rate-badge">
                  Taxa ativa: <strong>{activeRate}:1</strong>{" "}
                  {activeRate === 2
                    ? "(Porto Especializado)"
                    : activeRate === 3
                      ? "(Porto 3:1)"
                      : "(Banco)"}
                </span>
              )}
            </div>
            <div className="trade-resource-grid">
              {RESOURCE_ORDER.map((res) => {
                const meta = RESOURCE_META[res];
                const inHand = playerState[`${playerKey}_${res}_IN_HAND`] ?? 0;
                const option = parsedTrades[res];
                const disabled = !option;
                const isSelected = selectedGive === res;

                return (
                  <button
                    key={res}
                    type="button"
                    disabled={disabled}
                    className={`trade-res-card ${isSelected ? "selected" : ""}`}
                    style={{
                      borderColor: isSelected ? meta.accentColor : undefined,
                    }}
                    onClick={() => {
                      setSelectedGive(res);
                      if (selectedReceive === res || !option?.actionsByReceive[selectedReceive!]) {
                        const nextRec =
                          RESOURCE_ORDER.find(
                            (r) => r !== res && option?.actionsByReceive[r]
                          ) ?? null;
                        setSelectedReceive(nextRec);
                      }
                    }}
                  >
                    <div className="trade-res-card__rate">
                      {option ? `${option.rate}:1` : "—"}
                    </div>
                    <ResourceIcon resource={res} size={32} />
                    <span className="trade-res-card__name">{meta.label}</span>
                    <span className="trade-res-card__hand">
                      Na mão: <strong>{inHand}</strong>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Exchange Summary Arrow */}
          <div className="trade-exchange-divider">
            {selectedGive && selectedReceive && activeRate ? (
              <div className="trade-summary-pill">
                <span>
                  Entregar <strong>{activeRate}x</strong>{" "}
                  {RESOURCE_META[selectedGive].label}
                </span>
                <span className="trade-summary-pill__arrow">➔</span>
                <span>
                  Receber <strong>1x</strong>{" "}
                  {RESOURCE_META[selectedReceive].label}
                </span>
              </div>
            ) : (
              <span>Selecione os recursos da troca</span>
            )}
          </div>

          {/* Step 2: Resource to Receive */}
          <div className="trade-section">
            <div className="trade-section__header">
              <span>2. Você Recebe (1 Carta)</span>
            </div>
            <div className="trade-resource-grid">
              {RESOURCE_ORDER.map((res) => {
                const meta = RESOURCE_META[res];
                const inHand = playerState[`${playerKey}_${res}_IN_HAND`] ?? 0;
                const canReceive =
                  !!selectedGive &&
                  res !== selectedGive &&
                  !!parsedTrades[selectedGive]?.actionsByReceive[res];
                const isSelected = selectedReceive === res;

                return (
                  <button
                    key={res}
                    type="button"
                    disabled={!canReceive}
                    className={`trade-res-card ${isSelected ? "selected" : ""}`}
                    style={{
                      borderColor: isSelected ? meta.accentColor : undefined,
                    }}
                    onClick={() => setSelectedReceive(res)}
                  >
                    <div className="trade-res-card__rate">+1</div>
                    <ResourceIcon resource={res} size={32} />
                    <span className="trade-res-card__name">{meta.label}</span>
                    <span className="trade-res-card__hand">
                      Na mão: <strong>{inHand}</strong>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>

      <DialogActions className="catan-modal-actions">
        <Button onClick={onClose} className="catan-btn-secondary">
          Cancelar
        </Button>
        <Button
          variant="contained"
          disabled={!activeTradeOption}
          onClick={handleConfirm}
          className="catan-btn-primary"
        >
          Confirmar Troca
        </Button>
      </DialogActions>
    </Dialog>
  );
}
