import { getCache } from "@vercel/functions";

import { calculateMissingFields } from "./logic";
import {
  emptyIntake,
  intakeSessionSchema,
  type IntakeSession,
  type InternalIntakeSession,
} from "./schema";

const TTL_SECONDS = 30 * 60;
const LATEST_KEY = "latest-session";
const memory = globalThis as typeof globalThis & {
  __caterSessions?: Map<string, InternalIntakeSession>;
  __caterLatestSession?: string;
};

function memorySessions() {
  memory.__caterSessions ??= new Map();
  return memory.__caterSessions;
}

export function createSession(sessionId: string): InternalIntakeSession {
  const intake = emptyIntake();
  return {
    sessionId,
    status: "idle",
    language: "en",
    intake,
    transcript: [],
    missingFields: calculateMissingFields(intake),
    updatedAt: new Date().toISOString(),
    processedToolCalls: {},
  };
}

export async function getSession(
  sessionId: string,
): Promise<InternalIntakeSession> {
  const cached = await cacheGet<InternalIntakeSession>(sessionKey(sessionId));
  if (cached) return normalizeInternal(cached);
  return memorySessions().get(sessionId) ?? createSession(sessionId);
}

export async function saveSession(session: InternalIntakeSession) {
  const normalized = normalizeInternal(session);
  memorySessions().set(normalized.sessionId, normalized);
  memory.__caterLatestSession = normalized.sessionId;
  await Promise.all([
    cacheSet(sessionKey(normalized.sessionId), normalized),
    cacheSet(LATEST_KEY, normalized.sessionId),
  ]);
  return normalized;
}

export async function getLatestSessionId() {
  const cached = await cacheGet<string>(LATEST_KEY);
  return cached ?? memory.__caterLatestSession;
}

export async function getLatestSession(): Promise<InternalIntakeSession> {
  const sessionId = (await getLatestSessionId()) ?? "demo";
  return getSession(sessionId);
}

export async function deleteSession(sessionId: string) {
  memorySessions().delete(sessionId);
  if (memory.__caterLatestSession === sessionId) {
    memory.__caterLatestSession = undefined;
  }
  try {
    const cache = getCache({ namespace: "cater-intake" });
    await cache.delete(sessionKey(sessionId));
    const latest = await cache.get(LATEST_KEY);
    if (latest === sessionId) await cache.delete(LATEST_KEY);
  } catch {
    // The in-memory fallback is expected when running outside Vercel.
  }
}

export function publicSession(session: InternalIntakeSession): IntakeSession {
  const { processedToolCalls: _processedToolCalls, ...publicState } = session;
  return intakeSessionSchema.parse(publicState);
}

function normalizeInternal(value: InternalIntakeSession): InternalIntakeSession {
  const { processedToolCalls, ...candidate } = value;
  return {
    ...intakeSessionSchema.parse(candidate),
    processedToolCalls:
      processedToolCalls && typeof processedToolCalls === "object"
        ? processedToolCalls
        : {},
  };
}

function sessionKey(sessionId: string) {
  return `session:${sessionId}`;
}

async function cacheGet<T>(key: string): Promise<T | undefined> {
  try {
    return (await getCache({ namespace: "cater-intake" }).get(key)) as
      | T
      | undefined;
  } catch {
    return undefined;
  }
}

async function cacheSet(key: string, value: unknown) {
  try {
    await getCache({ namespace: "cater-intake" }).set(key, value, {
      ttl: TTL_SECONDS,
      tags: ["cater-intake"],
      name: "cater-live-intake",
    });
  } catch {
    // The in-memory fallback keeps local demos working without Vercel context.
  }
}
