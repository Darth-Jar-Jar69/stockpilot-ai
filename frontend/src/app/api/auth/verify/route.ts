import { NextResponse } from "next/server";

import { createSessionToken, sessionCookieOptions } from "@/lib/auth/session";
import {
  clearPendingVerification,
  getPendingVerification,
  saveUser,
} from "@/lib/auth/store";

/** Confirm email with 6-digit code and create the session. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const code = String(body.code ?? "").trim();

    if (!email || !code) {
      return NextResponse.json({ error: "Email and code are required." }, { status: 400 });
    }

    const pending = await getPendingVerification(email);
    if (!pending) {
      return NextResponse.json(
        { error: "Verification expired. Please sign up again." },
        { status: 400 },
      );
    }

    if (pending.code !== code) {
      return NextResponse.json({ error: "Invalid verification code." }, { status: 400 });
    }

    const user = await saveUser({
      email,
      passwordHash: pending.passwordHash,
      firstName: pending.firstName,
      verified: true,
    });

    await clearPendingVerification(email);

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      firstName: user.firstName ?? undefined,
    });

    const response = NextResponse.json({
      message: "Account verified.",
      user: { id: user.id, email: user.email, firstName: user.firstName },
    });
    response.cookies.set(sessionCookieOptions(token));
    return response;
  } catch {
    return NextResponse.json({ error: "Verification failed." }, { status: 500 });
  }
}
