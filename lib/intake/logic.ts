import type {
  ExtractionPatch,
  IntakeLanguage,
  PersonalInjuryIntake,
  TranscriptEntry,
} from "./schema";

export const REQUIRED_FIELDS = [
  "fullName",
  "phone",
  "incidentDate",
  "incidentLocation",
  "incidentDescription",
  "reportedFault",
  "injuries",
  "treatment",
  "policeReport",
  "otherPartyInsurance",
  "existingAttorney",
] as const;

export type RequiredField = (typeof REQUIRED_FIELDS)[number];

export function calculateMissingFields(
  intake: PersonalInjuryIntake,
): RequiredField[] {
  return REQUIRED_FIELDS.filter((field) => {
    const value = intake[field];
    return Array.isArray(value) ? value.length === 0 : value === null;
  });
}

export function mergeIntake(
  current: PersonalInjuryIntake,
  patch: ExtractionPatch,
): PersonalInjuryIntake {
  const next: PersonalInjuryIntake = {
    ...current,
    injuries: [...current.injuries],
    treatment: [...current.treatment],
  };

  for (const [field, value] of Object.entries(patch.updates)) {
    if (value !== undefined) {
      (next as Record<string, unknown>)[field] = value;
    }
  }

  for (const field of ["injuries", "treatment"] as const) {
    const update = patch.arrayUpdates[field];
    if (!update) continue;
    if (update.operation === "clear") {
      next[field] = [];
    } else if (update.operation === "replace") {
      next[field] = unique(update.values);
    } else {
      next[field] = unique([...next[field], ...update.values]);
    }
  }

  return next;
}

export function mergeTranscript(
  current: TranscriptEntry[],
  incoming: TranscriptEntry[],
): TranscriptEntry[] {
  const seen = new Set(
    current.map((entry) => `${entry.role}:${normalize(entry.text)}`),
  );
  const merged = [...current];
  for (const entry of incoming) {
    const key = `${entry.role}:${normalize(entry.text)}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(entry);
    }
  }
  return merged.slice(-500);
}

const QUESTIONS: Record<IntakeLanguage, Record<RequiredField, string>> = {
  en: {
    fullName: "May I have your full name?",
    phone: "What is the best phone number to reach you?",
    incidentDate: "When did the accident happen?",
    incidentLocation: "Where did the accident happen?",
    incidentDescription: "Please briefly tell me what happened.",
    reportedFault: "Who do you believe caused the accident?",
    injuries: "What injuries or symptoms have you had?",
    treatment: "What medical care have you received so far?",
    policeReport: "Was a police report made?",
    otherPartyInsurance: "Do you have the other party's insurance information?",
    existingAttorney: "Are you already represented by an attorney for this matter?",
  },
  es: {
    fullName: "¿Me puede decir su nombre completo?",
    phone: "¿Cuál es el mejor número para comunicarnos con usted?",
    incidentDate: "¿Cuándo ocurrió el accidente?",
    incidentLocation: "¿Dónde ocurrió el accidente?",
    incidentDescription: "Cuénteme brevemente qué ocurrió.",
    reportedFault: "¿Quién cree que causó el accidente?",
    injuries: "¿Qué lesiones o síntomas ha tenido?",
    treatment: "¿Qué atención médica ha recibido hasta ahora?",
    policeReport: "¿Se hizo un informe policial?",
    otherPartyInsurance: "¿Tiene la información del seguro de la otra parte?",
    existingAttorney: "¿Ya tiene un abogado para este asunto?",
  },
  zh: {
    fullName: "请问您的全名是什么？",
    phone: "请问用哪个电话号码联系您最方便？",
    incidentDate: "事故是什么时候发生的？",
    incidentLocation: "事故在哪里发生的？",
    incidentDescription: "请简要告诉我事故是怎么发生的。",
    reportedFault: "您认为是谁造成了这起事故？",
    injuries: "您有哪些伤势或症状？",
    treatment: "到目前为止，您接受了哪些医疗处理？",
    policeReport: "警方是否出具了事故报告？",
    otherPartyInsurance: "您有对方的保险信息吗？",
    existingAttorney: "您是否已经委托律师处理这件事？",
  },
};

const COMPLETE: Record<IntakeLanguage, string> = {
  en: "Thank you. I have the information needed for the intake team to review.",
  es: "Gracias. Ya tengo la información necesaria para que el equipo revise su caso.",
  zh: "谢谢。我已经收集了受理团队审核所需的信息。",
};

export function nextQuestion(
  language: IntakeLanguage,
  missingFields: readonly RequiredField[],
  modelQuestion?: string,
): string {
  if (!missingFields.length) return COMPLETE[language];
  const expected = QUESTIONS[language][missingFields[0]];
  // The model may phrase the same follow-up more naturally. Bound it to a short,
  // non-empty question; the deterministic localized prompt remains the fallback.
  const candidate = modelQuestion?.trim();
  return candidate && candidate.length <= 300 ? candidate : expected;
}

function unique(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalize(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}
