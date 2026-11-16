import { beforeEach, expect, test, vi } from "vitest";

const setValueAtTime = vi.fn();
const exponentialRampToValueAtTime = vi.fn();

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  setValueAtTime.mockClear();
  exponentialRampToValueAtTime.mockClear();
  class FakeAudioContext {
    state = "running";
    currentTime = 0;
    destination = {};
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
        connect: vi.fn(),
      };
    }
  }
  vi.stubGlobal("AudioContext", FakeAudioContext);
});

test("scales effect gain by the saved effects volume", async () => {
  localStorage.setItem("catanatron_effects_volume_v1", "50");
  const { playCardSound } = await import("./soundEffects");

  playCardSound();

  expect(exponentialRampToValueAtTime).toHaveBeenCalledWith(0.03, 0.015);
});

test("does not create audible tones when effects volume is zero", async () => {
  localStorage.setItem("catanatron_effects_volume_v1", "0");
  const { playDiceSound } = await import("./soundEffects");

  playDiceSound();

  expect(exponentialRampToValueAtTime).not.toHaveBeenCalled();
});
