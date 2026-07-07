"use client";

import dynamic from "next/dynamic";

const AiAssistantPanel = dynamic(
  () =>
    import("@/components/features/assistant/ai-assistant-panel").then((m) => m.AiAssistantPanel),
  { ssr: false },
);

/** Lazy-loads the floating AI assistant (client-only). */
export function DashboardAssistant() {
  return <AiAssistantPanel />;
}
