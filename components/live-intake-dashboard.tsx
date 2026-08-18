"use client";

import {
  Activity,
  ArrowUp,
  Check,
  CircleAlert,
  Clock3,
  Globe2,
  Headphones,
  PhoneCall,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Intake = {
  name: string | null;
  phone: string | null;
  accidentDate: string | null;
  accidentLocation: string | null;
  accidentDescription: string | null;
  apparentFault: string | null;
  injuries: string[];
  medicalTreatment: string[];
  policeReport: boolean | null;
  otherPartyHasInsurance: string | boolean | null;
  existingAttorney: boolean | null;
  intakeComplete: boolean;
};

type TranscriptTurn = {
  id?: string;
  role?: string;
  text?: string;
  transcript?: string;
  content?: string;
  timestamp?: string;
  at?: string;
};

type LiveState = {
  sessionId: string | null;
  status: "waiting" | "live" | "processing" | "complete" | "error";
  language: string | null;
  intake: Intake;
  transcript: TranscriptTurn[];
  missingFields: string[];
  updatedAt: string | null;
  error?: string;
};

type IntakeField = {
  key: keyof Intake;
  label: string;
  compact?: boolean;
};

const EMPTY_INTAKE: Intake = {
  name: null,
  phone: null,
  accidentDate: null,
  accidentLocation: null,
  accidentDescription: null,
  apparentFault: null,
  injuries: [],
  medicalTreatment: [],
  policeReport: null,
  otherPartyHasInsurance: null,
  existingAttorney: null,
  intakeComplete: false,
};

const EMPTY_STATE: LiveState = {
  sessionId: null,
  status: "waiting",
  language: null,
  intake: EMPTY_INTAKE,
  transcript: [],
  missingFields: [],
  updatedAt: null,
};

const IDENTITY_FIELDS: IntakeField[] = [
  { key: "name", label: "Caller" },
  { key: "phone", label: "Phone" },
  { key: "accidentDate", label: "Incident date" },
  { key: "accidentLocation", label: "Incident location" },
];

const CASE_FIELDS: IntakeField[] = [
  { key: "accidentDescription", label: "What happened" },
  { key: "apparentFault", label: "Reported fault" },
  { key: "injuries", label: "Injuries" },
  { key: "medicalTreatment", label: "Medical treatment" },
];

const SIGNAL_FIELDS: IntakeField[] = [
  { key: "policeReport", label: "Police report", compact: true },
  { key: "otherPartyHasInsurance", label: "Other party insured", compact: true },
  { key: "existingAttorney", label: "Existing attorney", compact: true },
];

const PROGRESS_FIELDS: (keyof Intake)[] = [
  "name",
  "phone",
  "accidentDate",
  "accidentLocation",
  "accidentDescription",
  "apparentFault",
  "injuries",
  "medicalTreatment",
  "policeReport",
  "otherPartyHasInsurance",
  "existingAttorney",
];

const SAMPLES = [
  {
    label: "English",
    value:
      "My name is Jordan Lee, and you can reach me at 415-555-0184. Last Friday, I was stopped at a red light at the corner of Oak and 12th in San Francisco when another driver rear-ended me. I believe the other driver caused the accident. My neck and lower back have hurt since then, and I went to urgent care the same evening. The police made a report. The other driver gave me their insurance card, and I do not have a lawyer.",
  },
  {
    label: "Español",
    value:
      "Me llamo Jordan Lee y mi número es 415-555-0184. El viernes pasado estaba detenido en un semáforo en rojo en la esquina de Oak y la calle 12 en San Francisco cuando otro auto chocó contra la parte trasera de mi coche. Creo que el otro conductor causó el accidente. Me duelen el cuello y la espalda baja, y fui a urgencias esa misma noche. La policía hizo un reporte. El otro conductor me dio su seguro y no tengo abogado.",
  },
  {
    label: "中文",
    value:
      "我叫 Jordan Lee。我的电话号码是 415-555-0184。事故发生在2026年8月14日，地点是旧金山 Oak 街和第十二街的路口。我当时在红灯前停车，后车追尾了我的车。我认为是后车司机造成了事故。事故后我的颈部和下背部疼痛。当天晚上我去了急诊。是的，警方已经制作了事故报告。对方有保险，保险公司是 State Farm。我目前没有律师代理这起事故。",
  },
] as const;

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  "en-US": "English",
  es: "Español",
  "es-US": "Español",
  zh: "中文",
  "zh-CN": "中文",
  "zh-TW": "中文",
  mandarin: "中文",
};

const CATER_PHONE_NUMBER = process.env.NEXT_PUBLIC_CATER_PHONE_NUMBER?.trim();

function isAnswered(value: Intake[keyof Intake]) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined && value !== "";
}

