import { beforeEach, expect, test, vi } from "vitest";

const setValueAtTime = vi.fn();
const exponentialRampToValueAtTime = vi.fn();
const compressorConnect = vi.fn();
const gainConnect = vi.fn();
let createdCompressor: {
  threshold: { setValueAtTime: typeof setValueAtTime };
  knee: { setValueAtTime: typeof setValueAtTime };
  ratio: { setValueAtTime: typeof setValueAtTime };
  attack: { setValueAtTime: typeof setValueAtTime };
  release: { setValueAtTime: typeof setValueAtTime };
  connect: typeof compressorConnect;
} | null = null;

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  setValueAtTime.mockClear();
  exponentialRampToValueAtTime.mockClear();
  compressorConnect.mockClear();
  gainConnect.mockClear();
  createdCompressor = null;
  class FakeAudioContext {
    state = "running";
    currentTime = 0;
    destination = { id: "dest" };
    resume = vi.fn(async () => {});
    createOscillator() {
      return {
        type: "sine",
        frequency: { setValueAtTime },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
    }
    createGain() {
      return {
        gain: { setValueAtTime, exponentialRampToValueAtTime },
        connect: gainConnect,
      };
    }
    createDynamicsCompressor() {
      createdCompressor = {
        threshold: { setValueAtTime },
        knee: { setValueAtTime },
        ratio: { setValueAtTime },
        attack: { setValueAtTime },
        release: { setValueAtTime },
        connect: compressorConnect,
      };
      return createdCompressor;
    }
  }
  vi.stubGlobal("AudioContext", FakeAudioContext);
});

test("boosts and scales effect gain through compressor using saved effects volume", async () => {
  localStorage.setItem("catanatron_effects_volume_v1", "50");
  const { playCardSound } = await import("./soundEffects");

  playCardSound();

  // playCardSound first tone has gainPeak 0.06 -> 0.06 * 0.5 * 4.0 = 0.12
  expect(exponentialRampToValueAtTime).toHaveBeenCalledWith(0.12, 0.015);
  expect(createdCompressor).not.toBeNull();
  expect(compressorConnect).toHaveBeenCalledWith({ id: "dest" });
  expect(gainConnect).toHaveBeenCalledWith(createdCompressor);
});

test("does not create audible tones when effects volume is zero", async () => {
  localStorage.setItem("catanatron_effects_volume_v1", "0");
  const { playDiceSound } = await import("./soundEffects");

  playDiceSound();

  expect(exponentialRampToValueAtTime).not.toHaveBeenCalled();
});
