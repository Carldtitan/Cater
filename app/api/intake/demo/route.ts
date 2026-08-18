import { NextResponse } from "next/server";

import { demoRequestSchema } from "@/lib/intake/schema";
import { processIntakeTurn, recordIntakeError } from "@/lib/intake/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const preferredRegion = "iad1";

export async function POST(request: Request) {
  const parsed = demoRequestSchema.safeParse(await safeJson(request));
  if (!parsed.success) {
    return noStore(
      NextResponse.json(
        { error: "Enter a caller response to update the intake." },
        { status: 400 },
      ),
    );
  }
  const sessionId = parsed.data.sessionId ?? "demo";
  try {
    const result = await processIntakeTurn({
      sessionId,
      latestAnswer: parsed.data.text,
    });
    return noStore(NextResponse.json(result));
  } catch (error) {
    console.error("Cater demo extraction failed", safeError(error));
    const state = await recordIntakeError(sessionId, error);
    return noStore(NextResponse.json(state, { status: 502 }));
  }
}

async function safeJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function safeError(error: unknown) {
  return {
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : "Unknown error",
  };
}

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
