import axios from "axios";
import { beforeEach, expect, test, vi } from "vitest";
import { changeFriendship, getFriends, getPlayerProfile, searchPlayers } from "./socialApi";

vi.mock("axios", () => ({ default: { request: vi.fn(), isAxiosError: (error: { isAxiosError?: boolean }) => Boolean(error.isAxiosError) } }));
beforeEach(() => vi.resetAllMocks());

test("uses the authenticated session and encodes profile identifiers", async () => {
  vi.mocked(axios.request).mockResolvedValue({ data: {} });
  await getPlayerProfile("sess_token", "alice/bob");
  expect(axios.request).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining("/profiles/alice%2Fbob"), headers: { Authorization: "Bearer sess_token" }, timeout: 10000 }));
  await searchPlayers("sess_token", "@bruno");
  expect(axios.request).toHaveBeenLastCalledWith(expect.objectContaining({ params: { q: "@bruno" } }));
  await changeFriendship("sess_token", "bruno", "accept");
  expect(axios.request).toHaveBeenLastCalledWith(expect.objectContaining({ method: "PATCH", data: { action: "accept" } }));
});

test("never invents offline friends or successful requests", async () => {
  await expect(getFriends("local_token")).rejects.toThrow("conta online");
  expect(axios.request).not.toHaveBeenCalled();
  vi.mocked(axios.request).mockRejectedValue(new Error("Network error"));
  await expect(changeFriendship("sess_token", "bruno", "request")).rejects.toThrow("conexão");
});

test("reports expired sessions and server action errors in Portuguese", async () => {
  vi.mocked(axios.request).mockRejectedValueOnce({ isAxiosError: true, response: { status: 401 } });
  await expect(getFriends("sess_token")).rejects.toThrow("sessão expirou");
  vi.mocked(axios.request).mockRejectedValueOnce({ isAxiosError: true, response: { status: 409, data: { message: "Aceite o pedido recebido." } } });
  await expect(changeFriendship("sess_token", "bruno", "request")).rejects.toThrow("Aceite o pedido recebido.");
});
