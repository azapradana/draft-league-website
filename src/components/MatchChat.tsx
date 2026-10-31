"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

export type MatchMessage = {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
};

export default function MatchChat({
  endpoint,
  initialMessages,
  currentUserId,
  playerIds,
}: {
  endpoint: string;
  initialMessages: MatchMessage[];
  currentUserId: string;
  playerIds: string[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    let active = true;

    async function refresh() {
      if (document.visibilityState !== "visible") {
        return;
      }
      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        const result = (await response.json()) as
          | { messages: MatchMessage[] }
          | { error: string };
        if (!response.ok || !("messages" in result)) {
          throw new Error("error" in result ? result.error : "Chat could not be refreshed.");
        }
        if (active) {
          setMessages(result.messages);
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Chat could not be refreshed.");
        }
      }
    }

    const intervalId = window.setInterval(() => void refresh(), 5000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [endpoint]);

  useEffect(() => {
    const list = listRef.current;
    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages.length]);

  async function send() {
    const content = draft.trim();
    if (!content || sending) {
      return;
    }

    setSending(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const result = (await response.json()) as
        | { message: MatchMessage }
        | { error: string };
      if (!response.ok || !("message" in result)) {
        throw new Error("error" in result ? result.error : "Your message could not be sent.");
      }
      setMessages((current) =>
        [...current.filter((message) => message.id !== result.message.id), result.message].slice(
          -100,
        ),
      );
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your message could not be sent.");
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  }

  return (
    <section className="flex flex-col rounded-xl border border-[#243775] bg-[#0C1638] p-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold">Match chat</h2>
        <span className="text-[0.65rem] text-[#9FB0E6]">Auto-refreshes · UTC</span>
      </div>

      {error && (
        <p role="alert" className="mt-2 rounded-lg border border-red-500/60 bg-red-950/40 p-2 text-xs text-red-200">
          {error}
        </p>
      )}

      <ol
        ref={listRef}
        aria-live="polite"
        className="mt-2 flex h-[50vh] min-h-64 flex-col gap-2 overflow-y-auto rounded-lg border border-[#243775] bg-[#070D24] p-3 lg:h-[60vh]"
      >
        {messages.length === 0 ? (
          <li className="text-sm text-[#9FB0E6]">No messages yet. Say glhf!</li>
        ) : (
          messages.map((message) => {
            const mine = message.senderId === currentUserId;
            const isPlayer = playerIds.includes(message.senderId);
            const tone = mine
              ? "rounded-br-sm bg-[#F5C542] text-[#070D24]"
              : isPlayer
                ? "rounded-bl-sm bg-[#243775] text-[#EEF2FF]"
                : "rounded-bl-sm border border-purple-400/50 bg-purple-900/70 text-purple-50";
            return (
              <li
                key={message.id}
                className={`flex max-w-[85%] flex-col ${mine ? "self-end items-end" : "self-start items-start"}`}
              >
                <span className="mb-0.5 px-1 text-[0.65rem] text-[#9FB0E6]">
                  {mine ? "You" : message.senderName}
                  {!mine && !isPlayer && (
                    <span className="ml-1 rounded bg-purple-500/30 px-1 font-bold text-purple-200">
                      ADMIN
                    </span>
                  )}
                  {" · "}
                  <time dateTime={message.timestamp}>
                    {new Date(message.timestamp).toLocaleTimeString("en-US", {
                      timeZone: "UTC",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </span>
                <p
                  className={`whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm ${tone}`}
                >
                  {message.content}
                </p>
              </li>
            );
          })
        )}
      </ol>

      <div className="mt-2 flex items-end gap-2">
        <label htmlFor="match-message" className="sr-only">
          Write a match chat message
        </label>
        <textarea
          id="match-message"
          maxLength={1000}
          rows={1}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Message… (Enter to send, Shift+Enter for newline)"
          className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border border-[#243775] bg-[#070D24] px-3 py-2 text-sm text-[#EEF2FF] placeholder:text-[#7789BF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C542]"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending || draft.trim().length === 0}
          aria-label="Send message"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F5C542] text-xl font-bold text-[#070D24] hover:bg-[#D9A21B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C542] disabled:cursor-not-allowed disabled:opacity-50"
        >
          &gt;
        </button>
      </div>
    </section>
  );
}
