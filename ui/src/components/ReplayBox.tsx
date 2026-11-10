import { ArrowBackIos, ArrowForwardIos } from "@mui/icons-material";
import { Button, Slider } from "@mui/material";

import "./ReplayBox.scss";
import { useState } from "react";
import NumericTextInput from "./NumericTextInput";

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
      <h3>Replay da Partida</h3>

      Jogada: {stateIndex} / {latestStateIndex}

      <Slider
        className="move-slider"
        min={0}
        max={latestStateIndex}
        step={1}
        value={stateIndex}
        onChange={(_, value) => onSeekMove(value as number)}
      />

      <NumericTextInput
        label="Ir para a jogada"
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
          Anterior
        </Button>

        <Button
          variant="contained"
          color="primary"
          onClick={onNextMove}
          startIcon={<ArrowForwardIos />}
          disabled={stateIndex === latestStateIndex}
        >
          Próxima
        </Button>
      </div>
    </div>
  );
}
