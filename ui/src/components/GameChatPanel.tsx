import { useEffect, useRef, useState } from "react";
import cn from "classnames";
import type { Color, GameMessage } from "../utils/api.types";
import { getPlayerColorMeta } from "../config/assetRegistry";
import { parseTauntMessage } from "../config/tauntCatalog";
import { getCurrentLanguage, useLanguage, type AppLanguage } from "../i18n";
import "./GameChatPanel.scss";

export const CHAT_QUICK_PHRASES = [
  "👋 Boa sorte!",
  "🤝 Vamos trocar?",
  "🎲 Bela rolagem!",
  "👏 Bela jogada!",
] as const;

export const CHAT_QUICK_PHRASES_EN = [
  "👋 Good luck!",
  "🤝 Up for a trade?",
  "🎲 Nice roll!",
  "👏 Great move!",
] as const;

export function getChatQuickPhrases(
  lang: AppLanguage = getCurrentLanguage()
): readonly string[] {
  return lang === "en" ? CHAT_QUICK_PHRASES_EN : CHAT_QUICK_PHRASES;
}

export type GameChatPanelProps = {
  open: boolean;
  onClose: () => void;
  messages: GameMessage[];
  mySeatColor: Color | null;
  replayMode?: boolean;
  isSending?: boolean;
  errorMessage?: string | null;
  onSendMessage: (body: string) => Promise<void> | void;
};

function formatMessageTime(tsSeconds: number): string {
  if (!Number.isFinite(tsSeconds) || tsSeconds <= 0) return "";
  try {
    const dt = new Date(tsSeconds * 1000);
    const hh = String(dt.getHours()).padStart(2, "0");
    const mm = String(dt.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  } catch {
    return "";
  }
}

export default function GameChatPanel({
  open,
  onClose,
  messages,
  mySeatColor,
  replayMode = false,
  isSending = false,
  errorMessage = null,
  onSendMessage,
}: GameChatPanelProps) {
  const { language, t } = useLanguage();
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, messages.length]);

  if (!open) return null;

  const canWrite = Boolean(mySeatColor) && !replayMode;
  const colorMeta = getPlayerColorMeta(language);
  const quickPhrases = getChatQuickPhrases(language);

  const submitText = async (rawText: string) => {
    const clean = rawText.trim();
    if (!clean || !canWrite || isSending) return;
    await onSendMessage(clean);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = draft.trim();
    if (!clean || !canWrite || isSending) return;
    setDraft("");
    await submitText(clean);
  };

  return (
    <aside
      className="game-chat-panel"
      role="dialog"
      aria-label={t("Bate-papo da Partida", "Match Chat")}
    >
      <header className="game-chat-panel__header">
        <div className="game-chat-panel__title-group">
          <span className="game-chat-panel__icon" aria-hidden="true">
            💬
          </span>
          <h2 className="game-chat-panel__title">
            {t("Bate-papo da Mesa", "Table Chat")}
          </h2>
        </div>
        <button
          type="button"
          className="game-chat-panel__close-btn"
          onClick={onClose}
          aria-label={t("Fechar bate-papo", "Close chat")}
          title={t("Fechar bate-papo", "Close chat")}
        >
          ✕
        </button>
      </header>

      <div
        ref={listRef}
        className="game-chat-panel__messages"
        role="log"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <p className="game-chat-panel__empty">
            {t(
              "Nenhuma mensagem ainda. Cumprimente os jogadores ou combine uma troca!",
              "No messages yet. Say hello to the players or negotiate a trade!"
            )}
          </p>
        ) : (
          messages.map((msg) => {
            const isMine = Boolean(mySeatColor && msg.color === mySeatColor);
            const palette = colorMeta[msg.color];
            const accentColor = palette?.primary || "#facc15";
            const timeStr = formatMessageTime(msg.created_at);
            const parsed = parseTauntMessage(msg.body, msg.kind, language);
            const isTaunt = msg.kind === "TAUNT" || Boolean(parsed.taunt);

            return (
              <div
                key={msg.id}
                className={cn("game-chat-msg", {
                  "is-mine": isMine,
                  "is-taunt": isTaunt,
                })}
                style={{ "--seat-accent": accentColor } as React.CSSProperties}
              >
                <div className="game-chat-msg__meta">
                  <span
                    className="game-chat-msg__dot"
                    style={{ background: accentColor }}
                    aria-hidden="true"
                  />
                  <span className="game-chat-msg__sender">
                    {msg.sender_name}
                  </span>
                  {isTaunt && (
                    <span className="game-chat-msg__taunt-pill">🎭</span>
                  )}
                  {timeStr && (
                    <span className="game-chat-msg__time">{timeStr}</span>
                  )}
                </div>
                <div className="game-chat-msg__body">{parsed.displayText}</div>
              </div>
            );
          })
        )}
      </div>

      {errorMessage && (
        <div className="game-chat-panel__error" role="alert">
          {errorMessage}
        </div>
      )}

      {canWrite ? (
        <footer className="game-chat-panel__footer">
          <div
            className="game-chat-panel__quick-chips"
            aria-label={t("Frases rápidas", "Quick phrases")}
          >
            {quickPhrases.map((phrase) => (
              <button
                key={phrase}
                type="button"
                className="game-chat-panel__chip"
                disabled={isSending}
                onClick={() => submitText(phrase)}
              >
                {phrase}
              </button>
            ))}
          </div>
          <form className="game-chat-panel__form" onSubmit={handleSubmit}>
            <input
              type="text"
              className="game-chat-panel__input"
              placeholder={t("Escreva uma mensagem...", "Write a message...")}
              maxLength={240}
              value={draft}
              disabled={isSending}
              onChange={(e) => setDraft(e.target.value)}
              aria-label={t("Mensagem de bate-papo", "Chat message")}
            />
            <button
              type="submit"
              className="game-chat-panel__send-btn"
              disabled={isSending || !draft.trim()}
            >
              {t("Enviar", "Send")}
            </button>
          </form>
        </footer>
      ) : (
        <footer className="game-chat-panel__readonly">
          {t(
            "Modo espectador — bate-papo somente leitura.",
            "Spectator mode — read-only chat."
          )}
        </footer>
      )}
    </aside>
  );
}
