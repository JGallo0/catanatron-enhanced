import type { GameActionRecord } from "./api.types";
import {
  DEFAULT_EFFECTS_VOLUME,
  getEffectsVolume,
  setEffectsVolume,
} from "./gameAudio";

const MUTE_KEY = "catanatron_sound_muted";
const EFFECTS_GAIN_BOOST = 4.0;
const MAX_TONE_GAIN = 0.95;

export const SFX_PATHS = {
  dice: "/assets/audio/sfx/dice-roll.ogg",
  buildRoad: "/assets/audio/sfx/build-road.ogg",
  buildSettlement: "/assets/audio/sfx/build-settlement.ogg",
  buildCity: "/assets/audio/sfx/build-city.ogg",
  buyDevCard: "/assets/audio/sfx/buy-dev-card.ogg",
  playDevCard: "/assets/audio/sfx/play-dev-card.ogg",
  playKnight: "/assets/audio/sfx/play-knight.ogg",
  playPlentyMonopoly: "/assets/audio/sfx/play-plenty-monopoly.ogg",
  robberMove: "/assets/audio/sfx/robber-move.ogg",
  stealCard: "/assets/audio/sfx/steal-card.ogg",
  discardCard: "/assets/audio/sfx/discard-card.ogg",
  chat: "/assets/audio/sfx/chat.ogg",
  invalidAction: "/assets/audio/sfx/invalid-action.ogg",
  awardRoad: "/assets/audio/sfx/award-road.ogg",
  awardArmy: "/assets/audio/sfx/award-army.ogg",
  victory: "/assets/audio/sfx/victory.ogg",
} as const;

let audioCtx: AudioContext | null = null;
let compressorNode: AudioNode | null = null;
let compressorOwnerCtx: AudioContext | null = null;

function getEffectsDestination(ctx: AudioContext): AudioNode {
  if (typeof ctx.createDynamicsCompressor !== "function") {
    return ctx.destination;
  }
  if (!compressorNode || compressorOwnerCtx !== ctx) {
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-14, ctx.currentTime);
    compressor.knee.setValueAtTime(12, ctx.currentTime);
    compressor.ratio.setValueAtTime(6, ctx.currentTime);
    compressor.attack.setValueAtTime(0.003, ctx.currentTime);
    compressor.release.setValueAtTime(0.12, ctx.currentTime);
    compressor.connect(ctx.destination);
    compressorNode = compressor;
    compressorOwnerCtx = ctx;
  }
  return compressorNode;
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (isSoundMuted()) return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isSoundMuted(): boolean {
  return getEffectsVolume() === 0;
}

export function setSoundMuted(muted: boolean): void {
  setEffectsVolume(muted ? 0 : DEFAULT_EFFECTS_VOLUME);
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* legacy mirror */
  }
}

function playSfxClip(src: string, relativeGain = 1.0): void {
  if (typeof window === "undefined" || typeof Audio === "undefined") return;
  const effectsScale = getEffectsVolume() / 100;
  if (effectsScale <= 0) return;

  try {
    const clip = new Audio(src);
    clip.preload = "auto";
    clip.volume = Math.min(1, Math.max(0, effectsScale * relativeGain));
    if (
      typeof HTMLAudioElement !== "undefined" &&
      clip instanceof HTMLAudioElement &&
      typeof navigator !== "undefined" &&
      /jsdom/i.test(navigator.userAgent)
    ) {
      return;
    }
    const maybePromise = clip.play();
    if (maybePromise && typeof maybePromise.catch === "function") {
      void maybePromise.catch(() => {});
    }
  } catch {
    // Ignore autoplay/environment playback rejections.
  }
}

