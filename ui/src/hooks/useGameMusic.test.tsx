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

test("retries a blocked unlock and removes listeners after success", async () => {
  audio.unlockAndPlayMusic
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(true);
  renderHook(() => useGameMusic());

  await act(async () => document.dispatchEvent(new Event("pointerdown")));
  await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" })));
  await act(async () => document.dispatchEvent(new Event("pointerdown")));

  expect(audio.unlockAndPlayMusic).toHaveBeenCalledTimes(2);
});

test("cleans interaction listeners without stopping music on unmount", async () => {
  audio.unlockAndPlayMusic.mockResolvedValue(false);
  const { unmount } = renderHook(() => useGameMusic());
  unmount();

  await act(async () => document.dispatchEvent(new Event("pointerdown")));

  expect(audio.unlockAndPlayMusic).not.toHaveBeenCalled();
  expect(audio.stopGameMusic).not.toHaveBeenCalled();
});

import { useGameMusic } from "./useGameMusic";
