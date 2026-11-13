import React from "react";
import cn from "classnames";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import type { ResourceCard } from "../utils/api.types";
import { getResourceMeta } from "../config/assetRegistry";
import { useLanguage } from "../i18n";
import { CardArtIllustration, ResourceIcon } from "./icons/GameIcons";
import "./DiscardPlannerDialog.scss";

type DiscardResourceCounts = Partial<Record<ResourceCard, number>>;

type DiscardPlannerDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (resources: ResourceCard[]) => void;
  remainingDiscardCount: number;
  discardResourceCounts: DiscardResourceCounts;
  submitting?: boolean;
};

const RESOURCE_ORDER: ResourceCard[] = [
  "WOOD",
  "BRICK",
  "SHEEP",
  "WHEAT",
  "ORE",
];

export default function DiscardPlannerDialog({
  open,
  onClose,
  onConfirm,
  remainingDiscardCount,
  discardResourceCounts,
  submitting = false,
}: DiscardPlannerDialogProps) {
  const { language, t } = useLanguage();
  const resourceMeta = getResourceMeta(language);
  const [discardSelections, setDiscardSelections] = React.useState<
    ResourceCard[]
  >([]);

  React.useEffect(() => {
    if (!open) {
      setDiscardSelections([]);
    }
  }, [open]);

  const selectedCount = discardSelections.length;
  const selectedResourceCount = (resource: ResourceCard) =>
    discardSelections.filter((selection) => selection === resource).length;

  const canSelectResource = (resource: ResourceCard) => {
    const availableCount = discardResourceCounts[resource] ?? 0;
    return (
      selectedCount < remainingDiscardCount &&
      selectedResourceCount(resource) < availableCount
    );
  };

  const addDiscardSelection = (resource: ResourceCard) => {
    if (!canSelectResource(resource) || submitting) {
      return;
    }
    setDiscardSelections((current) => [...current, resource]);
  };

  const removeDiscardSelection = (resource: ResourceCard) => {
    setDiscardSelections((current) => {
      const index = current.lastIndexOf(resource);
      if (index === -1) {
        return current;
      }
      return [...current.slice(0, index), ...current.slice(index + 1)];
    });
  };

  const groupedDiscardSelections = RESOURCE_ORDER.map((resource) => ({
    resource,
    count: selectedResourceCount(resource),
  })).filter(({ count }) => count > 0);

  const progressPercent =
    remainingDiscardCount > 0
      ? Math.min(100, Math.round((selectedCount / remainingDiscardCount) * 100))
      : 0;

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      className="discard-planner-dialog"
      maxWidth="md"
      fullWidth
    >
      <DialogTitle className="discard-planner-header">
        <div className="discard-planner-header__title">
          <span className="discard-planner-header__icon" aria-hidden="true">
            ⚔️
          </span>
          <span>{t("Descartar Recursos (Ladrão)", "Discard Resources (Robber)")}</span>
        </div>
        <Typography variant="body2" className="discard-planner-header__subtitle">
          {selectedCount === 0
            ? t(
                `Um 7 foi tirado nos dados! Escolha ${remainingDiscardCount} carta${remainingDiscardCount === 1 ? "" : "s"} da sua mão para descartar.`,
                `A 7 was rolled! Select ${remainingDiscardCount} card${remainingDiscardCount === 1 ? "" : "s"} from your hand to discard.`
              )
            : t(
                `${selectedCount} de ${remainingDiscardCount} carta${remainingDiscardCount === 1 ? "" : "s"} selecionada${selectedCount === 1 ? "" : "s"}.`,
                `${selectedCount} of ${remainingDiscardCount} card${remainingDiscardCount === 1 ? "" : "s"} selected.`
              )}
        </Typography>

        {/* Progress Bar */}
        <div className="discard-progress-track">
          <div
            className="discard-progress-bar"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </DialogTitle>

      <DialogContent className="discard-planner-content">
        {/* Selected cards rack */}
        <div className="discard-summary-rack">
          <span className="discard-summary-rack__label">
            {t("Cartas para descarte:", "Cards to discard:")}
          </span>
          {groupedDiscardSelections.length > 0 ? (
            <div className="discard-summary-rack__chips">
              {groupedDiscardSelections.map(({ resource, count }) => (
                <button
                  key={resource}
                  type="button"
                  className="discard-rack-chip"
                  onClick={() => removeDiscardSelection(resource)}
                  disabled={submitting}
                  title={t("Clique para remover", "Click to remove")}
                >
                  <ResourceIcon resource={resource} size={14} />
                  <span>
                    {resourceMeta[resource].label} ×{count}
                  </span>
                  <span className="discard-rack-chip__remove" aria-hidden="true">
                    ✕
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <span className="discard-summary-rack__empty">
              {t("Nenhuma carta selecionada", "No cards selected yet")}
            </span>
          )}
        </div>

        {/* Real Cards Selection Grid */}
        <div className="discard-cards-grid">
          {RESOURCE_ORDER.map((resource) => {
            const inHandCount = discardResourceCounts[resource] ?? 0;
            const discardedCount = selectedResourceCount(resource);
            const canAdd = canSelectResource(resource) && !submitting;
            const canRemove = discardedCount > 0 && !submitting;
            const meta = resourceMeta[resource];
            const hasNone = inHandCount === 0;

            return (
              <div
                key={resource}
                className={cn("discard-card-wrapper", {
                  "is-empty": hasNone,
                  "is-selected": discardedCount > 0,
                  "is-selectable": canAdd,
                })}
              >
                <div
                  className="discard-card"
                  style={{
                    borderColor:
                      discardedCount > 0
                        ? "#f43f5e"
                        : hasNone
                        ? "rgba(148, 163, 184, 0.2)"
                        : meta.borderColor,
                    background: `linear-gradient(160deg, ${meta.secondaryColor} 0%, ${meta.primaryColor} 100%)`,
                  }}
                  onClick={() => {
                    if (canAdd) addDiscardSelection(resource);
                    else if (canRemove) removeDiscardSelection(resource);
                  }}
                  role="button"
                  tabIndex={hasNone ? -1 : 0}
                  aria-label={`${meta.label}: ${inHandCount} em mãos, ${discardedCount} para descartar`}
                >
                  {/* Real Card Illustration */}
                  <CardArtIllustration
                    resource={resource}
                    className="discard-card__art"
                  />

                  {/* Card Chrome & Badges */}
                  <div className="discard-card__top">
                    <span className="discard-card__icon-badge">
                      <ResourceIcon resource={resource} size={15} />
                    </span>
                    <span
                      className={cn("discard-card__hand-badge", {
                        "is-zero": inHandCount === 0,
                      })}
                      title={t("Quantidade em mãos", "In hand")}
                    >
                      {inHandCount}
                    </span>
                  </div>

                  {/* Selected count banner */}
                  {discardedCount > 0 && (
                    <div className="discard-card__discard-badge">
                      <span>-{discardedCount}</span>
                    </div>
                  )}

                  <div className="discard-card__bottom">
                    <span className="discard-card__label">{meta.label}</span>
                  </div>
                </div>

                {/* Card Stepper Controls (+ / -) */}
                <div className="discard-card-stepper">
                  <button
                    type="button"
                    className="discard-stepper-btn discard-stepper-btn--minus"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeDiscardSelection(resource);
                    }}
                    disabled={!canRemove}
                    aria-label={`Remover 1 ${meta.label}`}
                  >
                    −
                  </button>
                  <span className="discard-stepper-val">
                    {discardedCount} / {inHandCount}
                  </span>
                  <button
                    type="button"
                    className="discard-stepper-btn discard-stepper-btn--plus"
                    onClick={(e) => {
                      e.stopPropagation();
                      addDiscardSelection(resource);
                    }}
                    disabled={!canAdd}
                    aria-label={`Adicionar 1 ${meta.label}`}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>

      <DialogActions className="discard-planner-actions">
        <Button
          onClick={() => setDiscardSelections([])}
          className="discard-action-btn discard-action-btn--clear"
          disabled={submitting || selectedCount === 0}
        >
          {t("Limpar", "Clear")}
        </Button>
        <Button
          onClick={onClose}
          className="discard-action-btn discard-action-btn--cancel"
          disabled={submitting}
        >
          {t("Fechar", "Close")}
        </Button>
        <Button
          variant="contained"
          onClick={() => onConfirm(discardSelections)}
          className="discard-action-btn discard-action-btn--confirm"
          disabled={submitting || selectedCount !== remainingDiscardCount}
        >
          {t("Confirmar Descarte", "Confirm Discard")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
