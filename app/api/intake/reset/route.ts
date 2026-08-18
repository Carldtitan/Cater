import { NextResponse } from "next/server";

import { resetRequestSchema } from "@/lib/intake/schema";
import {
  createSession,
  deleteSession,
  getLatestSessionId,
  publicSession,
  saveSession,
} from "@/lib/intake/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const preferredRegion = "iad1";

export async function POST(request: Request) {
  const parsed = resetRequestSchema.safeParse((await safeJson(request)) ?? {});
  if (!parsed.success) {
    return noStore(NextResponse.json({ error: "Invalid session ID." }, { status: 400 }));
  }
  const sessionId =
    parsed.data.sessionId ?? (await getLatestSessionId()) ?? "demo";
  await deleteSession(sessionId);
  const session = await saveSession(createSession(sessionId));
  return noStore(NextResponse.json(publicSession(session)));
}

async function safeJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
