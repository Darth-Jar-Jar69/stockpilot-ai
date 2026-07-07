import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/session";

/** Clear the session cookie. */
export async function POST() {
  const response = NextResponse.json({ message: "Signed out." });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
