import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import AudioSettingsPopover from "./AudioSettingsPopover";

const audioState = vi.hoisted(() => ({ music: 35, effects: 70 }));
const setters = vi.hoisted(() => ({ music: vi.fn(), effects: vi.fn() }));

vi.mock("../utils/gameAudio", () => ({
  getMusicVolume: () => audioState.music,
  getEffectsVolume: () => audioState.effects,
  setMusicVolume: (value: number) => {
    audioState.music = value;
    setters.music(value);
  },
  setEffectsVolume: (value: number) => {
    audioState.effects = value;
    setters.effects(value);
  },
  subscribeAudioPreferences: () => () => {},
}));

beforeEach(() => {
  audioState.music = 35;
  audioState.effects = 70;
  setters.music.mockClear();
  setters.effects.mockClear();
});

function renderPopover(language: "pt-BR" | "en" = "pt-BR") {
  const anchor = document.createElement("button");
  document.body.appendChild(anchor);
  return render(
    <AudioSettingsPopover
      open
      anchorEl={anchor}
      onClose={vi.fn()}
      language={language}
    />
  );
}

test("shows independent music and effects controls with percentages", () => {
  renderPopover();

  expect(screen.getByRole("slider", { name: "Música" })).toHaveValue("35");
  expect(screen.getByRole("slider", { name: "Efeitos" })).toHaveValue("70");
  expect(screen.getByText("35%")) .toBeInTheDocument();
  expect(screen.getByText("70%")) .toBeInTheDocument();

  fireEvent.change(screen.getByRole("slider", { name: "Música" }), {
    target: { value: "52" },
  });

  expect(setters.music).toHaveBeenCalledWith(52);
  expect(setters.effects).not.toHaveBeenCalled();
});

test("renders English labels when the game language is English", () => {
  renderPopover("en");

  expect(screen.getByRole("heading", { name: "Game Audio" })).toBeInTheDocument();
  expect(screen.getByRole("slider", { name: "Music" })).toBeInTheDocument();
  expect(screen.getByRole("slider", { name: "Effects" })).toBeInTheDocument();
});

