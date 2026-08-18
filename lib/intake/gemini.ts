import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";

import { extractionPatchSchema } from "./schema";
import type {
  ExtractionPatch,
  IntakeLanguage,
  PersonalInjuryIntake,
  TranscriptEntry,
} from "./schema";

const SYSTEM_PROMPT = `You are the structured intake engine for Cater, a personal-injury law firm intake assistant.

Return only schema-conforming JSON. Extract facts, not legal conclusions.

Rules:
- Never invent, assume, diagnose, estimate case value, determine fault, promise representation, or give legal advice.
- Only update a field when the caller explicitly supplies or corrects it in the latest answer. Use earlier transcript only to resolve references.
- Extract every supported explicit fact from the latest answer. One broad answer may update every intake field; do not stop after finding only the first few facts.
- Preserve the caller's wording for names, dates, locations, injuries, treatment, insurers, and accident details. Do not translate proper names.
- When the caller explicitly corrects a scalar, emit the corrected value in updates.
- Use null only when the caller explicitly withdraws or says they do not know a previously supplied scalar value.
- For injuries and treatment, use append for additional facts, replace for an explicit correction of the list, and clear only when explicitly withdrawn.
- If the caller explicitly says they have no injury, symptoms, or treatment, store a short localized fact such as "No injuries reported" or "No treatment yet" instead of leaving the array empty.
- policeReport and existingAttorney are yes/no only when clearly answered.
- Do not omit explicit affirmative or negative facts in any supported language. If the caller says a police report was made, set policeReport to yes. If the caller says no lawyer represents them, set existingAttorney to no. Apply the same meaning in English, Spanish, and Mandarin rather than looking only for the literal words yes or no.
- Detect the language of the latest caller answer as en (English), es (Spanish), or zh (Mandarin Chinese). Remain in the supplied current language for short or ambiguous answers such as yes, no, names, numbers, and dates.
- nextQuestion asks exactly one short, natural question in the detected language for the earliest important missing field after applying the updates. It must not repeat information already known.
- If no fields remain missing, nextQuestion is a brief localized thank-you stating that the intake team will review the information.
- Do not add sympathy to every turn and do not use filler.
- Cater is an automated intake assistant, not an attorney.`;

type ExtractInput = {
  currentIntake: PersonalInjuryIntake;
  currentLanguage: IntakeLanguage;
  transcript: TranscriptEntry[];
  latestAnswer: string;
};

export async function extractIntakePatch({
  currentIntake,
  currentLanguage,
  transcript,
  latestAnswer,
}: ExtractInput): Promise<ExtractionPatch> {
  const apiKey = process.env.GEMINI_HACK_API_KEY;
  if (!apiKey) throw new Error("GEMINI_HACK_API_KEY is not configured");

  const schema = z.toJSONSchema(extractionPatchSchema) as Record<
    string,
    unknown
  >;
  delete schema.$schema;

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { timeout: 20_000 },
  });
  const configuredModel = process.env.GEMINI_HACK_MODEL?.trim();
  const model =
    configuredModel && /^gemini-[a-z0-9.-]+$/i.test(configuredModel)
      ? configuredModel
      : "gemini-3.5-flash";
  const response = await ai.models.generateContent({
    model,
    contents: `Current language: ${currentLanguage}
Current intake JSON:
${JSON.stringify(currentIntake)}

Conversation transcript:
${formatTranscript(transcript)}

Latest caller answer to process:
${latestAnswer}`,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseJsonSchema: schema,
      thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      // Gemini 3 counts internal reasoning against this budget. Leave enough
      // room for the complete schema so the JSON response is never truncated.
      maxOutputTokens: 4_096,
    },
  });

  const text = response.text?.trim();
  if (!text) throw new Error("Gemini returned an empty intake extraction");
  return extractionPatchSchema.parse(JSON.parse(text));
}

function formatTranscript(entries: TranscriptEntry[]) {
  if (!entries.length) return "(No earlier transcript.)";
  return entries
    .slice(-40)
    .map((entry) => `${entry.role === "assistant" ? "Assistant" : "Caller"}: ${entry.text}`)
    .join("\n");
}
