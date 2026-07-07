import logging

import httpx

from app.core.config import settings
from app.schemas.scanner import ChatContext, ChatMessage
from app.services.ai.fallback import generate_fallback_reply

logger = logging.getLogger("stockpilot.ai.chat")

SYSTEM_PROMPT = """You are the StockPilot Assistant — a helpful AI investing copilot for the StockPilot platform.

Rules:
- Only discuss stocks, markets, and features of the StockPilot app.
- Never invent prices, P/E ratios, or scores. If live data is not in context, say you don't have it and suggest checking the analysis page.
- Be concise, friendly, and educational. Explain indicators in plain language.
- Always remind users this is research, not financial advice.
- If the user asks about a symbol in context, reference that symbol specifically.
"""


def _build_system_message(context: ChatContext | None) -> str:
    parts = [SYSTEM_PROMPT]
    if not context:
        return parts[0]

    if context.page:
        parts.append(f"User is currently on page: {context.page}")
    if context.symbol:
        parts.append(f"User is viewing symbol: {context.symbol.upper()}")
    return "\n".join(parts)


async def generate_chat_reply(
    message: str,
    history: list[ChatMessage],
    context: ChatContext | None = None,
) -> str:
    if not settings.openai_api_key:
        logger.info("OpenAI key missing — using fallback assistant")
        return generate_fallback_reply(message, context)

    messages: list[dict[str, str]] = [
        {"role": "system", "content": _build_system_message(context)},
    ]
    for item in history[-10:]:
        if item.role in ("user", "assistant"):
            messages.append({"role": item.role, "content": item.content})
    messages.append({"role": "user", "content": message})

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.openai_model,
                    "messages": messages,
                    "temperature": 0.4,
                    "max_tokens": 800,
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()
    except httpx.HTTPStatusError as exc:
        logger.warning("OpenAI unavailable (%s) — using fallback assistant", exc.response.status_code)
        return generate_fallback_reply(message, context)
    except Exception as exc:
        logger.warning("Chat generation failed: %s — using fallback", exc)
        return generate_fallback_reply(message, context)
