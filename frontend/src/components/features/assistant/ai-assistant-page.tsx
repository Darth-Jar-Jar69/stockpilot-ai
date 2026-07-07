"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Bot, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

/** Full-page AI assistant with persisted chat history. */
export function AiAssistantPage() {
  const pathname = usePathname();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const symbolMatch = pathname.match(/^\/analysis\/([^/]+)/i);
  const symbol = symbolMatch?.[1]?.toUpperCase();

  useEffect(() => {
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
  }, []);

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
    <div className="flex h-full flex-col p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-white">AI Assistant</h1>
        <p className="text-sm text-slate-400">
          Your AI Investing Assistant — ask about indicators, analysis pages, or the scanner.
          Research only — not financial advice.
        </p>
      </div>

      <Card className="glass flex flex-1 flex-col border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-white">
            <Bot className="h-5 w-5 text-primary" />
            StockPilot Assistant
          </CardTitle>
          <CardDescription className="text-slate-400">
            Chat history is saved to your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3 overflow-hidden">
          <div className="flex-1 space-y-3 overflow-y-auto pr-1">
            {messages.length === 0 && (
              <p className="text-sm text-slate-400">
                Try: &quot;What does RSI mean?&quot; or &quot;How do I use the market scanner?&quot;
              </p>
            )}
            {messages.map((msg, i) => (
              <div
                key={msg.id ?? i}
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
                  msg.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-secondary/80 text-slate-100",
                )}
              >
                {msg.content}
              </div>
            ))}
            {loading && <p className="text-sm text-slate-400">Thinking…</p>}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={send} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              className="border-border/60 bg-secondary/50"
              disabled={loading}
            />
            <Button type="submit" disabled={loading || !input.trim()}>
              <Send className="mr-2 h-4 w-4" />
              Send
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
