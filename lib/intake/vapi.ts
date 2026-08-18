import { z } from "zod";

import { transcriptEntrySchema, type TranscriptEntry } from "./schema";

export type VapiToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export function parseVapiToolCalls(payload: unknown): VapiToolCall[] {
  const root = asRecord(payload);
  const message = asRecord(root.message);
  const candidates =
    asArray(message.toolCallList).length > 0
      ? asArray(message.toolCallList)
      : asArray(root.toolCallList).length > 0
        ? asArray(root.toolCallList)
        : asArray(message.toolCalls).length > 0
          ? asArray(message.toolCalls)
          : asArray(root.toolCalls);

  return candidates.flatMap((candidate) => {
    const call = asRecord(candidate);
    const fn = asRecord(call.function);
    const name = stringValue(fn.name) ?? stringValue(call.name);
    const id =
      stringValue(call.id) ??
      stringValue(call.toolCallId) ??
      crypto.randomUUID();
    if (!name) return [];
    return [
      {
        id,
        name,
        arguments: parseArguments(fn.arguments ?? call.arguments),
      },
    ];
  });
}

export function vapiSessionId(payload: unknown, args?: Record<string, unknown>) {
  const root = asRecord(payload);
  const message = asRecord(root.message);
  const call = asRecord(message.call ?? root.call);
  return (
    stringValue(args?.sessionId) ??
    stringValue(call.id) ??
    stringValue(call.callId) ??
    stringValue(message.callId) ??
    "vapi-live"
  );
}

export function extractVapiTranscript(payload: unknown): TranscriptEntry[] {
  const root = asRecord(payload);
  const message = asRecord(root.message);
  const artifact = asRecord(message.artifact ?? root.artifact);
  const sources = [
    ...asArray(artifact.messages),
    ...asArray(message.messages),
    ...asArray(root.messages),
  ];
  const entries = sources.flatMap((source) => {
    const entry = asRecord(source);
    const rawRole = stringValue(entry.role);
    const role = rawRole === "assistant" || rawRole === "bot" ? "assistant" : rawRole === "user" || rawRole === "caller" ? "user" : null;
    const text =
      stringValue(entry.message) ??
      stringValue(entry.content) ??
      stringValue(entry.text) ??
      stringValue(entry.transcript);
    if (!role || !text) return [];
    const parsed = transcriptEntrySchema.safeParse({ role, text });
    return parsed.success ? [parsed.data] : [];
  });

  if (entries.length) return entries;
  const plainTranscript =
    stringValue(artifact.transcript) ??
    stringValue(message.transcript) ??
    stringValue(root.transcript);
  return plainTranscript ? parsePlainTranscript(plainTranscript) : [];
}

export function latestCallerAnswer(
  args: Record<string, unknown>,
  transcript: TranscriptEntry[],
) {
  const explicit =
    stringValue(args.latestAnswer) ??
    stringValue(args.answer) ??
    stringValue(args.transcript) ??
    stringValue(args.text);
  if (explicit) return explicit;
  return [...transcript].reverse().find((entry) => entry.role === "user")?.text;
}

function parsePlainTranscript(value: string): TranscriptEntry[] {
  return value
    .split(/\r?\n/)
    .flatMap((line) => {
      const match = line.match(/^\s*(assistant|bot|user|caller)\s*:\s*(.+)$/i);
      if (!match) return [];
      const role = /assistant|bot/i.test(match[1]) ? "assistant" : "user";
      const parsed = transcriptEntrySchema.safeParse({ role, text: match[2] });
      return parsed.success ? [parsed.data] : [];
    });
}

function parseArguments(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return asRecord(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown) {
  const result = z.string().trim().min(1).safeParse(value);
  return result.success ? result.data : undefined;
}
