import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import FriendsModal from "./FriendsModal";
import { changeFriendship, getFriends, getPlayerProfile, searchPlayers, type PublicPlayer } from "../../utils/socialApi";

vi.mock("../../utils/socialApi", async importOriginal => ({
  ...await importOriginal<typeof import("../../utils/socialApi")>(),
  getFriends: vi.fn(), getPlayerProfile: vi.fn(), searchPlayers: vi.fn(), changeFriendship: vi.fn(),
}));

const account = { username: "alice", display_name: "Alice", auth_token: "sess_alice" };
const bruno: PublicPlayer = { username: "bruno", display_name: "Bruno", avatar_config: {}, relationship: "none" };
const empty = { friends: [], incoming: [], outgoing: [] };
const props = { account, onClose: vi.fn(), onLogin: vi.fn(), onEditProfile: vi.fn() };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getFriends).mockResolvedValue(empty);
});
afterEach(cleanup);

test.each([null, { ...account, auth_token: "local_alice" }, { ...account, auth_token: "acct_alice" }])("requires an online account before contacting social API: %s", async account => {
  render(<FriendsModal {...props} account={account} />);
  fireEvent.click(screen.getByRole("button", { name: "Entrar / Criar conta" }));
  expect(props.onLogin).toHaveBeenCalled();
  expect(getFriends).not.toHaveBeenCalled();
});

test("searches players, sends and cancels a request", async () => {
  vi.mocked(searchPlayers).mockResolvedValue({ players: [bruno] });
  vi.mocked(changeFriendship).mockResolvedValueOnce({ ...bruno, relationship: "outgoing" }).mockResolvedValueOnce(bruno);
  render(<FriendsModal {...props} />);
  fireEvent.click(await screen.findByRole("button", { name: "Encontrar jogadores" }));
  const search = screen.getByRole("button", { name: "Buscar" });
  expect(search).toBeDisabled();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "@bruno" } });
  fireEvent.click(search);
  fireEvent.click(await screen.findByRole("button", { name: "Adicionar" }));
  await waitFor(() => expect(changeFriendship).toHaveBeenCalledWith("sess_alice", "bruno", "request"));
  fireEvent.click(await screen.findByRole("button", { name: "Cancelar pedido" }));
  expect(await screen.findByRole("button", { name: "Adicionar" })).toBeEnabled();
  expect(changeFriendship).toHaveBeenLastCalledWith("sess_alice", "bruno", "remove");
});

test("accepts an incoming request and requires confirmation before removing a friend", async () => {
  vi.mocked(getFriends).mockResolvedValueOnce({ ...empty, incoming: [{ ...bruno, relationship: "incoming" }] }).mockResolvedValue({ ...empty, friends: [{ ...bruno, relationship: "friends" }] });
  vi.mocked(changeFriendship).mockResolvedValueOnce({ ...bruno, relationship: "friends" }).mockResolvedValueOnce(bruno);
  render(<FriendsModal {...props} />);
  fireEvent.click(await screen.findByRole("tab", { name: "Pedidos (1)" }));
  fireEvent.click(screen.getByRole("button", { name: "Aceitar" }));
  await waitFor(() => expect(screen.getByRole("tab", { name: "Amigos (1)" })).toBeEnabled());
  fireEvent.click(screen.getByRole("tab", { name: "Amigos (1)" }));
  fireEvent.click(screen.getByRole("button", { name: "Remover" }));
  expect(changeFriendship).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Manter" }));
  expect(screen.queryByText("Remover amizade?")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Remover" }));
  fireEvent.click(screen.getByRole("button", { name: "Sim, remover" }));
  await waitFor(() => expect(changeFriendship).toHaveBeenLastCalledWith("sess_alice", "bruno", "remove"));
});

test("shows public profile statistics and allows editing own profile", async () => {
  vi.mocked(getPlayerProfile).mockResolvedValue({ ...bruno, username: "alice", display_name: "Alice", relationship: "self", stats: { wins: 2, losses: 1, games_played: 3, win_rate: 66.7 }, leaderboard_rank: 4, member_since: 1794614400 });
  render(<FriendsModal {...props} />);
  fireEvent.click(screen.getByRole("tab", { name: "Meu perfil" }));
  expect(await screen.findByText("66.7%")).toBeInTheDocument();
  expect(screen.getByText("#4")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Editar meu perfil" }));
  expect(props.onEditProfile).toHaveBeenCalled();
});

test("keeps a failed request available to retry and displays the error", async () => {
  vi.mocked(getFriends).mockResolvedValue({ ...empty, incoming: [{ ...bruno, relationship: "incoming" }] });
  vi.mocked(changeFriendship).mockRejectedValue(new Error("Falha de conexão. Tente novamente."));
  render(<FriendsModal {...props} />);
  fireEvent.click(await screen.findByRole("tab", { name: "Pedidos (1)" }));
  fireEvent.click(screen.getByRole("button", { name: "Aceitar" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Falha de conexão");
  await waitFor(() => expect(screen.getByRole("button", { name: "Aceitar" })).toBeEnabled());
  expect(screen.queryByText(/agora são amigos/)).not.toBeInTheDocument();
});

test("ignores a search response after the input changes", async () => {
  let resolve!: (value: { players: PublicPlayer[] }) => void;
  vi.mocked(searchPlayers).mockImplementation(() => new Promise(done => { resolve = done; }));
  render(<FriendsModal {...props} />);
  fireEvent.click(screen.getByRole("tab", { name: "Buscar" }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "bruno" } });
  fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "carla" } });
  resolve({ players: [bruno] });
  await waitFor(() => expect(screen.queryByText("Bruno")).not.toBeInTheDocument());
});
