import { useEffect, useRef, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
import type { ResourceCard } from "../utils/api.types";
import { getResourceMeta } from "../config/assetRegistry";
import { useLanguage } from "../i18n";
import { CardArtIllustration } from "./icons/GameIcons";
import "./ResourceSelector.scss";

type SelectorOption = ResourceCard | ResourceCard[];
type ResourceSelectorProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (option: SelectorOption) => Promise<void> | void;
  options: SelectorOption[];
  mode: "monopoly" | "yearOfPlenty";
};
const RESOURCES: ResourceCard[] = ["WOOD", "BRICK", "SHEEP", "WHEAT", "ORE"];
const contains = (option: ResourceCard[], selected: ResourceCard[]) =>
  RESOURCES.every((r) => option.filter((v) => v === r).length >= selected.filter((v) => v === r).length);

export default function ResourceSelector({ open, onClose, options, onSelect, mode }: ResourceSelectorProps) {
  const { language } = useLanguage();
  const meta = getResourceMeta(language);
  const [selected, setSelected] = useState<ResourceCard[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  useEffect(() => { if (open) { setSelected([]); setError(""); } }, [open, mode]);
  const available = mode === "monopoly" ? RESOURCES.map((r) => [r]) : options.filter(Array.isArray) as ResourceCard[][];
  const target = Math.max(0, ...available.map((o) => o.length));
  const valid = available.filter((o) => o.length === target);
  // Preserve the engine's ordering; the API validates the exact legal action tuple.
  const chosen = valid.find((o) => o.length === selected.length && contains(o, selected));
  const confirm = async () => {
    if (!chosen || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try { await onSelect(mode === "monopoly" ? chosen[0] : chosen); onClose(); }
    catch { setError("Não foi possível receber os recursos. Tente novamente."); }
    finally { submitting.current = false; setBusy(false); }
  };
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth className="resource-selector" PaperProps={{ className: "catan-modal-paper" }}>
      <DialogTitle className="catan-modal-title">{mode === "monopoly" ? "Monopólio" : "Ano da Fartura"}</DialogTitle>
      <DialogContent className="catan-modal-content">
        <p>{mode === "monopoly" ? "Escolha o recurso que deseja monopolizar." : "Escolha duas cartas. Clique duas vezes na mesma carta para receber dois recursos iguais."}</p>
        {mode === "yearOfPlenty" && target < 2 && <p>O banco só tem {target} recurso disponível.</p>}
        <div className="resource-picker">
          {RESOURCES.map((r) => {
            const count = selected.filter((v) => v === r).length;
            const canAdd = valid.some((o) => contains(o, [...selected, r]));
            return <button key={r} type="button" className={`resource-picker__card ${count ? "is-selected" : ""}`}
              aria-label={`Selecionar ${meta[r].label}`} aria-pressed={count > 0} disabled={busy || !canAdd}
              onClick={() => setSelected((prev) => [...prev, r])}>
              <CardArtIllustration resource={r} className="resource-picker__art" />
              <strong>{meta[r].label}</strong><span className="resource-picker__count">{count ? `×${count}` : "+"}</span>
            </button>;
          })}
        </div>
        <div className="resource-picker__selection" aria-live="polite">
          <strong>{selected.length}/{target} selecionadas</strong>
          <span>{selected.map((r) => meta[r].label).join(" + ") || "Nenhuma carta selecionada"}</span>
        </div>
        {error && <p role="alert">{error}</p>}
      </DialogContent>
      <DialogActions className="catan-modal-actions">
        <Button onClick={onClose} disabled={busy}>Cancelar</Button>
        <Button onClick={() => setSelected((prev) => prev.slice(0, -1))} disabled={busy || !selected.length}>Desfazer</Button>
        <Button className="catan-btn-primary" variant="contained" disabled={busy || !chosen || selected.length !== target || !target} onClick={confirm}>Confirmar recursos</Button>
      </DialogActions>
    </Dialog>
  );
}
