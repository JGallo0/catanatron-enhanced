import axios from "axios";
import { API_URL } from "../configuration";
import type { AccountStats, AvatarConfig } from "./api.types";

export type Relationship = "self" | "none" | "friends" | "incoming" | "outgoing";
export type PublicPlayer = {
  username: string;
  display_name: string;
  avatar_config: Partial<AvatarConfig>;
  relationship: Relationship;
};
export type PlayerProfile = PublicPlayer & {
  stats: AccountStats;
  leaderboard_rank: number | null;
  member_since: number;
};
export type FriendsOverview = {
  friends: PublicPlayer[];
  incoming: PublicPlayer[];
  outgoing: PublicPlayer[];
};
export type FriendshipAction = "request" | "accept" | "remove";

export function isOnlineAccount(token: string) {
  return Boolean(token) && !/^(local_|acct_)/.test(token);
}

async function socialRequest<T>(token: string, path: string, method = "GET", data?: unknown, params?: object): Promise<T> {
  if (!isOnlineAccount(token)) throw new Error("Entre em uma conta online para adicionar amigos.");
  try {
    const response = await axios.request<T>({
      url: `${API_URL}/api/social${path}`, method, data, params,
      headers: { Authorization: `Bearer ${token}` }, timeout: 10000,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) throw new Error("Sua sessão expirou. Entre novamente para acessar seus amigos.");
      const message = error.response?.data?.message;
      if (typeof message === "string") throw new Error(message);
    }
    throw new Error("Não foi possível acessar seus amigos. Confira sua conexão e tente novamente.");
  }
}

export const getFriends = (token: string) => socialRequest<FriendsOverview>(token, "/friends");
export const searchPlayers = (token: string, query: string) =>
  socialRequest<{ players: PublicPlayer[] }>(token, "/players", "GET", undefined, { q: query });
export const getPlayerProfile = (token: string, username: string) =>
  socialRequest<PlayerProfile>(token, `/profiles/${encodeURIComponent(username)}`);
export const changeFriendship = (token: string, username: string, action: FriendshipAction) =>
  socialRequest<PublicPlayer>(token, `/friendships/${encodeURIComponent(username)}`,
    action === "request" ? "POST" : action === "accept" ? "PATCH" : "DELETE",
    action === "accept" ? { action: "accept" } : undefined);
