import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { processIntakeTurn, recordIntakeError } from "@/lib/intake/service";
import {
  extractVapiTranscript,
  latestCallerAnswer,
  parseVapiToolCalls,
  vapiSessionId,
} from "@/lib/intake/vapi";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const preferredRegion = "iad1";

export async function POST(request: Request) {
  const secret = process.env.CATER_WEBHOOK_SECRET;
  if (!secret) {
    return noStore(
      NextResponse.json({ error: "Webhook authentication is not configured." }, { status: 503 }),
    );
  }
  if (!secureEqual(request.headers.get("x-cater-webhook-secret"), secret)) {
    return noStore(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }

  const payload = await safeJson(request);
  const toolCalls = parseVapiToolCalls(payload).filter(
    (call) => call.name === "sync_intake",
  );
  if (!toolCalls.length) {
    return noStore(
      NextResponse.json({ error: "No sync_intake tool call was provided." }, { status: 400 }),
    );
  }

  const transcript = extractVapiTranscript(payload);
  const results = [];
  for (const call of toolCalls) {
    const sessionId = vapiSessionId(payload, call.arguments);
    const answer = latestCallerAnswer(call.arguments, transcript);
    if (!answer) {
      results.push({
        toolCallId: call.id,
        result: JSON.stringify({
          error: "No caller answer was available to synchronize.",
        }),
      });
      continue;
    }

    try {
      const result = await processIntakeTurn({
        sessionId,
        latestAnswer: answer,
        transcript,
        toolCallId: call.id,
      });
      results.push({ toolCallId: call.id, result: JSON.stringify(result) });
    } catch (error) {
      console.error("Cater Vapi intake synchronization failed", safeError(error));
      const state = await recordIntakeError(sessionId, error);
      results.push({
        toolCallId: call.id,
        result: JSON.stringify({
          ...state,
          error: "The live intake could not be updated. Continue the call naturally and retry on the next answer.",
        }),
      });
    }
  }

  return noStore(NextResponse.json({ results }));
}

function secureEqual(provided: string | null, expected: string) {
  if (!provided) return false;
  const actual = Buffer.from(provided);
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
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
