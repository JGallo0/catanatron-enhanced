import { useContext, useState } from "react";
import { CircularProgress, Button } from "@mui/material";
import AssessmentIcon from "@mui/icons-material/Assessment";
import {
  type MCTSProbabilities,
  type StateIndex,
  getMctsAnalysis,
} from "../utils/apiClient";
import { useParams } from "react-router-dom";
import type { Color } from "../utils/api.types";
import { getPlayerColorMeta } from "../config/assetRegistry";
import { useLanguage } from "../i18n";

import "./AnalysisBox.scss";
import { store } from "../store";

type AnalysisBoxProps = {
  stateIndex: StateIndex;
};

export default function AnalysisBox({ stateIndex }: AnalysisBoxProps) {
  const { gameId } = useParams();
  const { state } = useContext(store);
  const { language, t } = useLanguage();
  const colorMeta = getPlayerColorMeta(language);
  const [mctsResults, setMctsResults] = useState<MCTSProbabilities | undefined>(
    undefined
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAnalyzeClick = async () => {
    if (!gameId || !state.gameState || state.gameState.winning_color) return;

    try {
      setLoading(true);
      setError("");
      const result = await getMctsAnalysis(gameId, stateIndex);
      if (result.success) {
        setMctsResults(result.probabilities);
      } else {
        setError(result.error || t("Falha na análise", "Analysis failed"));
      }
    } catch (err) {
      console.error("MCTS Analysis failed:", err);
      if (err instanceof Error) {
        setError(err.message);
      } else if (typeof err === "string") {
        setError(err);
      } else {
        setError(t("Ocorreu um erro inesperado", "An unexpected error occurred"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="analysis-box">
      <div className="analysis-header">
        <h3>{t("Chances de Vitória (IA MCTS)", "Win Probabilities (MCTS AI)")}</h3>
        <Button
          variant="contained"
          color="primary"
          onClick={handleAnalyzeClick}
          disabled={loading || !!state.gameState?.winning_color}
          startIcon={
            loading ? <CircularProgress size={20} /> : <AssessmentIcon />
          }
        >
          {loading ? t("Calculando...", "Calculating...") : t("Analisar", "Analyze")}
        </Button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {mctsResults && !loading && !error && (
        <div className="probability-bars">
          {Object.entries(mctsResults).map(([color, probability]) => (
            <div
              key={color}
              className={`probability-row ${color.toLowerCase()}`}
            >
              <span className="player-color">
                {colorMeta[color as Color]?.label || color}
              </span>
              <span className="probability-bar">
                <div
                  className="bar-fill"
                  style={{ width: `${probability}%` }}
                />
              </span>
              <span className="probability-value">{probability}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
