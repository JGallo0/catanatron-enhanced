import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

const audio = vi.hoisted(() => ({
  unlockAndPlayMusic: vi.fn<() => Promise<boolean>>(),
  stopGameMusic: vi.fn(),
}));

vi.mock("../utils/gameAudio", () => audio);

beforeEach(() => {
  audio.unlockAndPlayMusic.mockReset().mockResolvedValue(true);
  audio.stopGameMusic.mockClear();
});

test("attempts immediate unlock when enabled, retries when blocked, and removes listeners after success", async () => {
  audio.unlockAndPlayMusic
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(true);
  renderHook(() => useGameMusic(true));

  expect(audio.unlockAndPlayMusic).toHaveBeenCalledTimes(1);

  await act(async () => document.dispatchEvent(new Event("pointerdown")));
  await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" })));
  await act(async () => document.dispatchEvent(new Event("pointerdown")));

  expect(audio.unlockAndPlayMusic).toHaveBeenCalledTimes(3);
});

test("stays stopped while disabled (e.g. during Boa Guerra) and starts immediately once enabled", async () => {
  const { rerender } = renderHook(({ enabled }) => useGameMusic(enabled), {
    initialProps: { enabled: false },
  });

  expect(audio.stopGameMusic).toHaveBeenCalledTimes(1);
  expect(audio.unlockAndPlayMusic).not.toHaveBeenCalled();

  await act(async () => document.dispatchEvent(new Event("pointerdown")));
  expect(audio.unlockAndPlayMusic).not.toHaveBeenCalled();

  await act(async () => rerender({ enabled: true }));
  expect(audio.unlockAndPlayMusic).toHaveBeenCalledTimes(1);
});

test("cleans interaction listeners without stopping music on unmount", async () => {
  audio.unlockAndPlayMusic.mockResolvedValue(false);
  const { unmount } = renderHook(() => useGameMusic(true));
  expect(audio.unlockAndPlayMusic).toHaveBeenCalledTimes(1);
  unmount();

  await act(async () => document.dispatchEvent(new Event("pointerdown")));

  expect(audio.unlockAndPlayMusic).toHaveBeenCalledTimes(1);
  expect(audio.stopGameMusic).not.toHaveBeenCalled();
});

import { useGameMusic } from "./useGameMusic";
