import { z } from "zod";

export const intakeLanguageSchema = z.enum(["en", "es", "zh"]);
export type IntakeLanguage = z.infer<typeof intakeLanguageSchema>;

const optionalFact = z.string().trim().min(1).nullable();

export const personalInjuryIntakeSchema = z
  .object({
    fullName: optionalFact,
    phone: optionalFact,
    incidentDate: optionalFact,
    incidentLocation: optionalFact,
    incidentDescription: optionalFact,
    reportedFault: optionalFact,
    injuries: z.array(z.string().trim().min(1)).max(20),
    treatment: z.array(z.string().trim().min(1)).max(20),
    policeReport: z.enum(["yes", "no"]).nullable(),
    otherPartyInsurance: optionalFact,
    existingAttorney: z.enum(["yes", "no"]).nullable(),
  })
  .strict();

export type PersonalInjuryIntake = z.infer<typeof personalInjuryIntakeSchema>;

export const emptyIntake = (): PersonalInjuryIntake => ({
  fullName: null,
  phone: null,
  incidentDate: null,
  incidentLocation: null,
  incidentDescription: null,
  reportedFault: null,
  injuries: [],
  treatment: [],
  policeReport: null,
  otherPartyInsurance: null,
  existingAttorney: null,
});

export const transcriptEntrySchema = z
  .object({
    role: z.enum(["assistant", "user"]),
    text: z.string().trim().min(1),
    at: z.string().datetime().optional(),
  })
  .strict();

export type TranscriptEntry = z.infer<typeof transcriptEntrySchema>;

export const intakeStatusSchema = z.enum([
  "idle",
  "in_progress",
  "complete",
  "error",
]);

export const intakeSessionSchema = z
  .object({
    sessionId: z.string().trim().min(1),
    status: intakeStatusSchema,
    language: intakeLanguageSchema,
    intake: personalInjuryIntakeSchema,
    transcript: z.array(transcriptEntrySchema).max(500),
    missingFields: z.array(z.string()),
    updatedAt: z.string().datetime(),
    error: z.string().optional(),
  })
  .strict();

export type IntakeSession = z.infer<typeof intakeSessionSchema>;

export type InternalIntakeSession = IntakeSession & {
  processedToolCalls: Record<string, string>;
};

export const scalarIntakeFieldSchema = z.enum([
  "fullName",
  "phone",
  "incidentDate",
  "incidentLocation",
  "incidentDescription",
  "reportedFault",
  "policeReport",
  "otherPartyInsurance",
  "existingAttorney",
]);

export const extractionPatchSchema = z
  .object({
    language: intakeLanguageSchema,
    updates: z
      .object({
        fullName: optionalFact.optional(),
        phone: optionalFact.optional(),
        incidentDate: optionalFact.optional(),
        incidentLocation: optionalFact.optional(),
        incidentDescription: optionalFact.optional(),
        reportedFault: optionalFact.optional(),
        policeReport: z.enum(["yes", "no"]).nullable().optional(),
        otherPartyInsurance: optionalFact.optional(),
        existingAttorney: z.enum(["yes", "no"]).nullable().optional(),
      })
      .strict(),
    arrayUpdates: z
      .object({
        injuries: z
          .object({
            operation: z.enum(["append", "replace", "clear"]),
            values: z.array(z.string().trim().min(1)).max(20),
          })
          .strict()
          .optional(),
        treatment: z
          .object({
            operation: z.enum(["append", "replace", "clear"]),
            values: z.array(z.string().trim().min(1)).max(20),
          })
          .strict()
          .optional(),
      })
      .strict(),
    nextQuestion: z.string().trim().max(300),
  })
  .strict();

export type ExtractionPatch = z.infer<typeof extractionPatchSchema>;

export const demoRequestSchema = z
  .object({
    text: z.string().trim().min(1).max(10_000),
    sessionId: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

export const resetRequestSchema = z
  .object({ sessionId: z.string().trim().min(1).max(200).optional() })
  .strict();