function valueLabel(value: Intake[keyof Intake]) {
  if (Array.isArray(value)) return value.length ? value.join(" · ") : null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value || null;
}

function transcriptText(turn: TranscriptTurn) {
  return turn.text ?? turn.transcript ?? turn.content ?? "";
}

function roleLabel(role?: string) {
  const normalized = role?.toLowerCase();
  if (normalized === "assistant" || normalized === "bot") return "Maya";
  if (normalized === "system" || normalized === "tool") return "Cater";
  return "Caller";
}

function normalizeState(payload: Partial<LiveState>): LiveState {
  const rawStatus = String(payload.status ?? "waiting");
  const status = ({ idle: "waiting", in_progress: "live" } as Record<string, LiveState["status"]>)[rawStatus]
    ?? (["waiting", "live", "processing", "complete", "error"].includes(rawStatus)
      ? (rawStatus as LiveState["status"])
      : "waiting");
  const sourceIntake = (payload.intake ?? {}) as Partial<Intake> & Record<string, unknown>;
  const normalizeYesNo = (value: unknown): boolean | null => {
    if (value === true || value === "yes") return true;
    if (value === false || value === "no") return false;
    return null;
  };
  const otherPartyInsurance = sourceIntake.otherPartyHasInsurance ?? sourceIntake.otherPartyInsurance;
  const normalizedIntake: Intake = {
    name: (sourceIntake.name ?? sourceIntake.fullName ?? null) as string | null,
    phone: (sourceIntake.phone ?? null) as string | null,
    accidentDate: (sourceIntake.accidentDate ?? sourceIntake.incidentDate ?? null) as string | null,
    accidentLocation: (sourceIntake.accidentLocation ?? sourceIntake.incidentLocation ?? null) as string | null,
    accidentDescription: (sourceIntake.accidentDescription ?? sourceIntake.incidentDescription ?? null) as string | null,
    apparentFault: (sourceIntake.apparentFault ?? sourceIntake.reportedFault ?? null) as string | null,
    injuries: Array.isArray(sourceIntake.injuries) ? sourceIntake.injuries as string[] : [],
    medicalTreatment: Array.isArray(sourceIntake.medicalTreatment)
      ? sourceIntake.medicalTreatment as string[]
      : Array.isArray(sourceIntake.treatment) ? sourceIntake.treatment as string[] : [],
    policeReport: normalizeYesNo(sourceIntake.policeReport),
    otherPartyHasInsurance: typeof otherPartyInsurance === "string" && !["yes", "no"].includes(otherPartyInsurance)
      ? otherPartyInsurance
      : normalizeYesNo(otherPartyInsurance),
    existingAttorney: normalizeYesNo(sourceIntake.existingAttorney),
    intakeComplete: Boolean(sourceIntake.intakeComplete) || status === "complete",
  };

  return {
    ...EMPTY_STATE,
    ...payload,
    status,
    intake: normalizedIntake,
    transcript: Array.isArray(payload.transcript) ? payload.transcript : [],
    missingFields: Array.isArray(payload.missingFields) ? payload.missingFields : [],
  };
}

function statusCopy(status: LiveState["status"]) {
  return {
    waiting: {
      label: "Waiting for a call",
      detail: "The dashboard will update as soon as Maya answers.",
    },
    live: {
      label: "Call in progress",
      detail: "Maya is listening and updating the intake live.",
    },
    processing: {
      label: "Understanding response",
      detail: "New details are being added to the case.",
    },
    complete: {
      label: "Intake complete",
      detail: "The caller’s responses are ready for attorney review.",
    },
    error: {
      label: "Connection needs attention",
      detail: "Refresh the dashboard or use the rehearsal input below.",
    },
  }[status];
}

