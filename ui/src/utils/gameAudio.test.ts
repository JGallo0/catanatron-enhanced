import { beforeEach, expect, test, vi } from "vitest";

const audioInstances: FakeAudio[] = [];

class FakeAudio {
  src = "";
  loop = false;
  preload = "";
  volume = 1;
  muted = false;
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

test("uses balanced defaults and clamps persisted audio volumes", async () => {
  localStorage.setItem("catanatron_music_volume_v1", "not-a-number");
  localStorage.setItem("catanatron_effects_volume_v1", "250");
  const audio = await import("./gameAudio");

  expect(audio.DEFAULT_MUSIC_VOLUME).toBe(25);
  expect(audio.DEFAULT_EFFECTS_VOLUME).toBe(80);
  expect(audio.getMusicVolume()).toBe(25);
  expect(audio.getEffectsVolume()).toBe(100);
  expect(audio.isMusicMuted()).toBe(false);

  audio.setMusicVolume(-5);
  audio.setEffectsVolume(42.8);
  expect(audio.getMusicVolume()).toBe(0);
  expect(audio.isMusicMuted()).toBe(true);
  expect(audio.getEffectsVolume()).toBe(43);
  expect(localStorage.getItem("catanatron_music_volume_v1")).toBe("0");
  expect(localStorage.getItem("catanatron_effects_volume_v1")).toBe("43");
});

test("applies perceptual headroom curve to music so SFX stay clearly audible", async () => {
  const audio = await import("./gameAudio");

  expect(audio.toPlayerMusicVolume(0)).toBe(0);
  expect(audio.toPlayerMusicVolume(25)).toBeCloseTo(0.0239, 3);
  expect(audio.toPlayerMusicVolume(50)).toBeCloseTo(0.0726, 3);
  expect(audio.toPlayerMusicVolume(100)).toBeCloseTo(0.22, 3);
  expect(audio.toPlayerMusicVolume(50, true)).toBe(0);
});

test("notifies subscribers when either preference changes", async () => {
  const audio = await import("./gameAudio");
  const listener = vi.fn();
  const unsubscribe = audio.subscribeAudioPreferences(listener);

  audio.setMusicVolume(55);
  audio.setEffectsVolume(65);
  audio.setMusicMuted(true);
  unsubscribe();
  audio.setMusicVolume(75);

  expect(listener).toHaveBeenCalledTimes(3);
});

test("creates one looping music instance and mutes/pauses cleanly while preserving saved volume", async () => {
  const audio = await import("./gameAudio");

  await audio.unlockAndPlayMusic();
  await audio.unlockAndPlayMusic();
  expect(audioInstances).toHaveLength(1);
  expect(audioInstances[0].src).toContain("/assets/audio/island-game-night-loop.ogg");
  expect(audioInstances[0].loop).toBe(true);
  expect(audioInstances[0].muted).toBe(false);
  expect(audioInstances[0].volume).toBeCloseTo(0.0239, 3);
  expect(audioInstances[0].play).toHaveBeenCalledTimes(1);

  audio.setMusicMuted(true);
  expect(audio.isMusicMuted()).toBe(true);
  expect(audio.getMusicVolume()).toBe(25);
  expect(audioInstances[0].muted).toBe(true);
  expect(audioInstances[0].volume).toBe(0);
  expect(audioInstances[0].pause).toHaveBeenCalledOnce();
  expect(localStorage.getItem("catanatron_music_muted_v1")).toBe("1");

  audio.setMusicMuted(false);
  expect(audio.isMusicMuted()).toBe(false);
  expect(audio.getMusicVolume()).toBe(25);
  expect(audioInstances[0].muted).toBe(false);
  expect(audioInstances[0].volume).toBeCloseTo(0.0239, 3);
  expect(audioInstances[0].play).toHaveBeenCalledTimes(2);

  audio.setMusicVolume(40);
  expect(audioInstances[0].volume).toBeCloseTo(audio.toPlayerMusicVolume(40), 4);
});

test("keeps music silent during unlock when previously muted", async () => {
  localStorage.setItem("catanatron_music_muted_v1", "1");
  const audio = await import("./gameAudio");

  expect(audio.isMusicMuted()).toBe(true);
  await expect(audio.unlockAndPlayMusic()).resolves.toBe(true);
  expect(audioInstances[0].muted).toBe(true);
  expect(audioInstances[0].volume).toBe(0);
  expect(audioInstances[0].play).not.toHaveBeenCalled();

  audio.setMusicVolume(30);
  expect(audio.isMusicMuted()).toBe(false);
  expect(audioInstances[0].muted).toBe(false);
  expect(audioInstances[0].play).toHaveBeenCalledTimes(1);
});

test("does not throw when the browser rejects music playback", async () => {
  const audio = await import("./gameAudio");
  await audio.unlockAndPlayMusic();
  audioInstances[0].play.mockRejectedValueOnce(new Error("autoplay blocked"));

  audio.setMusicVolume(50);
  await expect(audio.unlockAndPlayMusic()).resolves.toBe(true);
});

test("keeps applied volumes in memory when localStorage writes fail", async () => {
  const audio = await import("./gameAudio");
  const setItem = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => { throw new DOMException("quota", "QuotaExceededError"); });

  audio.setMusicVolume(0);
  audio.setEffectsVolume(22);

  expect(audio.getMusicVolume()).toBe(0);
  expect(audio.isMusicMuted()).toBe(true);
  expect(audio.getEffectsVolume()).toBe(22);
  setItem.mockRestore();
});

test("keeps music off by default in lobby mode until user chooses play", async () => {
  const audio = await import("./gameAudio");

  await audio.unlockAndPlayMusic();
  expect(audioInstances[0].paused).toBe(false);

  audio.enterLobbyAudioMode();
  expect(audio.isLobbyMusicPlaying()).toBe(false);
  expect(audio.isMusicMuted()).toBe(false);
  expect(audioInstances[0].paused).toBe(true);

  await audio.setLobbyMusicPlaying(true);
  expect(audio.isLobbyMusicPlaying()).toBe(true);
  expect(audioInstances[0].muted).toBe(false);
  expect(audioInstances[0].paused).toBe(false);

  await audio.setLobbyMusicPlaying(false);
  expect(audio.isLobbyMusicPlaying()).toBe(false);
  expect(audio.isMusicMuted()).toBe(false);
  expect(audioInstances[0].paused).toBe(true);
});

test("falls back safely when access to the localStorage property throws", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get: () => { throw new DOMException("blocked", "SecurityError"); },
  });

  try {
    const audio = await import("./gameAudio");
    expect(audio.getMusicVolume()).toBe(25);
    expect(audio.getEffectsVolume()).toBe(80);
    expect(audio.isMusicMuted()).toBe(false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
  }
});
