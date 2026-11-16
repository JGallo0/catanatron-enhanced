import { useEffect, useState } from "react";
import Popover from "@mui/material/Popover";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import GraphicEqIcon from "@mui/icons-material/GraphicEq";

import type { AppLanguage } from "../i18n";
import {
  getEffectsVolume,
  getMusicVolume,
  setEffectsVolume,
  setMusicVolume,
  subscribeAudioPreferences,
} from "../utils/gameAudio";
import "./AudioSettingsPopover.scss";

interface AudioSettingsPopoverProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  language: AppLanguage;
}

export default function AudioSettingsPopover({
  open,
  anchorEl,
  onClose,
  language,
}: AudioSettingsPopoverProps) {
  const [music, setMusic] = useState(getMusicVolume);
  const [effects, setEffects] = useState(getEffectsVolume);
  const en = language === "en";

  useEffect(
    () =>
      subscribeAudioPreferences(() => {
        setMusic(getMusicVolume());
        setEffects(getEffectsVolume());
      }),
    []
  );

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "center", horizontal: "right" }}
      transformOrigin={{ vertical: "center", horizontal: "left" }}
      slotProps={{ paper: { className: "audio-settings-popover" } }}
    >
      <section className="audio-settings" aria-label={en ? "Game Audio" : "Áudio do Jogo"}>
        <header className="audio-settings__header">
          <span aria-hidden="true">♫</span>
          <h2>{en ? "Game Audio" : "Áudio do Jogo"}</h2>
        </header>

        <label className="audio-settings__control">
          <span className="audio-settings__label">
            <MusicNoteIcon fontSize="small" aria-hidden="true" />
            <span>{en ? "Music" : "Música"}</span>
            <output>{music}%</output>
          </span>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={music}
            aria-label={en ? "Music" : "Música"}
            onChange={(event) => {
              const value = Number(event.target.value);
              setMusic(value);
              setMusicVolume(value);
            }}
          />
        </label>

        <label className="audio-settings__control">
          <span className="audio-settings__label">
            <GraphicEqIcon fontSize="small" aria-hidden="true" />
            <span>{en ? "Effects" : "Efeitos"}</span>
            <output>{effects}%</output>
          </span>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={effects}
            aria-label={en ? "Effects" : "Efeitos"}
            onChange={(event) => {
              const value = Number(event.target.value);
              setEffects(value);
              setEffectsVolume(value);
            }}
          />
        </label>
      </section>
    </Popover>
  );
}

