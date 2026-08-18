# Cater

**Cater turns an injury intake phone call into a structured case record while the caller is still speaking.**

[Open the live demo](https://cater-gamma.vercel.app)

## The problem

People often contact an injury law firm during a stressful time. They must explain what happened, describe their injuries, and remember many details.

The law firm has a different problem. It must answer quickly, support different languages, ask the right questions, and record each fact correctly.

A normal intake call can create more work:

- The caller repeats information to several people.
- Staff take notes while trying to listen.
- Important facts remain missing after the call.
- Someone must copy the notes into another system.
- A transcript records the conversation, but it does not create a usable case record.

A voice bot that only talks does not solve this problem. The firm still has to review the call and enter the information by hand.

## What Cater does

Cater answers an inbound phone call through Twilio. Maya, the automated intake assistant, speaks English, Spanish, or Mandarin.

During the call, Cater:

1. Listens to each complete answer.
2. Extracts every supported fact with Gemini.
3. Updates the intake dashboard in real time.
4. Asks one short question about the next missing fact.
5. Avoids asking for information the caller already provided.

A caller can give many details in one answer. Cater can fill several fields from that answer. If Gemini misses an explicit fact in a long answer, Cater performs a focused review of the remaining fields.

The result is a structured intake record, not only a transcript.

## See it work

### Test the phone call

1. Open the [live dashboard](https://cater-gamma.vercel.app).
2. Select **New intake**.
3. Call the phone number shown on the dashboard.
4. Choose English, Spanish, or Mandarin.
5. Describe a fictional accident.
6. Watch the case record update during the call.

### Test without a phone call

Use one of the English, Spanish, or Mandarin rehearsal buttons. Each sample goes through the real Gemini extraction pipeline. The displayed results are not hard-coded.

Use fictional information only.

## Information Cater captures

- Caller name and phone number
- Incident date and location
- Description of the incident
- Caller-reported fault
- Injuries and symptoms
- Medical treatment
- Police report status
- Other party's insurance information
- Existing attorney status
- Full conversation transcript

Cater records what the caller says. It does not decide legal fault, estimate case value, or promise representation.

## How it works

```text
Inbound Twilio call
        ↓
Vapi call orchestration
        ↓
ElevenLabs speech recognition and voice
        ↓
Gemini conversation
        ↓
sync_intake Vapi tool
        ↓
Gemini structured extraction
        ↓
Vercel Runtime Cache
        ↓
Live Cater dashboard
```

The dashboard checks for updates every 800 milliseconds. Demo data expires after 30 minutes.

## Technology

- Next.js and React
- TypeScript
- Vapi
- Twilio
- ElevenLabs Scribe and Flash v2.5
- Gemini 3.5 Flash
- Vercel Functions and Runtime Cache
- Tailwind CSS

## Run Cater locally

1. Install the packages.

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local`.

3. Add the required environment values.

4. Start the development server.

   ```bash
   npm run dev
   ```

5. Open `http://localhost:3000`.

## Configure Vapi

The provisioning script updates the Cater assistant, adds the `sync_intake` tool, and attaches the Twilio number.

Read [`scripts/README.md`](scripts/README.md) before you run it. The script supports a read-only check and an idempotent update. An idempotent update can run more than once without creating duplicate resources.

## Verify the project

```bash
npm run typecheck
npm test
npm run build
```

## Current scope

Cater is a hackathon prototype for fictional intake data. It is not a production case-management system. It does not provide legal advice, create an attorney-client relationship, or submit information to a law firm.

Production use would require permanent secure storage, user authentication, consent controls, audit logs, retention rules, and a formal legal and privacy review.
