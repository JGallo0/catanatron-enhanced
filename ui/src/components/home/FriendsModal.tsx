import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Dialog, DialogContent, DialogTitle, IconButton, Tab, Tabs } from "@mui/material";
import { ArrowLeft, Check, Search, UserPlus, Users, X } from "lucide-react";
import type { PlayerAccount } from "../../utils/apiClient";
import {
  changeFriendship, getFriends, getPlayerProfile, isOnlineAccount, searchPlayers,
  type FriendsOverview, type FriendshipAction, type PlayerProfile, type PublicPlayer,
} from "../../utils/socialApi";
import PlayerAvatar from "../PlayerAvatar";
import "./FriendsModal.scss";

type Props = { account: PlayerAccount | null; onClose: () => void; onLogin: () => void; onEditProfile: () => void };
type Section = "friends" | "requests" | "search" | "me";
const emptyOverview: FriendsOverview = { friends: [], incoming: [], outgoing: [] };
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Não foi possível concluir. Tente novamente.";

export default function FriendsModal({ account, onClose, onLogin, onEditProfile }: Props) {
  const token = account?.auth_token ?? "";
  const online = isOnlineAccount(token);
  const [section, setSection] = useState<Section>("friends");
  const [overview, setOverview] = useState<FriendsOverview>(emptyOverview);
  const [loading, setLoading] = useState(online);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PublicPlayer[]>([]);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const mounted = useRef(false);
  const listVersion = useRef(0);
  const searchVersion = useRef(0);
  const profileVersion = useRef(0);
  const mutationBusy = useRef(false);

  const refresh = useCallback(async () => {
    if (!online || mutationBusy.current) return;
    const version = ++listVersion.current;
    try {
      const next = await getFriends(token);
      if (mounted.current && version === listVersion.current) setOverview(next);
    } catch (err) {
      if (mounted.current && version === listVersion.current) setError(errorMessage(err));
    } finally {
      if (mounted.current && version === listVersion.current) setLoading(false);
    }
  }, [online, token]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 15000);
    return () => {
      mounted.current = false;
      ++listVersion.current;
      ++searchVersion.current;
      ++profileVersion.current;
      window.clearInterval(timer);
    };
  }, [refresh]);

  async function openProfile(username: string) {
    const version = ++profileVersion.current;
    setProfile(null);
    setProfileLoading(true);
    setError("");
    setNotice("");
    setConfirmRemove(null);
    try {
      const next = await getPlayerProfile(token, username);
      if (mounted.current && version === profileVersion.current) setProfile(next);
    } catch (err) {
      if (mounted.current && version === profileVersion.current) setError(errorMessage(err));
    } finally {
      if (mounted.current && version === profileVersion.current) setProfileLoading(false);
    }
  }

  function selectSection(next: Section) {
    ++profileVersion.current;
    setProfile(null);
    setProfileLoading(false);
    setConfirmRemove(null);
    setSection(next);
    setError("");
    setNotice("");
    if (next === "me" && account) void openProfile(account.username);
  }

  async function search() {
    const value = query.trim().replace(/^@/, "");
    if (value.length < 2) return;
    const version = ++searchVersion.current;
    setSearching(true);
    setError("");
    setNotice("");
    try {
      const response = await searchPlayers(token, value);
      if (mounted.current && version === searchVersion.current) {
        setResults(response.players);
        setSearched(true);
      }
    } catch (err) {
      if (mounted.current && version === searchVersion.current) setError(errorMessage(err));
    } finally {
      if (mounted.current && version === searchVersion.current) setSearching(false);
    }
  }

  async function act(player: PublicPlayer, action: FriendshipAction) {
    if (mutationBusy.current) return;
    mutationBusy.current = true;
    ++listVersion.current;
    ++searchVersion.current;
    setSearching(false);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await changeFriendship(token, player.username, action);
      if (!mounted.current) return;
      setResults(prev => prev.map(p => p.username === updated.username ? updated : p));
      setProfile(prev => prev?.username === updated.username ? { ...prev, ...updated } : prev);
      setOverview(prev => {
        const next = {
          friends: prev.friends.filter(p => p.username !== updated.username),
          incoming: prev.incoming.filter(p => p.username !== updated.username),
          outgoing: prev.outgoing.filter(p => p.username !== updated.username),
        };
        if (updated.relationship === "friends" || updated.relationship === "incoming" || updated.relationship === "outgoing") next[updated.relationship].push(updated);
        return next;
      });
      setNotice(action === "request" ? `Pedido enviado para ${player.display_name}.` : action === "accept" ? `Você e ${player.display_name} agora são amigos.` : player.relationship === "friends" ? "Amizade removida." : player.relationship === "incoming" ? "Pedido recusado." : "Pedido cancelado.");
      setConfirmRemove(null);
    } catch (err) {
      if (mounted.current) setError(errorMessage(err));
    } finally {
      mutationBusy.current = false;
      if (mounted.current) {
        setBusy(false);
        void refresh();
      }
    }
  }

  const actions = (player: PublicPlayer) => {
    if (player.relationship === "self") return <Button onClick={onEditProfile}>Editar meu perfil</Button>;
    if (player.relationship === "none") return <Button disabled={busy} variant="contained" startIcon={<UserPlus size={16} />} onClick={() => void act(player, "request")}>Adicionar</Button>;
    if (player.relationship === "incoming") return <><Button disabled={busy} variant="contained" startIcon={<Check size={16} />} onClick={() => void act(player, "accept")}>Aceitar</Button><Button disabled={busy} onClick={() => void act(player, "remove")}>Recusar</Button></>;
    if (player.relationship === "outgoing") return <><span className="friends-status">Pedido enviado</span><Button disabled={busy} onClick={() => void act(player, "remove")}>Cancelar pedido</Button></>;
    return confirmRemove === player.username ? <><span>Remover amizade?</span><Button disabled={busy} color="error" onClick={() => void act(player, "remove")}>Sim, remover</Button><Button disabled={busy} onClick={() => setConfirmRemove(null)}>Manter</Button></> : <><span className="friends-status"><Check size={14} /> Amigos</span><Button disabled={busy} onClick={() => setConfirmRemove(player.username)}>Remover</Button></>;
  };

  const list = (players: PublicPlayer[]) => <ul className="friends-list">{players.map(player => <li key={player.username}>
    <button className="friends-identity" onClick={() => void openProfile(player.username)} aria-label={`Ver perfil de ${player.display_name}`} disabled={busy}>
      <PlayerAvatar username={player.username} config={player.avatar_config} size={52} />
      <span><strong>{player.display_name}</strong><small>@{player.username}</small></span>
    </button>
    <div className="friends-actions">{actions(player)}</div>
  </li>)}</ul>;

  return <Dialog open onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="friends-title" PaperProps={{ className: "catan-modal-paper friends-modal" }}>
    <DialogTitle id="friends-title" className="friends-header"><span><Users size={24} /> Amigos & perfis</span><IconButton aria-label="Fechar amigos" onClick={onClose}><X /></IconButton></DialogTitle>
    <DialogContent className="friends-content">
      {!online ? <div className="friends-empty"><Users size={42} /><h3>Sua próxima mesa começa aqui</h3><p>{account ? "Sua conta está no modo offline. Entre em uma conta online para encontrar jogadores e salvar suas amizades entre dispositivos." : "Entre ou crie sua conta para encontrar jogadores, adicionar amigos e acompanhar seus perfis."}</p><Button variant="contained" onClick={onLogin}>Entrar / Criar conta</Button></div> : <>
        <Tabs value={section} onChange={(_, value) => selectSection(value)} variant="scrollable" scrollButtons="auto" aria-label="Seções de amigos" className="friends-tabs">
          <Tab disabled={busy} value="friends" label={`Amigos (${overview.friends.length})`} />
          <Tab disabled={busy} value="requests" label={`Pedidos${overview.incoming.length ? ` (${overview.incoming.length})` : ""}`} />
          <Tab disabled={busy} value="search" label="Buscar" />
          <Tab disabled={busy} value="me" label="Meu perfil" />
        </Tabs>
        {error && <div className="friends-error" role="alert"><p>{error}</p><Button onClick={() => { setError(""); if (section === "me" && account) void openProfile(account.username); else void refresh(); }}>Atualizar</Button>{error.includes("sessão") && <Button onClick={onLogin}>Entrar novamente</Button>}</div>}
        {notice && <p className="friends-notice" role="status">{notice}</p>}
        {profileLoading ? <p className="friends-empty" role="status">Carregando perfil…</p> : profile ? <div className="friends-profile">
          {section !== "me" && <Button startIcon={<ArrowLeft size={16} />} disabled={busy} onClick={() => { setProfile(null); setConfirmRemove(null); }}>Voltar à lista</Button>}
          <div className="friends-profile-hero"><PlayerAvatar username={profile.username} config={profile.avatar_config} size={112} /><h3>{profile.display_name}</h3><p>@{profile.username}</p><small>Na ilha desde {new Date(profile.member_since * 1000).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</small></div>
          <dl className="friends-stats"><div><dt>Partidas</dt><dd>{profile.stats.games_played}</dd></div><div><dt>Vitórias</dt><dd>{profile.stats.wins}</dd></div><div><dt>Aproveitamento</dt><dd>{profile.stats.win_rate}%</dd></div><div><dt>Ranking</dt><dd>{profile.leaderboard_rank ? `#${profile.leaderboard_rank}` : "—"}</dd></div></dl>
          <div className="friends-actions friends-actions--profile">{actions(profile)}</div>
        </div> : section === "search" ? <>
          <form className="friends-search" onSubmit={e => { e.preventDefault(); void search(); }}><label htmlFor="friend-query">Encontre seu próximo companheiro de mesa</label><div><input id="friend-query" value={query} maxLength={33} placeholder="Nome ou @usuário" onChange={e => { ++searchVersion.current; setQuery(e.target.value); setResults([]); setSearched(false); setSearching(false); }} /><Button type="submit" variant="contained" startIcon={<Search size={18} />} disabled={searching || busy || query.trim().replace(/^@/, "").length < 2}>Buscar</Button></div><small>Digite pelo menos 2 caracteres. Exibimos até 20 jogadores.</small></form>
          {searching ? <p role="status">Buscando jogadores…</p> : results.length ? list(results) : <p className="friends-empty">{searched ? "Nenhum jogador encontrado. Confira o nome ou o @usuário." : "Use o @usuário para encontrar a pessoa certa."}</p>}
        </> : section === "requests" ? <>
          <h3 className="friends-section-title">Recebidos <span>{overview.incoming.length}</span></h3>
          {overview.incoming.length ? list(overview.incoming) : <p className="friends-muted">Nenhum pedido recebido.</p>}
          <h3 className="friends-section-title">Enviados <span>{overview.outgoing.length}</span></h3>
          {overview.outgoing.length ? list(overview.outgoing) : <p className="friends-muted">Nenhum pedido aguardando resposta.</p>}
        </> : section === "friends" ? loading ? <p role="status" className="friends-empty">Carregando amigos…</p> : overview.friends.length ? list(overview.friends) : <div className="friends-empty"><Users size={42} /><h3>Mais amigos, mais histórias na ilha</h3><p>Busque um jogador e envie um pedido. Quando ele aceitar, aparecerá aqui.</p><Button variant="contained" startIcon={<UserPlus size={18} />} onClick={() => selectSection("search")}>Encontrar jogadores</Button></div> : null}
      </>}
    </DialogContent>
  </Dialog>;
}
