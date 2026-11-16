import { beforeEach, expect, test, vi } from "vitest";

const audioInstances: FakeAudio[] = [];

class FakeAudio {
  src = "";
  loop = false;
  preload = "";
  volume = 1;
  paused = true;
  play = vi.fn(async () => {
    this.paused = false;
  });
  pause = vi.fn(() => {
    this.paused = true;
  });

  constructor(src?: string) {
    this.src = src ?? "";
    audioInstances.push(this);
  }
}

beforeEach(async () => {
  localStorage.clear();
  audioInstances.length = 0;
  vi.resetModules();
  vi.stubGlobal("Audio", FakeAudio);
});

test("uses safe defaults and clamps persisted audio volumes", async () => {
  localStorage.setItem("catanatron_music_volume_v1", "not-a-number");
  localStorage.setItem("catanatron_effects_volume_v1", "250");
  const audio = await import("./gameAudio");

  expect(audio.getMusicVolume()).toBe(35);
  expect(audio.getEffectsVolume()).toBe(100);

  audio.setMusicVolume(-5);
  audio.setEffectsVolume(42.8);
  expect(audio.getMusicVolume()).toBe(0);
  expect(audio.getEffectsVolume()).toBe(43);
  expect(localStorage.getItem("catanatron_music_volume_v1")).toBe("0");
  expect(localStorage.getItem("catanatron_effects_volume_v1")).toBe("43");
});

test("notifies subscribers when either preference changes", async () => {
  const audio = await import("./gameAudio");
  const listener = vi.fn();
  const unsubscribe = audio.subscribeAudioPreferences(listener);

  audio.setMusicVolume(55);
  audio.setEffectsVolume(65);
  unsubscribe();
  audio.setMusicVolume(75);

  expect(listener).toHaveBeenCalledTimes(2);
});

test("creates one looping music instance and pauses or resumes from its volume", async () => {
  const audio = await import("./gameAudio");

  await audio.unlockAndPlayMusic();
  await audio.unlockAndPlayMusic();
  expect(audioInstances).toHaveLength(1);
  expect(audioInstances[0].src).toContain("/assets/audio/island-game-night-loop.ogg");
  expect(audioInstances[0].loop).toBe(true);
  expect(audioInstances[0].volume).toBeCloseTo(0.35);
  expect(audioInstances[0].play).toHaveBeenCalledTimes(1);

  audio.setMusicVolume(0);
  expect(audioInstances[0].pause).toHaveBeenCalledOnce();

  audio.setMusicVolume(40);
  expect(audioInstances[0].volume).toBeCloseTo(0.4);
  expect(audioInstances[0].play).toHaveBeenCalledTimes(2);
});

test("does not throw when the browser rejects music playback", async () => {
  const audio = await import("./gameAudio");
  await audio.unlockAndPlayMusic();
  audioInstances[0].play.mockRejectedValueOnce(new Error("autoplay blocked"));

  audio.setMusicVolume(50);
  await expect(audio.unlockAndPlayMusic()).resolves.toBeUndefined();
});

