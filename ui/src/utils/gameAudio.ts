const MUSIC_VOLUME_KEY = "catanatron_music_volume_v1";
const EFFECTS_VOLUME_KEY = "catanatron_effects_volume_v1";
const LEGACY_MUTE_KEY = "catanatron_sound_muted";
const MUSIC_SRC = "/assets/audio/island-game-night-loop.ogg";
const DEFAULT_MUSIC_VOLUME = 35;
const DEFAULT_EFFECTS_VOLUME = 70;

type AudioPreferenceListener = () => void;

const listeners = new Set<AudioPreferenceListener>();
let music: HTMLAudioElement | null = null;
let musicUnlocked = false;
let musicVolumeMemory: number | null = null;
let effectsVolumeMemory: number | null = null;

function clampVolume(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function readVolume(key: string, fallback: number): number {
  try {
    if (typeof localStorage === "undefined") return fallback;
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return clampVolume(Number(raw), fallback);
  } catch {
    return fallback;
  }
}

function writeVolume(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Prefer usable in-memory audio when storage is unavailable.
  }
}

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

function getMusic(): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  if (!music) {
    music = new Audio(MUSIC_SRC);
    music.loop = true;
    music.preload = "auto";
  }
  return music;
}

function syncMusic(): void {
  const player = getMusic();
  if (!player) return;
  const volume = getMusicVolume();
  player.volume = volume / 100;
  if (volume === 0) {
    player.pause();
  } else if (musicUnlocked && player.paused) {
    void player.play().catch(() => {});
  }
}

export function getMusicVolume(): number {
  if (musicVolumeMemory !== null) return musicVolumeMemory;
  return readVolume(MUSIC_VOLUME_KEY, DEFAULT_MUSIC_VOLUME);
}

export function getEffectsVolume(): number {
  if (effectsVolumeMemory !== null) return effectsVolumeMemory;
  try {
    if (
      localStorage.getItem(EFFECTS_VOLUME_KEY) === null &&
      localStorage.getItem(LEGACY_MUTE_KEY) === "1"
    ) {
      return 0;
    }
  } catch {
    // Fall through to the default-aware reader.
  }
  return readVolume(EFFECTS_VOLUME_KEY, DEFAULT_EFFECTS_VOLUME);
}

export function setMusicVolume(value: number): void {
  musicVolumeMemory = clampVolume(value, DEFAULT_MUSIC_VOLUME);
  writeVolume(MUSIC_VOLUME_KEY, musicVolumeMemory);
  syncMusic();
  notifyListeners();
}

export function setEffectsVolume(value: number): void {
  const next = clampVolume(value, DEFAULT_EFFECTS_VOLUME);
  effectsVolumeMemory = next;
  writeVolume(EFFECTS_VOLUME_KEY, next);
  try {
    localStorage.removeItem(LEGACY_MUTE_KEY);
  } catch {
    // Ignore storage access errors.
  }
  notifyListeners();
}

export function subscribeAudioPreferences(listener: AudioPreferenceListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function unlockAndPlayMusic(): Promise<boolean> {
  if (musicUnlocked) return true;
  musicUnlocked = true;
  const player = getMusic();
  if (!player) {
    musicUnlocked = false;
    return false;
  }
  if (getMusicVolume() === 0) return true;
  player.volume = getMusicVolume() / 100;
  try {
    await player.play();
    return true;
  } catch {
    // Browsers may still reject playback until a later trusted interaction.
    musicUnlocked = false;
    return false;
  }
}

export function stopGameMusic(): void {
  music?.pause();
  musicUnlocked = false;
}

