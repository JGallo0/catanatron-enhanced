import { beforeEach, expect, test, vi } from "vitest";

interface AudioCall {
  src: string;
  volume: number;
  preload: string;
}

const audioCalls: AudioCall[] = [];
const audioPlay = vi.fn(() => Promise.resolve());
const setValueAtTime = vi.fn();
const exponentialRampToValueAtTime = vi.fn();

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  audioCalls.length = 0;
  audioPlay.mockClear();
  setValueAtTime.mockClear();
  exponentialRampToValueAtTime.mockClear();

  class FakeAudio {
    src: string;
    volume = 1;
    preload = "";
    private record: AudioCall;

    constructor(src = "") {
      this.src = src;
      this.record = { src, volume: 1, preload: "" };
      audioCalls.push(this.record);
    }

    play = () => {
      this.record.volume = this.volume;
      this.record.preload = this.preload;
      return audioPlay();
    };
  }

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
        connect: vi.fn(),
      };
    }
    createDynamicsCompressor() {
      return {
        threshold: { setValueAtTime },
        knee: { setValueAtTime },
        ratio: { setValueAtTime },
        attack: { setValueAtTime },
        release: { setValueAtTime },
        connect: vi.fn(),
      };
    }
  }

  vi.stubGlobal("Audio", FakeAudio);
  vi.stubGlobal("AudioContext", FakeAudioContext);
});

test("plays the approved OGG clips scaled by saved effects volume", async () => {
  localStorage.setItem("catanatron_effects_volume_v1", "50");
  const sfx = await import("./soundEffects");

  sfx.playBuyDevCardSound();
  sfx.playCardSound();
  sfx.playBuildPieceSound("ROAD");
  sfx.playBuildPieceSound("SETTLEMENT");
  sfx.playBuildPieceSound("CITY");
  sfx.playAwardConquestSound("ROAD");
  sfx.playAwardConquestSound("ARMY");
  sfx.playVictorySound();
  sfx.playChatSound();
  sfx.playDiceSound();
  sfx.playKnightCardSound();
  sfx.playPlentyMonopolySound();
  sfx.playRobberSound();
  sfx.playStealCardSound();
  sfx.playDiscardCardSound();
  sfx.playInvalidActionSound();

  expect(audioCalls.map((c) => c.src)).toEqual([
    "/assets/audio/sfx/buy-dev-card.ogg",
    "/assets/audio/sfx/play-dev-card.ogg",
    "/assets/audio/sfx/build-road.ogg",
    "/assets/audio/sfx/build-settlement.ogg",
    "/assets/audio/sfx/build-city.ogg",
    "/assets/audio/sfx/award-road.ogg",
    "/assets/audio/sfx/award-army.ogg",
    "/assets/audio/sfx/victory.ogg",
    "/assets/audio/sfx/chat.ogg",
    "/assets/audio/sfx/dice-roll.ogg",
    "/assets/audio/sfx/play-knight.ogg",
    "/assets/audio/sfx/play-plenty-monopoly.ogg",
    "/assets/audio/sfx/robber-move.ogg",
    "/assets/audio/sfx/steal-card.ogg",
    "/assets/audio/sfx/discard-card.ogg",
    "/assets/audio/sfx/invalid-action.ogg",
  ]);
  for (const call of audioCalls) {
    expect(call.volume).toBeCloseTo(0.5);
  }
  expect(audioPlay).toHaveBeenCalledTimes(16);
});

test("maps action records to approved SFX and keeps turn/trade actions silent", async () => {
  localStorage.setItem("catanatron_effects_volume_v1", "80");
  const sfx = await import("./soundEffects");

  sfx.playActionRecordSound([["RED", "BUY_DEVELOPMENT_CARD", null], "KNIGHT"]);
  sfx.playActionRecordSound([["RED", "PLAY_ROAD_BUILDING", null], null]);
  sfx.playActionRecordSound([["RED", "PLAY_YEAR_OF_PLENTY", ["WOOD"]], null]);
  sfx.playActionRecordSound([["RED", "PLAY_MONOPOLY", "ORE"], null]);
  sfx.playActionRecordSound([["RED", "PLAY_KNIGHT_CARD", null], null]);
  sfx.playActionRecordSound([["RED", "MOVE_ROBBER", [[0, 0, 0]]], null]);
  sfx.playActionRecordSound([["RED", "MOVE_ROBBER", [[0, 0, 0], "BLUE"]], "WHEAT"]);
  sfx.playActionRecordSound([["BLUE", "DISCARD_RESOURCE", "WOOD"], "WOOD"]);

  // Actions configured as silent
  sfx.playTurnSound();
  sfx.playActionRecordSound([["RED", "END_TURN", null], null]);
  sfx.playActionRecordSound([["RED", "CONFIRM_TRADE", [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, "BLUE"]], null]);
  sfx.playActionRecordSound([["RED", "MARITIME_TRADE", ["WOOD", "WOOD", "WOOD", "WOOD", "ORE"]], null]);

  expect(audioCalls.map((c) => c.src)).toEqual([
    "/assets/audio/sfx/buy-dev-card.ogg",
    "/assets/audio/sfx/play-dev-card.ogg",
    "/assets/audio/sfx/play-plenty-monopoly.ogg",
    "/assets/audio/sfx/play-plenty-monopoly.ogg",
    "/assets/audio/sfx/play-knight.ogg",
    "/assets/audio/sfx/robber-move.ogg",
    "/assets/audio/sfx/robber-move.ogg",
    "/assets/audio/sfx/steal-card.ogg",
    "/assets/audio/sfx/discard-card.ogg",
  ]);
  for (const call of audioCalls) {
    expect(call.volume).toBeCloseTo(0.8);
  }
});

test("does not create audio clips or tones when effects volume is zero", async () => {
  localStorage.setItem("catanatron_effects_volume_v1", "0");
  const sfx = await import("./soundEffects");

  sfx.playDiceSound();
  sfx.playVictorySound();
  sfx.playInvalidActionSound();
  sfx.playTauntSound("rally");

  expect(audioCalls).toHaveLength(0);
  expect(exponentialRampToValueAtTime).not.toHaveBeenCalled();
});
