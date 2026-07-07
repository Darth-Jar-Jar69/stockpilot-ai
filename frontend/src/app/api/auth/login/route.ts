import { NextResponse } from "next/server";

import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, sessionCookieOptions } from "@/lib/auth/session";
import { getUserByEmail } from "@/lib/auth/store";

/** Sign in with email and password. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const user = await getUserByEmail(email);
    if (!user || !user.verified) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        { error: "This account uses Google sign-in." },
        { status: 401 },
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      firstName: user.firstName ?? undefined,
    });

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, firstName: user.firstName },
    });
    response.cookies.set(sessionCookieOptions(token));
    return response;
  } catch {
    return NextResponse.json({ error: "Unable to sign in." }, { status: 500 });
  }
}
