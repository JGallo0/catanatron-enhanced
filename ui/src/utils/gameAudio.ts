const MUSIC_VOLUME_KEY = "catanatron_music_volume_v1";
const MUSIC_MUTED_KEY = "catanatron_music_muted_v1";
const EFFECTS_VOLUME_KEY = "catanatron_effects_volume_v1";
const LEGACY_MUTE_KEY = "catanatron_sound_muted";
const MUSIC_SRC = "/assets/audio/island-game-night-loop.ogg";
export const DEFAULT_MUSIC_VOLUME = 25;
export const DEFAULT_EFFECTS_VOLUME = 80;
const MUSIC_MAX_PLAYER_VOLUME = 0.22;
const MUSIC_VOLUME_CURVE_EXPONENT = 1.6;

type AudioPreferenceListener = () => void;

const listeners = new Set<AudioPreferenceListener>();
let music: HTMLAudioElement | null = null;
let musicUnlocked = false;
let musicVolumeMemory: number | null = null;
let musicMutedMemory: boolean | null = null;
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

function readFlag(key: string): boolean | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return raw === "1";
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Prefer usable in-memory audio when storage is unavailable.
  }
}

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

export function toPlayerMusicVolume(volume: number, muted = false): number {
  if (muted) return 0;
  const clamped = clampVolume(volume, DEFAULT_MUSIC_VOLUME);
  if (clamped <= 0) return 0;
  return Number(
    (
      MUSIC_MAX_PLAYER_VOLUME *
      Math.pow(clamped / 100, MUSIC_VOLUME_CURVE_EXPONENT)
    ).toFixed(4)
  );
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
  const muted = isMusicMuted();
  const playerVolume = toPlayerMusicVolume(getMusicVolume(), muted);
  player.muted = muted || playerVolume === 0;
  player.volume = playerVolume;
  if (player.muted) {
    player.pause();
  } else if (musicUnlocked && player.paused) {
    void player.play().catch(() => {});
  }
}

export function getMusicVolume(): number {
  if (musicVolumeMemory !== null) return musicVolumeMemory;
  return readVolume(MUSIC_VOLUME_KEY, DEFAULT_MUSIC_VOLUME);
}

export function isMusicMuted(): boolean {
  if (getMusicVolume() === 0) return true;
  if (musicMutedMemory !== null) return musicMutedMemory;
  return readFlag(MUSIC_MUTED_KEY) === true;
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
  const next = clampVolume(value, DEFAULT_MUSIC_VOLUME);
  musicVolumeMemory = next;
  musicMutedMemory = next === 0;
  writeStorage(MUSIC_VOLUME_KEY, String(next));
  writeStorage(MUSIC_MUTED_KEY, next === 0 ? "1" : "0");
  syncMusic();
  notifyListeners();
}

export function setMusicMuted(muted: boolean): void {
  const nextMuted = Boolean(muted);
  musicMutedMemory = nextMuted;
  writeStorage(MUSIC_MUTED_KEY, nextMuted ? "1" : "0");
  if (!nextMuted && getMusicVolume() === 0) {
    musicVolumeMemory = DEFAULT_MUSIC_VOLUME;
    writeStorage(MUSIC_VOLUME_KEY, String(DEFAULT_MUSIC_VOLUME));
  }
  syncMusic();
  notifyListeners();
}

export function toggleMusicMuted(): boolean {
  const nextMuted = !isMusicMuted();
  setMusicMuted(nextMuted);
  return nextMuted;
}

export function setEffectsVolume(value: number): void {
  const next = clampVolume(value, DEFAULT_EFFECTS_VOLUME);
  effectsVolumeMemory = next;
  writeStorage(EFFECTS_VOLUME_KEY, String(next));
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
  const muted = isMusicMuted();
  const playerVolume = toPlayerMusicVolume(getMusicVolume(), muted);
  player.muted = muted || playerVolume === 0;
  player.volume = playerVolume;
  if (player.muted) {
    player.pause();
    return true;
  }
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
