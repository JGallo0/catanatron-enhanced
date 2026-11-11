import type { GameActionRecord } from "./api.types";

const MUTE_KEY = "catanatron_sound_muted";

let audioCtx: AudioContext | null = null;

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
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoundMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // ignore storage quota errors
  }
}

function playTone(
  freq: number,
  durationSec: number,
  type: OscillatorType = "triangle",
  gainPeak = 0.08,
  delaySec = 0
) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime + delaySec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + durationSec + 0.02);
}

export function playDiceSound() {
  playTone(210, 0.05, "square", 0.04, 0.0);
  playTone(280, 0.05, "square", 0.05, 0.055);
  playTone(175, 0.07, "triangle", 0.07, 0.11);
  playTone(320, 0.08, "triangle", 0.06, 0.16);
}

export function playBuildPieceSound(kind: "ROAD" | "SETTLEMENT" | "CITY") {
  if (kind === "ROAD") {
    playTone(165, 0.09, "triangle", 0.09, 0);
    playTone(220, 0.07, "sine", 0.05, 0.04);
  } else if (kind === "SETTLEMENT") {
    playTone(261.6, 0.11, "triangle", 0.09, 0);
    playTone(329.6, 0.14, "sine", 0.08, 0.07);
    playTone(392.0, 0.18, "sine", 0.07, 0.13);
  } else {
    playTone(293.66, 0.12, "triangle", 0.1, 0);
    playTone(369.99, 0.15, "sine", 0.09, 0.06);
    playTone(440.0, 0.18, "sine", 0.08, 0.12);
    playTone(587.33, 0.25, "sine", 0.08, 0.19);
  }
}

export function playCardSound() {
  playTone(523.25, 0.1, "sine", 0.06, 0);
  playTone(659.25, 0.14, "sine", 0.06, 0.06);
}

export function playRobberSound() {
  playTone(110, 0.18, "sawtooth", 0.06, 0);
  playTone(88, 0.24, "triangle", 0.08, 0.08);
}

export function playTurnSound() {
  playTone(440, 0.08, "sine", 0.04, 0);
  playTone(554.37, 0.11, "sine", 0.04, 0.06);
}

export function playVictorySound() {
  playTone(392.0, 0.16, "triangle", 0.09, 0);
  playTone(493.88, 0.16, "triangle", 0.09, 0.12);
  playTone(587.33, 0.2, "triangle", 0.09, 0.24);
  playTone(783.99, 0.45, "sine", 0.11, 0.36);
}

export function playActionRecordSound(record?: GameActionRecord) {
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
    case "MARITIME_TRADE":
    case "PLAY_YEAR_OF_PLENTY":
    case "PLAY_MONOPOLY":
      playCardSound();
      break;
    case "MOVE_ROBBER":
    case "PLAY_KNIGHT_CARD":
      playRobberSound();
      break;
    case "END_TURN":
      playTurnSound();
      break;
  }
}
