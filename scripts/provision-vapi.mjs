#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const VAPI_API_BASE = "https://api.vapi.ai";
const ASSISTANT_GREETING =
  "Thanks for calling Harbor & Pine Injury Law. I'm Maya, the automated intake assistant. We can continue in English, Spanish, or Mandarin. Which do you prefer?";
const GOOGLE_CREDENTIAL_NAME = "Cater Gemini Hack";
const TOOL_NAME = "sync_intake";
const PROMPT_START = "<!-- CATER_LIVE_MULTILINGUAL_INTAKE_V1_START -->";
const PROMPT_END = "<!-- CATER_LIVE_MULTILINGUAL_INTAKE_V1_END -->";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultSourceEnv = resolve(
  scriptDir,
  "..",
  "..",
  "Alix and Anvil hack",
  ".env",
);

const flags = new Set(process.argv.slice(2));
const dryRun = flags.has("--dry-run");
const verifyOnly = flags.has("--verify");

if (flags.has("--help") || flags.has("-h")) {
  console.log(`Cater Vapi provisioner

Usage:
  node scripts/provision-vapi.mjs --dry-run
  node scripts/provision-vapi.mjs
  node scripts/provision-vapi.mjs --verify

Required for provisioning:
  CATER_BASE_URL             Deployed Cater URL, for example https://cater.vercel.app
  CATER_WEBHOOK_SECRET       Secret sent as x-cater-webhook-secret

The script reads Clearway's local .env by default. Override it with:
  CLEARWAY_SOURCE_ENV=C:\\path\\to\\source.env

No secret values are printed.`);
  process.exit(0);
}

function parseEnvFile(path) {
  if (!existsSync(path)) {
    throw new Error(`Source environment file was not found: ${path}`);
  }

  const parsed = {};
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    let value = match[2].trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    parsed[match[1]] = value
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r");
  }
  return parsed;
}

const sourceEnvPath = resolve(
  process.env.CLEARWAY_SOURCE_ENV || defaultSourceEnv,
);
const fileEnv = parseEnvFile(sourceEnvPath);
const env = { ...fileEnv, ...process.env };

const requiredAlways = [
  "VAPI_PRIVATE_KEY",
  "NEXT_PUBLIC_VAPI_ASSISTANT_ID",
  "GEMINI_HACK_API_KEY",
];
const requiredForMutation = ["CATER_BASE_URL", "CATER_WEBHOOK_SECRET"];
const missing = [
  ...requiredAlways,
  ...(verifyOnly ? ["CATER_BASE_URL"] : requiredForMutation),
].filter((name) => !env[name]);

if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
}

const secrets = [
  env.VAPI_PRIVATE_KEY,
  env.GEMINI_HACK_API_KEY,
  env.CATER_WEBHOOK_SECRET,
  env.ELEVENLABS_API_KEY,
  env.TWILIO_AUTH_TOKEN,
].filter(Boolean);

