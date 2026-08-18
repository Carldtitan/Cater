import { extractIntakePatch } from "./gemini";
import {
  calculateMissingFields,
  mergeIntake,
  mergeTranscript,
  nextQuestion,
} from "./logic";
import type { TranscriptEntry } from "./schema";
import {
  getSession,
  publicSession,
  saveSession,
} from "./store";

type ProcessTurnInput = {
  sessionId: string;
  latestAnswer: string;
  transcript?: TranscriptEntry[];
  toolCallId?: string;
};

export async function processIntakeTurn({
  sessionId,
  latestAnswer,
  transcript = [],
  toolCallId,
}: ProcessTurnInput) {
  const session = await getSession(sessionId);
  if (toolCallId && session.processedToolCalls[toolCallId]) {
    return JSON.parse(session.processedToolCalls[toolCallId]) as ReturnTypeShape;
  }

  const now = new Date().toISOString();
  const callerEntry: TranscriptEntry = {
    role: "user",
    text: latestAnswer,
    at: now,
  };
  const mergedTranscript = mergeTranscript(session.transcript, [
    ...transcript,
    callerEntry,
  ]);
  let patch = await extractIntakePatch({
    currentIntake: session.intake,
    currentLanguage: session.language,
    transcript: mergedTranscript,
    latestAnswer,
  });
  let intake = mergeIntake(session.intake, patch);
  let missingFields = calculateMissingFields(intake);

  // Broad answers often contain many facts. Structured models can occasionally
  // omit one even when it is explicit, so review only the remaining fields and
  // merge the additional model output instead of relying on a single pass.
  if (latestAnswer.length >= 120) {
    for (let review = 0; review < 2 && missingFields.length; review += 1) {
      patch = await extractIntakePatch({
        currentIntake: intake,
        currentLanguage: patch.language,
        transcript: mergedTranscript,
        latestAnswer,
        focusFields: missingFields,
      });
      intake = mergeIntake(intake, patch);
      missingFields = calculateMissingFields(intake);
    }
  }
  const question = nextQuestion(
    patch.language,
    missingFields,
    patch.nextQuestion,
  );
  const resultState = {
    ...session,
    status: missingFields.length ? ("in_progress" as const) : ("complete" as const),
    language: patch.language,
    intake,
    transcript: mergedTranscript,
    missingFields,
    updatedAt: now,
    error: undefined,
  };
  const response: ReturnTypeShape = {
    ...publicSession(resultState),
    detectedLanguage: patch.language,
    nextQuestion: question,
  };
  if (toolCallId) {
    resultState.processedToolCalls[toolCallId] = JSON.stringify(response);
    // Bound metadata so a long-running demo cannot grow without limit.
    const ids = Object.keys(resultState.processedToolCalls);
    for (const id of ids.slice(0, -100)) {
      delete resultState.processedToolCalls[id];
    }
  }
  await saveSession(resultState);
  return response;
}

export async function recordIntakeError(sessionId: string, error: unknown) {
  const session = await getSession(sessionId);
  const message =
    error instanceof Error ? error.message : "The intake update failed.";
  const failed = await saveSession({
    ...session,
    status: "error",
    error: message,
    updatedAt: new Date().toISOString(),
  });
  return publicSession(failed);
}

type ReturnTypeShape = ReturnType<typeof publicSession> & {
  detectedLanguage: "en" | "es" | "zh";
  nextQuestion: string;
};