export function LiveIntakeDashboard() {
  const [liveState, setLiveState] = useState<LiveState>(EMPTY_STATE);
  const [connected, setConnected] = useState(false);
  const [demoText, setDemoText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    try {
      const response = await fetch("/api/intake/live", { cache: "no-store" });
      if (!response.ok) throw new Error("Live intake is temporarily unavailable.");
      const payload = (await response.json()) as Partial<LiveState>;
      setLiveState(normalizeState(payload));
      setConnected(true);
      setActionError(null);
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    void fetchState();
    const timer = window.setInterval(() => void fetchState(), 800);
    return () => window.clearInterval(timer);
  }, [fetchState]);

  const answeredCount = useMemo(
    () => PROGRESS_FIELDS.filter((field) => isAnswered(liveState.intake[field])).length,
    [liveState.intake],
  );
  const progress = liveState.intake.intakeComplete
    ? 100
    : Math.round((answeredCount / PROGRESS_FIELDS.length) * 100);
  const effectiveStatus: LiveState["status"] = submitting ? "processing" : liveState.status;
  const callStatus = statusCopy(effectiveStatus);
  const language = liveState.language
    ? LANGUAGE_LABELS[liveState.language] ?? liveState.language
    : "Detecting automatically";

  async function submitDemo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = demoText.trim();
    if (!message || submitting) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const response = await fetch("/api/intake/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message }),
      });
      const payload = (await response.json()) as Partial<LiveState> & { error?: string };
      if (!response.ok) throw new Error(payload.error || "That response could not be processed.");
      setLiveState(normalizeState(payload));
      setDemoText("");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "That response could not be processed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function resetIntake() {
    if (resetting) return;
    setResetting(true);
    setActionError(null);
    try {
      const response = await fetch("/api/intake/reset", { method: "POST" });
      if (!response.ok) throw new Error("The intake could not be reset.");
      const payload = (await response.json()) as Partial<LiveState>;
      setLiveState(normalizeState(payload));
      setDemoText("");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The intake could not be reset.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <main className="intake-shell">
      <aside className="call-rail" aria-label="Live call status">
        <header className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">C</span>
          <span>
            <strong>Cater</strong>
            <small>Harbor &amp; Pine Injury Law</small>
          </span>
        </header>

        <section className="call-stage" aria-labelledby="call-status-heading">
          <div className={`voice-orbit voice-orbit--${effectiveStatus}`} aria-hidden="true">
            <span className="voice-orbit__outer" />
            <span className="voice-orbit__inner">
              {effectiveStatus === "complete" ? <Check /> : <PhoneCall />}
            </span>
          </div>
          <div className="call-status-copy">
            <div className="status-line">
              <span className={`status-dot status-dot--${effectiveStatus}`} aria-hidden="true" />
              <h1 id="call-status-heading">{callStatus.label}</h1>
            </div>
            <p>{callStatus.detail}</p>
          </div>
        </section>

        <dl className="call-meta">
          <div>
            <dt><Globe2 aria-hidden="true" /> Language</dt>
            <dd>{language}</dd>
          </div>
          <div>
            <dt><Activity aria-hidden="true" /> Session</dt>
            <dd>{liveState.sessionId ? liveState.sessionId.slice(-8).toUpperCase() : "Not started"}</dd>
          </div>
          <div>
            <dt><Clock3 aria-hidden="true" /> Last update</dt>
            <dd>{formatUpdateTime(liveState.updatedAt)}</dd>
          </div>
        </dl>

        <div className="call-rail__footer">
          <div className="privacy-note">
            <ShieldCheck aria-hidden="true" />
            <p><strong>Demo workspace</strong><br />Use fictional information only.</p>
          </div>
          <div className="connection-state" aria-live="polite">
            <span className={connected ? "connection-light is-connected" : "connection-light"} />
            {connected ? "Dashboard connected" : "Reconnecting…"}
          </div>
        </div>
      </aside>

      <section className="record-workspace" aria-label="Live intake record">
        <header className="workspace-header">
          <div>
            <div className="workspace-title-row">
              <h2>Live intake</h2>
              {effectiveStatus === "live" || effectiveStatus === "processing" ? (
                <span className="live-badge"><span /> Updating</span>
              ) : null}
            </div>
            <p>Case details appear here as the caller speaks with Maya.</p>
          </div>
          <button className="reset-button" type="button" onClick={resetIntake} disabled={resetting}>
            <RefreshCcw aria-hidden="true" className={resetting ? "is-spinning" : ""} />
            {resetting ? "Resetting" : "New intake"}
          </button>
        </header>

        {(actionError || liveState.error) ? (
          <div className="error-banner" role="alert">
            <CircleAlert aria-hidden="true" />
            <span>{actionError || liveState.error}</span>
          </div>
        ) : null}

        <div className="workspace-grid">
          <div className="case-record">
            <section className="progress-block" aria-label={`${progress}% of intake complete`}>
              <div className="progress-block__copy">
                <span>{liveState.intake.intakeComplete ? "Ready for review" : "Intake progress"}</span>
                <strong>{progress}%</strong>
              </div>
              <div className="progress-track" aria-hidden="true">
                <span style={{ width: `${progress}%` }} />
              </div>
              <p>
                {liveState.intake.intakeComplete
                  ? "All essential intake details have been captured."
                  : `${answeredCount} of ${PROGRESS_FIELDS.length} essential details captured`}
              </p>
            </section>

            <RecordSection title="Caller and incident" icon={<UserRound aria-hidden="true" />}>
              <dl className="field-grid field-grid--identity">
                {IDENTITY_FIELDS.map((field) => (
                  <IntakeValue field={field} intake={liveState.intake} key={field.key} />
                ))}
              </dl>
            </RecordSection>

            <RecordSection title="Case summary" icon={<Sparkles aria-hidden="true" />}>
              <dl className="field-list">
                {CASE_FIELDS.map((field) => (
                  <IntakeValue field={field} intake={liveState.intake} key={field.key} />
                ))}
              </dl>
            </RecordSection>

            <RecordSection title="Qualification signals" icon={<ShieldCheck aria-hidden="true" />}>
              <dl className="signal-grid">
                {SIGNAL_FIELDS.map((field) => (
                  <IntakeValue field={field} intake={liveState.intake} key={field.key} />
                ))}
              </dl>
            </RecordSection>

            {liveState.missingFields.length > 0 && !liveState.intake.intakeComplete ? (
              <section className="missing-block" aria-labelledby="missing-heading">
                <h3 id="missing-heading">Maya is still listening for</h3>
                <p>{liveState.missingFields.map(humanizeField).join(" · ")}</p>
              </section>
            ) : null}
          </div>

          <aside className="conversation-panel" aria-label="Call transcript and rehearsal input">
            <section className="transcript-section" aria-labelledby="transcript-heading">
              <div className="panel-heading">
                <div>
                  <Headphones aria-hidden="true" />
                  <h3 id="transcript-heading">Conversation</h3>
                </div>
                <span>{liveState.transcript.length} turns</span>
              </div>
              <div className="transcript-feed" aria-live="polite" aria-relevant="additions">
                {liveState.transcript.length ? (
                  liveState.transcript.map((turn, index) => {
                    const role = roleLabel(turn.role);
                    const text = transcriptText(turn);
                    if (!text) return null;
                    return (
                      <article
                        className={`transcript-turn transcript-turn--${role.toLowerCase()}`}
                        key={turn.id ?? `${turn.role}-${index}-${text.slice(0, 12)}`}
                      >
                        <div>
                          <strong>{role}</strong>
                          {turn.timestamp || turn.at ? <time>{formatTranscriptTime(turn.timestamp ?? turn.at ?? "")}</time> : null}
                        </div>
                        <p>{text}</p>
                      </article>
                    );
                  })
                ) : (
                  <div className="transcript-empty">
                    <PhoneCall aria-hidden="true" />
                    <strong>The conversation will appear here</strong>
                    {CATER_PHONE_NUMBER ? (
                      <a className="call-number" href={`tel:${CATER_PHONE_NUMBER}`}>
                        Call {formatPhoneNumber(CATER_PHONE_NUMBER)}
                      </a>
                    ) : (
                      <p>Call the intake line, or rehearse below with fictional details.</p>
                    )}
                  </div>
                )}
                {effectiveStatus === "processing" ? (
                  <div className="processing-row" role="status">
                    <span /><span /><span /> Maya is understanding the caller
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rehearsal-section" aria-labelledby="rehearsal-heading">
              <div className="rehearsal-title">
                <div>
                  <h3 id="rehearsal-heading">Rehearse the intake</h3>
                  <p>Uses the same live extraction flow as a phone call.</p>
                </div>
              </div>
              <div className="sample-row" aria-label="Load a fictional sample">
                {SAMPLES.map((sample) => (
                  <button type="button" key={sample.label} onClick={() => setDemoText(sample.value)}>
                    {sample.label}
                  </button>
                ))}
              </div>
              <form onSubmit={submitDemo}>
                <label className="sr-only" htmlFor="demo-response">Fictional caller response</label>
                <textarea
                  id="demo-response"
                  value={demoText}
                  onChange={(event) => setDemoText(event.target.value)}
                  placeholder="Type what the caller says…"
                  rows={4}
                />
                <button type="submit" disabled={!demoText.trim() || submitting} aria-label="Process fictional response">
                  {submitting ? <span className="button-spinner" /> : <ArrowUp aria-hidden="true" />}
                </button>
              </form>
              <p className="synthetic-label">Fictional demo data only. Not legal advice or an attorney-client relationship.</p>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}

function RecordSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="record-section">
      <div className="record-section__heading">
        {icon}
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function IntakeValue({ field, intake }: { field: IntakeField; intake: Intake }) {
  const value = intake[field.key];
  const displayValue = valueLabel(value);
  const answered = isAnswered(value);
  return (
    <div className={`intake-value${field.compact ? " intake-value--compact" : ""}`}>
      <dt>{field.label}</dt>
      <dd className={answered ? "is-answered" : "is-missing"}>
        {answered ? displayValue : "Listening…"}
        {answered ? <Check aria-label="Captured" /> : null}
      </dd>
    </div>
  );
}

function humanizeField(field: string) {
  return field
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_.-]+/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatUpdateTime(value: string | null) {
  if (!value) return "Waiting";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" }).format(date);
}

function formatTranscriptTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return value;
}
