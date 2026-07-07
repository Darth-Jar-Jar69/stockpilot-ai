import { NextResponse } from "next/server";

import { getConfiguredProviders } from "@/lib/auth/oauth/config";

export async function GET() {
  const providers = getConfiguredProviders();
  return NextResponse.json({ providers });
}