function playTone(
  freq: number,
  durationSec: number,
  type: OscillatorType = "triangle",
  gainPeak = 0.08,
  delaySec = 0
) {
  const effectsScale = getEffectsVolume() / 100;
  if (effectsScale <= 0) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime + delaySec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  const scaledPeak = Math.min(
    MAX_TONE_GAIN,
    Math.max(0.0001, gainPeak * effectsScale * EFFECTS_GAIN_BOOST)
  );
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(scaledPeak, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

  osc.connect(gain);
  gain.connect(getEffectsDestination(ctx));
  osc.start(now);
  osc.stop(now + durationSec + 0.02);
}

export function playDiceSound(): void {
  playSfxClip(SFX_PATHS.dice);
}

export function playBuildPieceSound(kind: "ROAD" | "SETTLEMENT" | "CITY"): void {
  if (kind === "ROAD") {
    playSfxClip(SFX_PATHS.buildRoad);
  } else if (kind === "SETTLEMENT") {
    playSfxClip(SFX_PATHS.buildSettlement);
  } else {
    playSfxClip(SFX_PATHS.buildCity);
  }
}

export function playBuyDevCardSound(): void {
  playSfxClip(SFX_PATHS.buyDevCard);
}

export function playCardSound(): void {
  playSfxClip(SFX_PATHS.playDevCard);
}

export function playKnightCardSound(): void {
  playSfxClip(SFX_PATHS.playKnight);
}

export function playPlentyMonopolySound(): void {
  playSfxClip(SFX_PATHS.playPlentyMonopoly);
}

export function playRobberSound(): void {
  playSfxClip(SFX_PATHS.robberMove);
}

export function playStealCardSound(): void {
  playSfxClip(SFX_PATHS.stealCard);
}

export function playDiscardCardSound(): void {
  playSfxClip(SFX_PATHS.discardCard);
}

export function playTurnSound(): void {
  // Turn start / handoff intentionally kept silent per audio direction.
}

export function playAwardConquestSound(type: "ROAD" | "ARMY"): void {
  playSfxClip(type === "ROAD" ? SFX_PATHS.awardRoad : SFX_PATHS.awardArmy);
}

export function playVictorySound(): void {
  playSfxClip(SFX_PATHS.victory);
}

export function playChatSound(): void {
  playSfxClip(SFX_PATHS.chat);
}

export function playInvalidActionSound(): void {
  playSfxClip(SFX_PATHS.invalidAction);
}

export function playTauntSound(tone?: string) {
  if (tone === "anger") {
    playTone(146.83, 0.14, "sawtooth", 0.05, 0);
    playTone(130.81, 0.18, "sawtooth", 0.05, 0.11);
  } else if (tone === "rally" || tone === "crown") {
    playTone(392.0, 0.09, "triangle", 0.06, 0);
    playTone(493.88, 0.09, "triangle", 0.06, 0.08);
    playTone(587.33, 0.16, "triangle", 0.07, 0.16);
  } else {
    playTone(523.25, 0.07, "sine", 0.05, 0);
    playTone(659.25, 0.11, "sine", 0.05, 0.06);
  }
}

export function playActionRecordSound(record?: GameActionRecord): void {
  if (!record || !record[0]) return;
  const actionType = record[0][1];
  switch (actionType) {
    case "ROLL":
      playDiceSound();
      break;
    case "BUILD_ROAD":
      playBuildPieceSound("ROAD");
      break;
    case "BUILD_SETTLEMENT":
      playBuildPieceSound("SETTLEMENT");
      break;
    case "BUILD_CITY":
      playBuildPieceSound("CITY");
      break;
    case "BUY_DEVELOPMENT_CARD":
      playBuyDevCardSound();
      break;
    case "PLAY_ROAD_BUILDING":
      playCardSound();
      break;
    case "PLAY_YEAR_OF_PLENTY":
    case "PLAY_MONOPOLY":
      playPlentyMonopolySound();
      break;
    case "PLAY_KNIGHT_CARD":
      playKnightCardSound();
      break;
    case "MOVE_ROBBER": {
      playRobberSound();
      const victimFromArgs = Array.isArray(record[0][2]) ? record[0][2][1] : undefined;
      if (record[1] || victimFromArgs) {
        playStealCardSound();
      }
      break;
    }
    case "DISCARD_RESOURCE":
      playDiscardCardSound();
      break;
    case "MARITIME_TRADE":
    case "OFFER_TRADE":
    case "ACCEPT_TRADE":
    case "REJECT_TRADE":
    case "CONFIRM_TRADE":
    case "CANCEL_TRADE":
    case "END_TURN":
      break;
  }
}
