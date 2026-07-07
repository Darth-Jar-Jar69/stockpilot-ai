import { NextResponse } from "next/server";

import { hashPassword } from "@/lib/auth/password";
import {
  createVerificationCode,
  getUserByEmail,
  setPendingVerification,
} from "@/lib/auth/store";

/** Start sign-up — sends a 6-digit email verification code. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const firstName = body.firstName ? String(body.firstName).trim() : undefined;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 },
      );
    }

    if (await getUserByEmail(email)) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    const code = createVerificationCode();
    const passwordHash = await hashPassword(password);

    await setPendingVerification({
      email,
      passwordHash,
      firstName,
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    const response: Record<string, unknown> = {
      message: "Verification code sent. Check your email.",
      needsVerification: true,
    };

    // Dev helper — show code on screen until real email is wired up
    if (process.env.NODE_ENV === "development") {
      response.devCode = code;
    }

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: "Unable to create account." }, { status: 500 });
  }
}