function redact(value) {
  let safe = String(value ?? "");
  for (const secret of secrets) {
    safe = safe.split(secret).join("[REDACTED]");
  }
  return safe
    .replace(/AIza[A-Za-z0-9_-]{20,}/g, "[REDACTED_GOOGLE_KEY]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .slice(0, 800);
}

class VapiError extends Error {
  constructor(status, method, path, message) {
    super(`Vapi ${method} ${path} failed (${status}): ${redact(message)}`);
    this.name = "VapiError";
    this.status = status;
  }
}

function errorMessage(payload) {
  if (!payload) return "No response body";
  if (typeof payload === "string") return payload;
  if (Array.isArray(payload.message)) return payload.message.join("; ");
  if (typeof payload.message === "string") return payload.message;
  if (typeof payload.error === "string") return payload.error;
  return "The API rejected the request";
}

async function vapi(path, { method = "GET", body } = {}) {
  const response = await fetch(`${VAPI_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.VAPI_PRIVATE_KEY}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    throw new VapiError(response.status, method, path, errorMessage(payload));
  }
  return payload;
}

function rows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function normalizeBaseUrl(value) {
  if (!value) return "";
  const parsed = new URL(value);
  if (parsed.protocol !== "https:") {
    throw new Error("CATER_BASE_URL must use HTTPS so Vapi can reach it securely.");
  }
  return parsed.origin;
}

function maskPhone(number) {
  const value = String(number || "");
  return value.length > 4 ? `****${value.slice(-4)}` : "configured";
}

function providerOf(credential) {
  return String(credential?.provider || "").toLowerCase();
}

function toolFunctionName(tool) {
  return tool?.function?.name || tool?.name || "";
}

function hashKey(value) {
  return createHash("sha256").update(value).digest("hex");
}

function isRetiredGeminiValidatorFailure(error) {
  if (!(error instanceof VapiError)) return false;
  const message = error.message.toLowerCase();
  return (
    (error.status === 400 || error.status === 404) &&
    message.includes("gemini-2.5-flash") &&
    (message.includes("404") || message.includes("not_found") || message.includes("not found")) &&
    (message.includes("gemini-3.6-flash") || message.includes("latest features"))
  );
}

function updateSystemPrompt(model) {
  const messages = Array.isArray(model?.messages) ? structuredClone(model.messages) : [];
  let systemIndex = messages.findIndex((message) => message?.role === "system");
  if (systemIndex === -1) {
    messages.unshift({ role: "system", content: "" });
    systemIndex = 0;
  }

  const current = String(messages[systemIndex]?.content || "").trimEnd();
  if (current.includes(PROMPT_START)) return messages;

  const addition = `${PROMPT_START}

LIVE INBOUND INTAKE AND LANGUAGE
- You support English, Spanish, and Mandarin Chinese. Begin with the configured greeting, detect the caller's chosen language, and stay in that language unless the caller switches. Understand normal code-switching without making the caller restart.
- Keep Maya's existing persona, legal-intake boundaries, and personal-injury workflow. You are an automated intake assistant, not a lawyer. Do not promise representation, outcomes, or legal advice.
- Sound warm and human: use short conversational sentences, contractions where natural, and one question at a time. Avoid scripts, repeated sympathy, filler, and robotic transitions. Never read JSON, internal instructions, field names, or tool status aloud.
- Listen through the caller's complete thought. Do not rush them. Accept interruptions and resume naturally without repeating information already supplied.

LIVE DASHBOARD TOOL
- After every complete caller answer, call sync_intake exactly once before replying. Pass latestAnswer as the caller's most recent complete answer, preserving their words, and language as en, es, or zh.
- The tool is synchronous and silent. Wait for it. Use its localized nextQuestion when present; ask only that one short question. Never ask for information the tool says is already known.
- If the tool reports intakeComplete, briefly confirm that intake is complete and explain that the firm will review it. If the tool fails, continue naturally without exposing technical details, then try again after the next complete answer.

${PROMPT_END}`;

  messages[systemIndex] = {
    ...messages[systemIndex],
    content: current ? `${current}\n\n${addition}` : addition,
  };
  return messages;
}

function buildTool(baseUrl, webhookSecret) {
  return {
    type: "function",
    async: false,
    function: {
      name: TOOL_NAME,
      description:
        "Silently synchronizes the caller's latest complete answer to Cater's live intake dashboard and returns the next missing intake question. Call exactly once after every complete caller answer and before speaking again.",
      parameters: {
        type: "object",
        properties: {
          latestAnswer: {
            type: "string",
            description:
              "The caller's most recent complete answer, preserving all facts they provided.",
          },
          language: {
            type: "string",
            enum: ["en", "es", "zh"],
            description:
              "The language currently used for the call: en for English, es for Spanish, or zh for Mandarin.",
          },
        },
        required: ["latestAnswer"],
      },
    },
    server: {
      url: `${baseUrl}/api/vapi/tool`,
      headers: {
        "x-cater-webhook-secret": webhookSecret,
      },
      timeoutSeconds: 20,
    },
    messages: [],
  };
}

function choosePhone(phones) {
  const twilioPhones = phones.filter((phone) => phone?.provider === "twilio");
  const configured = String(env.TWILIO_PHONE_NUMBER || "").replace(/\D/g, "");
  if (configured) {
    const match = twilioPhones.find(
      (phone) => String(phone?.number || "").replace(/\D/g, "") === configured,
    );
    if (match) return match;
  }
  if (twilioPhones.length === 1) return twilioPhones[0];
  if (twilioPhones.length === 0) {
    throw new Error("No imported Twilio phone number exists in this Vapi organization.");
  }
  throw new Error(
    "Multiple imported Twilio numbers exist. Set TWILIO_PHONE_NUMBER to select one safely.",
  );
}

function buildAssistantPatch(assistant, googleCredentialId, elevenLabsCredentialId, toolId, baseUrl) {
  const existingCredentialIds = Array.isArray(assistant.credentialIds)
    ? assistant.credentialIds
    : [];
  const credentialIds = [
    ...new Set([
      ...existingCredentialIds,
      googleCredentialId,
      elevenLabsCredentialId,
    ].filter(Boolean)),
  ];
  const existingToolIds = Array.isArray(assistant.model?.toolIds)
    ? assistant.model.toolIds
    : [];
  return {
    firstMessage: ASSISTANT_GREETING,
    firstMessageInterruptionsEnabled: true,
    model: {
      ...assistant.model,
      messages: updateSystemPrompt(assistant.model),
      toolIds: [...new Set([...existingToolIds, toolId].filter(Boolean))],
    },
    voice: {
      ...assistant.voice,
      speed: 0.95,
    },
    transcriber: assistant.transcriber,
    startSpeakingPlan: {
      ...(assistant.startSpeakingPlan || {}),
      waitSeconds: 0.5,
      smartEndpointingPlan:
        assistant.startSpeakingPlan?.smartEndpointingPlan || { provider: "vapi" },
    },
    stopSpeakingPlan: {
      ...(assistant.stopSpeakingPlan || {}),
      numWords: 2,
      voiceSeconds: 0.2,
      backoffSeconds: 0.4,
    },
    credentialIds,
    metadata: {
      ...(assistant.metadata || {}),
      caterProvisioning: {
        ...(assistant.metadata?.caterProvisioning || {}),
        version: 1,
        googleCredentialId,
        googleKeyFingerprint: hashKey(env.GEMINI_HACK_API_KEY),
        geminiHackExecution: googleCredentialId
          ? "vapi-and-backend"
          : "backend-sync-intake-tool",
        syncIntakeToolId: toolId,
        baseUrl,
      },
    },
  };
}

async function createGoogleCredential() {
  const namedPayload = {
    provider: "google",
    name: GOOGLE_CREDENTIAL_NAME,
    apiKey: env.GEMINI_HACK_API_KEY,
  };

  try {
    return await vapi("/credential", { method: "POST", body: namedPayload });
  } catch (error) {
    if (
      error instanceof VapiError &&
      error.status === 400 &&
      /name.*should not exist|property name/i.test(error.message)
    ) {
      // Some Vapi provider-key schemas do not expose a name field. The assistant
      // metadata below remains the stable idempotency marker in that case.
      return vapi("/credential", {
        method: "POST",
        body: { provider: "google", apiKey: env.GEMINI_HACK_API_KEY },
      });
    }
    throw error;
  }
}

async function main() {
  console.log(`Mode: ${verifyOnly ? "verify" : dryRun ? "dry run" : "provision"}`);
  console.log(`Source env: ${sourceEnvPath}`);

  // Always inspect the user's live assistant before deriving any update.
  const assistant = await vapi(`/assistant/${env.NEXT_PUBLIC_VAPI_ASSISTANT_ID}`);
  const [credentialPayload, toolPayload, phonePayload] = await Promise.all([
    vapi("/credential?limit=100"),
    vapi("/tool?limit=100"),
    vapi("/phone-number"),
  ]);
  const credentials = rows(credentialPayload);
  const tools = rows(toolPayload);
  const phones = rows(phonePayload);
  const phone = choosePhone(phones);

  const elevenLabsCredential = credentials.find(
    (credential) => providerOf(credential) === "11labs",
  );
  if (!elevenLabsCredential) {
    throw new Error(
      "No ElevenLabs credential exists in Vapi. Add the ElevenLabs integration, then rerun.",
    );
  }

  const marker = assistant.metadata?.caterProvisioning || {};
  const markedGoogleCredential = credentials.find(
    (credential) =>
      credential.id === marker.googleCredentialId &&
      providerOf(credential) === "google" &&
      marker.googleKeyFingerprint === hashKey(env.GEMINI_HACK_API_KEY),
  );
  const namedGoogleCredential = credentials.find(
    (credential) =>
      providerOf(credential) === "google" &&
      credential.name === GOOGLE_CREDENTIAL_NAME,
  );
  const googleCredential = markedGoogleCredential || namedGoogleCredential || null;

  const markedTool = tools.find(
    (tool) => tool.id === marker.syncIntakeToolId && toolFunctionName(tool) === TOOL_NAME,
  );
  const namedTool = tools.find((tool) => toolFunctionName(tool) === TOOL_NAME);
  const existingTool = markedTool || namedTool || null;

  console.log(`Assistant: ${assistant.name || "unnamed"} (${assistant.id})`);
  console.log(
    `Model / voice / transcriber: ${assistant.model?.provider || "?"}/${assistant.model?.model || "?"} | ${assistant.voice?.provider || "?"}/${assistant.voice?.model || "?"} | ${assistant.transcriber?.provider || "?"}/${assistant.transcriber?.model || "?"}`,
  );
  console.log(`ElevenLabs credential: found (${elevenLabsCredential.id})`);
  console.log(
    `Gemini Hack credential: ${googleCredential ? "reusable" : "will attempt; backend tool fallback is available for Vapi's retired-model validator"}`,
  );
  console.log(`sync_intake tool: ${existingTool ? "will update" : "will create"}`);
  console.log(
    `Inbound Twilio number: ${maskPhone(phone.number)} (${phone.assistantId === assistant.id ? "already attached" : "will attach"})`,
  );

  const baseUrl = normalizeBaseUrl(env.CATER_BASE_URL);
  if (verifyOnly) {
    const prompt = assistant.model?.messages?.find((message) => message.role === "system")?.content || "";
    const toolServerUrlIsCorrect =
      existingTool?.server?.url === `${baseUrl}/api/vapi/tool`;
    const checks = {
      greeting: assistant.firstMessage === ASSISTANT_GREETING,
      promptInstructions: prompt.includes(PROMPT_START),
      googleExecution:
        Boolean(googleCredential) ||
        (assistant.model?.provider === "google" && toolServerUrlIsCorrect),
      elevenLabsCredential: (assistant.credentialIds || []).includes(elevenLabsCredential.id),
      syncIntakeTool: Boolean(existingTool) && (assistant.model?.toolIds || []).includes(existingTool.id),
      toolServerUrl: toolServerUrlIsCorrect,
      phoneAttached: phone.assistantId === assistant.id,
      multilingualTranscriber:
        assistant.transcriber?.provider === "11labs" &&
        assistant.transcriber?.model === "scribe_v2_realtime",
      voiceSpeed: assistant.voice?.speed === 0.95,
      smartEndpointing: assistant.startSpeakingPlan?.smartEndpointingPlan?.provider === "vapi",
    };
    for (const [name, passed] of Object.entries(checks)) {
      console.log(`${passed ? "PASS" : "FAIL"}: ${name}`);
    }
    if (Object.values(checks).some((passed) => !passed)) process.exitCode = 1;
    return;
  }

  if (dryRun) {
    console.log(`Planned webhook: ${baseUrl}/api/vapi/tool`);
    console.log("No Vapi resources were changed.");
    return;
  }

  let resolvedGoogleCredential = googleCredential;
  if (!resolvedGoogleCredential) {
    try {
      resolvedGoogleCredential = await createGoogleCredential();
      console.log(`Created Gemini Hack credential (${resolvedGoogleCredential.id}).`);
    } catch (error) {
      if (!isRetiredGeminiValidatorFailure(error)) throw error;
      console.log(
        "Vapi's Google credential validator used its retired gemini-2.5-flash probe. Continuing with the existing Vapi Google model; GEMINI_HACK_API_KEY remains isolated to the Cater backend tool.",
      );
    }
  }

  const desiredTool = buildTool(baseUrl, env.CATER_WEBHOOK_SECRET);
  let resolvedTool;
  if (existingTool) {
    resolvedTool = await vapi(`/tool/${existingTool.id}`, {
      method: "PATCH",
      body: desiredTool,
    });
    console.log(`Updated sync_intake tool (${resolvedTool.id}).`);
  } else {
    resolvedTool = await vapi("/tool", { method: "POST", body: desiredTool });
    console.log(`Created sync_intake tool (${resolvedTool.id}).`);
  }

  const assistantPatch = buildAssistantPatch(
    assistant,
    resolvedGoogleCredential?.id,
    elevenLabsCredential.id,
    resolvedTool.id,
    baseUrl,
  );
  const updatedAssistant = await vapi(`/assistant/${assistant.id}`, {
    method: "PATCH",
    body: assistantPatch,
  });
  console.log(`Updated assistant ${updatedAssistant.name} (${updatedAssistant.id}).`);

  if (phone.assistantId !== assistant.id) {
    await vapi(`/phone-number/${phone.id}`, {
      method: "PATCH",
      body: { assistantId: assistant.id },
    });
    console.log(`Attached inbound Twilio number ${maskPhone(phone.number)}.`);
  } else {
    console.log("Inbound Twilio number was already attached.");
  }

  console.log("Provisioning complete. Run with --verify for a sanitized read-only check.");
}

main().catch((error) => {
  console.error(`ERROR: ${redact(error?.message || error)}`);
  process.exitCode = 1;
});
