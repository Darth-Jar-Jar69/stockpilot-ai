"use client";

import { usePathname } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Bot, Loader2, MessageCircle, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generateAssistantFallback } from "@/lib/assistant-fallback";
import type { ChatMessage } from "@/types/scanner";
import { cn } from "@/lib/utils";

async function requestAssistantReply(
  text: string,
  pathname: string,
  symbol?: string,
): Promise<string> {
  try {
    const res = await fetch("/api/assistant/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, page: pathname, symbol }),
    });
    const data = await res.json();
    if (typeof data.reply === "string" && data.reply.trim()) {
      return data.reply;
    }
  } catch {
    // Local fallback below.
  }
  return generateAssistantFallback(text, { page: pathname, symbol });
}

/** Floating AI assistant — explains the app and market concepts with page context. */
export function AiAssistantPanel() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const symbolMatch = pathname.match(/^\/analysis\/([^/]+)/i);
  const symbol = symbolMatch?.[1]?.toUpperCase();

  useEffect(() => {
    if (!open) return;
    fetch("/api/assistant/chat")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.messages?.length) {
          setMessages(
            data.messages.map((m: { id: string; role: string; content: string }) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
          );
        }
      })
      .catch(() => undefined);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      const text = input.trim();
      if (!text || loading) return;

      setInput("");
      setMessages((prev) => [...prev, { role: "user", content: text }]);
      setLoading(true);

      const reply = await requestAssistantReply(text, pathname, symbol);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      setLoading(false);
    },
    [input, loading, pathname, symbol],
  );

  return (
    <>
      <Button
        type="button"
        size="lg"
        className={cn(
          "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg shadow-primary/20",
          open && "hidden",
        )}
        onClick={() => setOpen(true)}
        aria-label="Open AI assistant"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>

      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[min(560px,80vh)] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">StockPilot Assistant</p>
                <p className="text-xs text-slate-400">
                  {symbol ? `Viewing ${symbol}` : "Your AI Investing Assistant"}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <p className="text-sm text-slate-400">
                Ask me to explain RSI, what a stock page means, or how to use the scanner. I use
                live context from your current page — not made-up prices.
              </p>
            )}
            {messages.map((msg, i) => (
              <div
                key={msg.id ?? i}
                className={cn(
                  "max-w-[90%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
                  msg.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-secondary/80 text-slate-100",
                )}
              >
                {msg.content}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking…
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={send} className="flex gap-2 border-t border-border/50 p-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about markets or this page…"
              className="border-border/60 bg-secondary/50"
              disabled={loading}
            />
            <Button type="submit" size="icon" disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
