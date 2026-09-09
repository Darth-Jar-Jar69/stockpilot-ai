import { NextResponse } from "next/server";

import { hashPassword } from "@/lib/auth/password";
import {
  createVerificationCode,
  getUserByEmail,
  setPendingVerification,
} from "@/lib/auth/store";
import { sendVerificationEmail } from "@/lib/email";

/** Start sign-up — emails a 6-digit verification code (inline fallback if email is not configured). */
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

    const delivery = await sendVerificationEmail(email, code);

    const response: Record<string, unknown> = {
      needsVerification: true,
      emailDelivery: delivery.mode,
    };

    if (delivery.mode === "email") {
      response.message = "Verification code sent. Check your email (and spam folder).";
    } else {
      // Keep signup usable until RESEND_API_KEY is configured on the host.
      response.message =
        "Email delivery is not configured yet — use the code shown below to verify.";
      response.devCode = code;
    }

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: "Unable to create account." }, { status: 500 });
  }
}
