# Cater Vapi provisioning

`provision-vapi.mjs` updates the existing live **Cater** assistant without replacing the user's Maya persona, personal-injury prompt, Gemini model, ElevenLabs voice, or ElevenLabs transcriber.

It performs these idempotent changes:

- fixes the stale Clearway greeting;
- appends a clearly delimited English, Spanish, and Mandarin call policy once;
- creates or reuses the Gemini Hack credential when Vapi's validator permits it, and retains the existing ElevenLabs credential;
- creates or updates a synchronous, silent `sync_intake` tool;
- synchronizes each complete caller answer to Cater's live dashboard through the tool endpoint;
- preserves ElevenLabs speed `0.95`, enables smart endpointing, adds a natural response pause, and permits caller interruption;
- attaches the imported Twilio number to the Cater assistant for inbound calls.

The script never prints API keys or webhook secrets. It reads Vapi, Gemini, ElevenLabs, assistant, and Twilio settings from the Clearway `.env` by default. Set `CLEARWAY_SOURCE_ENV` only when that file is elsewhere.

Vapi currently validates new Google credentials with a retired `gemini-2.5-flash` probe in some organizations. If, and only if, that validator returns the known 404 recommending `gemini-3.6-flash`, provisioning keeps the existing Vapi Google model and uses `GEMINI_HACK_API_KEY` through Cater's backend `sync_intake` tool. All other credential failures still stop provisioning.

## Deploy-time variables

Set these on the Cater Vercel project before provisioning:

```text
GEMINI_HACK_API_KEY
CATER_WEBHOOK_SECRET
```

Use the same `CATER_WEBHOOK_SECRET` value locally when running the provisioner. Vapi sends it to `/api/vapi/tool` in the `x-cater-webhook-secret` header.

## Commands

From the Cater repository root in PowerShell:

```powershell
$env:CATER_BASE_URL='https://YOUR-CATER-PROJECT.vercel.app'
$env:CATER_WEBHOOK_SECRET='THE-SAME-SECRET-SET-IN-VERCEL'

# Read live configuration and show the proposed changes without mutating Vapi.
node scripts/provision-vapi.mjs --dry-run

# Provision the Google credential, tool endpoint, assistant, and inbound number.
node scripts/provision-vapi.mjs

# Perform a sanitized read-only verification after provisioning.
node scripts/provision-vapi.mjs --verify
```

If the source `.env` is not at the default sibling Clearway path:

```powershell
$env:CLEARWAY_SOURCE_ENV='C:\absolute\path\to\.env'
```

The provisioner requires Node.js 20 or newer because it uses built-in `fetch`.
