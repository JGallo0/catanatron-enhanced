import { useEffect, useRef, useState } from "react";
import Popover from "@mui/material/Popover";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import MusicOffIcon from "@mui/icons-material/MusicOff";
import GraphicEqIcon from "@mui/icons-material/GraphicEq";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";

import type { AppLanguage } from "../i18n";
import {
  DEFAULT_EFFECTS_VOLUME,
  DEFAULT_MUSIC_VOLUME,
  getEffectsVolume,
  getMusicVolume,
  isLobbyMusicPlaying,
  isMusicMuted,
  setEffectsVolume,
  setLobbyMusicPlaying,
  setMusicMuted,
  setMusicVolume,
  subscribeAudioPreferences,
} from "../utils/gameAudio";
import "./AudioSettingsPopover.scss";

interface AudioSettingsPopoverProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  language: AppLanguage;
  context?: "lobby" | "game";
}

export default function AudioSettingsPopover({
  open,
  anchorEl,
  onClose,
  language,
  context = "game",
}: AudioSettingsPopoverProps) {
  const [music, setMusic] = useState(getMusicVolume);
  const [musicMuted, setMusicMutedState] = useState(isMusicMuted);
  const [lobbyPlaying, setLobbyPlayingState] = useState(
    () => isLobbyMusicPlaying?.() ?? false
  );
  const [effects, setEffects] = useState(getEffectsVolume);
  const lastAudibleEffectsRef = useRef(
    getEffectsVolume() > 0 ? getEffectsVolume() : DEFAULT_EFFECTS_VOLUME
  );
  const en = language === "en";
  const isLobby = context === "lobby";

  useEffect(
    () =>
      subscribeAudioPreferences(() => {
        const nextMusic = getMusicVolume();
        const nextMuted = isMusicMuted();
        const nextLobbyPlaying = isLobbyMusicPlaying?.() ?? false;
        const nextEffects = getEffectsVolume();
        setMusic(nextMusic);
        setMusicMutedState(nextMuted);
        setLobbyPlayingState(nextLobbyPlaying);
        setEffects(nextEffects);
        if (nextEffects > 0) {
          lastAudibleEffectsRef.current = nextEffects;
        }
      }),
    []
  );

  const effectiveMusicMuted = isLobby ? !lobbyPlaying || musicMuted : musicMuted;
  const effectsMuted = effects === 0;
  const displayedMusic = effectiveMusicMuted ? 0 : music;

  const handleToggleMusicMute = () => {
    if (isLobby) {
      const nextPlaying = effectiveMusicMuted;
      setLobbyPlayingState(nextPlaying);
      if (nextPlaying && music === 0) {
        setMusic(DEFAULT_MUSIC_VOLUME);
      }
      setMusicMutedState(!nextPlaying && music === 0);
      void setLobbyMusicPlaying?.(nextPlaying);
      return;
    }
    const nextMuted = !musicMuted;
    setMusicMuted(nextMuted);
    setMusicMutedState(nextMuted);
    if (!nextMuted && music === 0) {
      setMusic(DEFAULT_MUSIC_VOLUME);
    }
  };

  const handleToggleEffectsMute = () => {
    if (effectsMuted) {
      const restored = lastAudibleEffectsRef.current || DEFAULT_EFFECTS_VOLUME;
      setEffects(restored);
      setEffectsVolume(restored);
    } else {
      lastAudibleEffectsRef.current = effects;
      setEffects(0);
      setEffectsVolume(0);
    }
  };

  const musicStatusText = effectiveMusicMuted
    ? isLobby
      ? en
        ? "Off"
        : "Desativada"
      : en
        ? "Muted"
        : "Mutada"
    : `${music}%`;

  const musicToggleLabel = isLobby
    ? effectiveMusicMuted
      ? en
        ? "Play music"
        : "Reproduzir música"
      : en
        ? "Mute music"
        : "Mutar música"
    : effectiveMusicMuted
      ? en
        ? "Unmute music"
        : "Desmutar música"
      : en
        ? "Mute music"
        : "Mutar música";

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

        <div className={`audio-settings__control${effectiveMusicMuted ? " is-muted" : ""}`}>
          <div className="audio-settings__row">
            <label className="audio-settings__label" htmlFor="audio-music-slider">
              {effectiveMusicMuted ? (
                <MusicOffIcon fontSize="small" aria-hidden="true" />
              ) : (
                <MusicNoteIcon fontSize="small" aria-hidden="true" />
              )}
              <span>{en ? "Music" : "Música"}</span>
              <output htmlFor="audio-music-slider">{musicStatusText}</output>
            </label>
            <button
              type="button"
              className={`audio-settings__mute-btn${effectiveMusicMuted ? " is-muted" : ""}`}
              aria-pressed={isLobby ? lobbyPlaying && !musicMuted : musicMuted}
              aria-label={musicToggleLabel}
              onClick={handleToggleMusicMute}
            >
              {effectiveMusicMuted ? (
                isLobby ? (
                  <>
                    <PlayArrowIcon fontSize="inherit" aria-hidden="true" />
                    <span>{en ? "Play" : "Reproduzir"}</span>
                  </>
                ) : (
                  <>
                    <MusicNoteIcon fontSize="inherit" aria-hidden="true" />
                    <span>{en ? "Unmute" : "Ativar"}</span>
                  </>
                )
              ) : (
                <>
                  <MusicOffIcon fontSize="inherit" aria-hidden="true" />
                  <span>{en ? "Mute" : "Mutar"}</span>
                </>
              )}
            </button>
          </div>
          <input
            id="audio-music-slider"
            type="range"
            min="0"
            max="100"
            step="1"
            value={displayedMusic}
            aria-label={en ? "Music" : "Música"}
            onChange={(event) => {
              const value = Number(event.target.value);
              setMusic(value);
              setMusicMutedState(value === 0);
              setMusicVolume(value);
              if (isLobby) {
                setLobbyPlayingState(value > 0);
                void setLobbyMusicPlaying?.(value > 0);
              }
            }}
          />
        </div>

        <div className={`audio-settings__control${effectsMuted ? " is-muted" : ""}`}>
          <div className="audio-settings__row">
            <label className="audio-settings__label" htmlFor="audio-effects-slider">
              <GraphicEqIcon fontSize="small" aria-hidden="true" />
              <span>{en ? "Effects" : "Efeitos"}</span>
              <output htmlFor="audio-effects-slider">
                {effectsMuted ? (en ? "Muted" : "Mudo") : `${effects}%`}
              </output>
            </label>
            <button
              type="button"
              className={`audio-settings__mute-btn${effectsMuted ? " is-muted" : ""}`}
              aria-pressed={effectsMuted}
              aria-label={
                en
                  ? effectsMuted
                    ? "Unmute effects"
                    : "Mute effects"
                  : effectsMuted
                    ? "Desmutar efeitos"
                    : "Mutar efeitos"
              }
              onClick={handleToggleEffectsMute}
            >
              {effectsMuted ? (
                <>
                  <VolumeUpIcon fontSize="inherit" aria-hidden="true" />
                  <span>{en ? "Unmute" : "Ativar"}</span>
                </>
              ) : (
                <>
                  <VolumeOffIcon fontSize="inherit" aria-hidden="true" />
                  <span>{en ? "Mute" : "Mutar"}</span>
                </>
              )}
            </button>
          </div>
          <input
            id="audio-effects-slider"
            type="range"
            min="0"
            max="100"
            step="1"
            value={effects}
            aria-label={en ? "Effects" : "Efeitos"}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (value > 0) {
                lastAudibleEffectsRef.current = value;
              }
              setEffects(value);
              setEffectsVolume(value);
            }}
          />
        </div>
      </section>
    </Popover>
  );
}
