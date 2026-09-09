import { SITE_NAME } from "@/lib/branding";

type SendResult =
  | { ok: true; mode: "email" }
  | { ok: false; mode: "inline"; error: string };

function getFromAddress(): string {
  return process.env.EMAIL_FROM?.trim() || `${SITE_NAME} <onboarding@resend.dev>`;
}

/** Send a transactional email via Resend. Falls back to inline code if not configured. */
export async function sendVerificationEmail(
  to: string,
  code: string,
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    return {
      ok: false,
      mode: "inline",
      error: "Email provider not configured (RESEND_API_KEY missing).",
    };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: getFromAddress(),
        to: [to],
        subject: `${code} is your ${SITE_NAME} verification code`,
        text: [
          `Your ${SITE_NAME} verification code is: ${code}`,
          "",
          "This code expires in 10 minutes.",
          "If you did not create an account, you can ignore this email.",
        ].join("\n"),
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
            <h1 style="font-size:20px;margin:0 0 12px">${SITE_NAME}</h1>
            <p style="margin:0 0 16px;color:#334155">Use this code to verify your email:</p>
            <p style="font-size:32px;letter-spacing:0.25em;font-weight:700;margin:0 0 16px">${code}</p>
            <p style="margin:0;color:#64748b;font-size:14px">Expires in 10 minutes. If you didn't sign up, ignore this email.</p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("Resend error:", res.status, body);
      return {
        ok: false,
        mode: "inline",
        error: `Email provider returned ${res.status}.`,
      };
    }

    return { ok: true, mode: "email" };
  } catch (error) {
    console.error("Resend request failed:", error);
    return {
      ok: false,
      mode: "inline",
      error: "Failed to reach email provider.",
    };
  }
}
