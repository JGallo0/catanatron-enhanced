import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import AudioSettingsPopover from "./AudioSettingsPopover";

const audioState = vi.hoisted(() => ({
  music: 25,
  musicMuted: false,
  lobbyPlaying: false,
  effects: 80,
}));
const setters = vi.hoisted(() => ({
  music: vi.fn(),
  musicMuted: vi.fn(),
  lobbyPlaying: vi.fn(),
  effects: vi.fn(),
}));

vi.mock("../utils/gameAudio", () => ({
  DEFAULT_MUSIC_VOLUME: 25,
  DEFAULT_EFFECTS_VOLUME: 80,
  getMusicVolume: () => audioState.music,
  isMusicMuted: () => audioState.musicMuted || audioState.music === 0,
  isLobbyMusicPlaying: () => audioState.lobbyPlaying && !audioState.musicMuted && audioState.music > 0,
  getEffectsVolume: () => audioState.effects,
  setMusicVolume: (value: number) => {
    audioState.music = value;
    audioState.musicMuted = value === 0;
    if (value === 0) audioState.lobbyPlaying = false;
    setters.music(value);
  },
  setMusicMuted: (muted: boolean) => {
    audioState.musicMuted = muted;
    if (muted) audioState.lobbyPlaying = false;
    if (!muted && audioState.music === 0) audioState.music = 25;
    setters.musicMuted(muted);
  },
  setLobbyMusicPlaying: (playing: boolean) => {
    audioState.lobbyPlaying = playing;
    if (playing && (audioState.musicMuted || audioState.music === 0)) {
      audioState.musicMuted = false;
      if (audioState.music === 0) audioState.music = 25;
    }
    setters.lobbyPlaying(playing);
    return Promise.resolve(true);
  },
  setEffectsVolume: (value: number) => {
    audioState.effects = value;
    setters.effects(value);
  },
  subscribeAudioPreferences: () => () => {},
}));

afterEach(cleanup);

beforeEach(() => {
  audioState.music = 25;
  audioState.musicMuted = false;
  audioState.lobbyPlaying = false;
  audioState.effects = 80;
  setters.music.mockClear();
  setters.musicMuted.mockClear();
  setters.lobbyPlaying.mockClear();
  setters.effects.mockClear();
});

function renderPopover(
  language: "pt" | "en" = "pt",
  context: "lobby" | "game" = "game"
) {
  const anchor = document.createElement("button");
  document.body.appendChild(anchor);
  return render(
    <AudioSettingsPopover
      open
      anchorEl={anchor}
      onClose={vi.fn()}
      language={language}
      context={context}
    />
  );
}

test("shows balanced defaults, sliders, and mute toggle for music and effects", () => {
  renderPopover();

  expect(screen.getByRole("slider", { name: "Música" })).toHaveValue("25");
  expect(screen.getByRole("slider", { name: "Efeitos" })).toHaveValue("80");
  expect(screen.getByText("25%")).toBeInTheDocument();
  expect(screen.getByText("80%")).toBeInTheDocument();

  const muteMusicBtn = screen.getByRole("button", { name: "Mutar música" });
  expect(muteMusicBtn).toHaveAttribute("aria-pressed", "false");

  fireEvent.click(muteMusicBtn);
  expect(setters.musicMuted).toHaveBeenCalledWith(true);
  expect(screen.getByText("Mutada")).toBeInTheDocument();
  expect(screen.getByRole("slider", { name: "Música" })).toHaveValue("0");
  expect(screen.getByRole("button", { name: "Desmutar música" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );

  fireEvent.click(screen.getByRole("button", { name: "Desmutar música" }));
  expect(setters.musicMuted).toHaveBeenCalledWith(false);
  expect(screen.getByText("25%")).toBeInTheDocument();

  fireEvent.change(screen.getByRole("slider", { name: "Música" }), {
    target: { value: "52" },
  });
  expect(setters.music).toHaveBeenCalledWith(52);
  expect(setters.effects).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Mutar efeitos" }));
  expect(setters.effects).toHaveBeenCalledWith(0);
  fireEvent.click(screen.getByRole("button", { name: "Desmutar efeitos" }));
  expect(setters.effects).toHaveBeenLastCalledWith(80);
});

test("starts lobby music off by default and offers explicit play/mute toggle", () => {
  renderPopover("pt", "lobby");

  expect(screen.getByText("Desativada")).toBeInTheDocument();
  expect(screen.getByRole("slider", { name: "Música" })).toHaveValue("0");

  const playBtn = screen.getByRole("button", { name: "Reproduzir música" });
  expect(playBtn).toHaveAttribute("aria-pressed", "false");

  fireEvent.click(playBtn);
  expect(setters.lobbyPlaying).toHaveBeenCalledWith(true);
  expect(screen.getByText("25%")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Mutar música" })).toBeInTheDocument();
});

test("renders English labels and lobby play controls when the game language is English", () => {
  renderPopover("en", "lobby");

  expect(screen.getByRole("heading", { name: "Game Audio" })).toBeInTheDocument();
  expect(screen.getByText("Off")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Play music" })).toBeInTheDocument();
  expect(screen.getByRole("slider", { name: "Effects" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Mute effects" })).toBeInTheDocument();
});
