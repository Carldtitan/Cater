import { NextResponse } from "next/server";

import { getLatestSession, getSession, publicSession } from "@/lib/intake/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const preferredRegion = "iad1";

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("sessionId")?.trim();
  const session = sessionId
    ? await getSession(sessionId)
    : await getLatestSession();
  return noStore(NextResponse.json(publicSession(session)));
}

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
