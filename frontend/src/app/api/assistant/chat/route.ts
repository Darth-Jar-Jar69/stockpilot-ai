import { NextResponse } from "next/server";

import {
  addChatMessage,
  getChatMessages,
  getOrCreateChatThread,
} from "@/lib/auth/store";
import { generateAssistantFallback } from "@/lib/assistant-fallback";
import { getSession } from "@/lib/auth/session";

import { fetchBackendJson, isBackendConfigured } from "@/lib/backend";

const BACKEND_TIMEOUT_MS = 8000;

async function tryBackendReply(
  message: string,
  history: { role: string; content: string }[],
  context: { page?: string; symbol?: string },
): Promise<string | null> {
  if (!isBackendConfigured()) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);

  try {
    const { ok, data } = await fetchBackendJson<{ reply?: string }>({
      path: "/api/v1/assistant/chat",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history, context }),
        signal: controller.signal,
      },
      revalidate: false,
    });
    if (ok && typeof data.reply === "string" && data.reply.trim()) {
      return data.reply.trim();
    }
  } catch {
    // Use fallback below.
  } finally {
    clearTimeout(timer);
  }

  return null;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const thread = await getOrCreateChatThread(session.userId);
  const messages = await getChatMessages(thread.id, 30);
  return NextResponse.json({ threadId: thread.id, messages });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const message = String(body.message ?? "").trim();
  const page = body.page ? String(body.page) : undefined;
  const symbol = body.symbol ? String(body.symbol).toUpperCase() : undefined;

  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const context = { page, symbol };
  let threadId: string | undefined;

  try {
    const thread = await getOrCreateChatThread(session.userId);
    threadId = thread.id;
    const prior = await getChatMessages(thread.id, 20);

    const backendReply = await tryBackendReply(
      message,
      prior.map((m) => ({ role: m.role, content: m.content })),
      context,
    );
    const reply = backendReply ?? generateAssistantFallback(message, context);

    try {
      await addChatMessage(thread.id, "user", message);
      await addChatMessage(thread.id, "assistant", reply);
    } catch {
      // Still return the reply even if persistence fails.
    }

    return NextResponse.json({ reply });
  } catch {
    const reply = generateAssistantFallback(message, context);
    if (threadId) {
      try {
        await addChatMessage(threadId, "user", message);
        await addChatMessage(threadId, "assistant", reply);
      } catch {
        // ignore
      }
    }
    return NextResponse.json({ reply });
  }
}
