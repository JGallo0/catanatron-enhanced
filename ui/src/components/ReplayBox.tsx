import ArrowBackIos from "@mui/icons-material/ArrowBackIos";
import ArrowForwardIos from "@mui/icons-material/ArrowForwardIos";
import { Button, Slider } from "@mui/material";

import "./ReplayBox.scss";
import { useState } from "react";
import NumericTextInput from "./NumericTextInput";
import { useLanguage } from "../i18n";

type ReplayBoxProps = {
  stateIndex: number;
  latestStateIndex: number;
  onPrevMove: () => void;
  onNextMove: () => void;
  onSeekMove: (value: number) => void;
};

export default function ReplayBox({
  stateIndex,
  latestStateIndex,
  onPrevMove,
  onNextMove,
  onSeekMove,
}: ReplayBoxProps) {
  const { t } = useLanguage();
  const [inputValue, setInputValue] = useState<string>(String(stateIndex));

  const commitInput = () => {
    if (inputValue.trim() === "") {
      setInputValue(String(stateIndex));
      return;
    }
    const parsed = Number(inputValue);
    if (!Number.isFinite(parsed)) {
      setInputValue(String(stateIndex));
      return;
    }
    const next = Math.max(0, Math.min(latestStateIndex, Math.trunc(parsed)));
    setInputValue(String(next));
    if (next !== stateIndex) onSeekMove(next);
  };

  return (
    <div className="replay-box">
      <h3>{t("Replay da Partida", "Match Replay")}</h3>

      {t("Jogada", "Move")}: {stateIndex} / {latestStateIndex}

      <Slider
        className="move-slider"
        aria-label={t("Linha do tempo da partida", "Match move timeline")}
        min={0}
        max={latestStateIndex}
        step={1}
        value={stateIndex}
        onChange={(_, value) => onSeekMove(value as number)}
      />

      <NumericTextInput
        label={t("Ir para a jogada", "Go to move")}
        size="small"
        value={inputValue}
        onChange={setInputValue}
        onCommit={commitInput}
      />

      <div className="button-container">
        <Button
          variant="contained"
          color="primary"
          onClick={onPrevMove}
          startIcon={<ArrowBackIos />}
          disabled={stateIndex === 0}
        >
          {t("Anterior", "Previous")}
        </Button>

        <Button
          variant="contained"
          color="primary"
          onClick={onNextMove}
          startIcon={<ArrowForwardIos />}
          disabled={stateIndex === latestStateIndex}
        >
          {t("Próxima", "Next")}
        </Button>
      </div>
    </div>
  );
}
