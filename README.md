# Cater

> A multilingual AI voice agent that turns an injury intake call into a structured case record in real time.

**[Open the live application](https://cater-gamma.vercel.app)** · **[View the source code](https://github.com/Carldtitan/Cater)**

- **Status:** Deployed and working
- **Input:** Real inbound phone calls or typed rehearsal
- **Languages:** English, Spanish, and Mandarin
- **Demo data:** Fictional and temporary

## Hackathon evaluation summary

| Rubric area | What Cater demonstrates |
| --- | --- |
| Problem clarity | Injury intake calls create repeated questions, incomplete notes, and manual data entry. |
| User impact | Cater gives callers immediate support and gives staff a structured record before the call ends. |
| Innovation | Cater converts a live phone conversation into application state. It does more than record or summarize a call. |
| AI depth | Gemini extracts multiple facts, detects missing information, and creates the next focused question. |
| Voice experience | Vapi manages the call while ElevenLabs provides speech recognition and natural speech. |
| Technical execution | A Vapi tool connects the phone call to a live Next.js dashboard through authenticated server functions. |
| Sponsor integration | Vapi, ElevenLabs, Gemini, Twilio, and Vercel each perform a core product function. |
| Accessibility | The complete flow supports English, Spanish, Mandarin, voice input, and typed input. |
| Reliability | Cater deduplicates tool calls and reviews long answers for facts that the first AI pass missed. |
| Responsible AI | Cater records caller statements. It does not give legal advice, decide fault, or promise representation. |
| Completeness | The phone agent, live dashboard, extraction pipeline, multilingual samples, tests, and deployment work together. |

## The problem

People often call an injury law firm during a stressful time. They must explain an accident, describe injuries, and remember many details.

The firm must respond quickly. It must also ask the right questions and record each answer correctly.

A normal intake call can still leave the firm with more work:

- The caller repeats the same story to several people.
- Staff divide their attention between listening and taking notes.
- Important facts remain missing after the call.
- Someone must copy handwritten notes or transcripts into another system.
- Language differences can make an already difficult call harder.
- A transcript preserves words, but it does not create a usable case record.

A voice bot that only talks does not solve this problem. The firm still has to review the call and enter the information by hand.

## The solution

Cater answers an inbound Twilio call. Maya, the automated intake assistant, speaks English, Spanish, or Mandarin.

After each complete caller answer, Cater:

1. Sends the answer to an authenticated Vapi tool.
2. Uses Gemini to extract every supported fact.
3. Merges new facts without deleting confirmed facts.
4. Updates the dashboard during the call.
5. Identifies the remaining missing fields.
6. Gives Maya one short follow-up question.

The caller can provide many facts in one answer. Cater can update several fields from that single answer.

If the first AI pass misses an explicit fact, Cater performs a focused review of the remaining fields. The second pass still uses Gemini. Cater does not force a prepared result.

The result is a structured intake record, not only a voice conversation or transcript.

## Why Cater is different

### It connects conversation to action

The voice agent changes the case record while the caller speaks. Staff do not wait for an after-call summary.

### It asks only for missing information

Cater keeps confirmed facts and asks one focused question at a time. The caller does not need to restart the intake.

### It supports broad, natural answers

The caller does not need to speak in a fixed form order. One answer can include the accident, injuries, treatment, insurance, and police details.

### It uses real AI during the demo

The English, Spanish, and Mandarin rehearsal buttons send text through the production Gemini pipeline. No button maps to a fixed intake result.

### It uses sponsor technology as product infrastructure

Vapi, ElevenLabs, Gemini, Twilio, and Vercel are part of the working request path. They are not decorative integrations.

## User impact

### For callers

- Get an immediate response through a normal phone call.
- Speak naturally instead of completing a long form.
- Continue in English, Spanish, or Mandarin.
- Answer only questions that are still necessary.

### For intake staff

- Watch a structured record appear during the call.
- Review confirmed fields and missing fields in one place.
- Read a role-labeled transcript when more context is necessary.
- Reduce repeated questions and manual data entry.

### For law firms

- Create a consistent intake process for every incoming call.
- Support after-hours intake without replacing human review.
- Give staff a usable record instead of an unstructured recording.

Product success can be measured through field completion, response time, repeated-question count, and manual-entry time. This prototype does not claim measured improvements yet.

## Scalability

The voice layer, extraction schema, merge logic, and dashboard state are separate parts. A future version can replace the personal-injury schema without rebuilding the complete call system.

The same architecture can support other complex intake workflows. Each new workflow still requires domain review, prompt testing, and its own validated schema.

## Core technical achievements

- Real inbound Twilio calls connect to the Cater Vapi assistant.
- Vapi manages the conversation, interruption handling, and tool calls.
- ElevenLabs Scribe performs real-time speech recognition.
- ElevenLabs Flash v2.5 gives Maya a natural voice.
- Gemini 3.5 Flash manages the conversation and structured extraction.
- The `sync_intake` tool sends each caller answer to Cater.
- Zod validates every extracted intake update.
- Deterministic merge logic preserves previous facts and unions list values.
- Tool-call IDs prevent duplicate events from duplicating case facts.
- A focused AI review improves long-answer completeness.
- Vercel Runtime Cache shares live state with a 30-minute demo lifetime.
- The dashboard polls every 800 milliseconds for visible updates.
- Typed rehearsal and phone calls use the same extraction service.

## Ninety-second demo

1. Open the **[live dashboard](https://cater-gamma.vercel.app)**.
2. Select **New intake**.
3. Call the phone number shown on the dashboard.
4. Choose English, Spanish, or Mandarin.
5. Give Maya several fictional case facts in one natural answer.
6. Watch multiple dashboard fields update during the call.
7. Answer Maya's question about the next missing fact.
8. Show the completed structured record and transcript.

For a silent demo, select a language button under **Rehearse the intake**. Submit the sample and watch the same Gemini pipeline complete the record.

Use fictional information only.

## Information Cater captures

- Caller name
- Phone number
- Incident date
- Incident location
- Incident description
- Caller-reported fault
- Injuries and symptoms
- Medical treatment
- Police report status
- Other party's insurance information
- Existing attorney status
- Conversation transcript
- Detected language
- Missing-field status

## Architecture

```text
Twilio inbound call
  -> Vapi conversation orchestration
  -> ElevenLabs speech recognition
  -> Gemini 3.5 Flash conversation
  -> sync_intake Vapi tool
  -> Authenticated Vercel Function
  -> Gemini structured extraction
  -> Zod validation and deterministic merge
  -> Vercel Runtime Cache
  -> Live Next.js dashboard
```

## Sponsor technology

### Vapi

Vapi is the central call orchestrator. It manages the assistant, caller interruptions, multilingual instructions, and the `sync_intake` tool.

### ElevenLabs

ElevenLabs Scribe converts caller speech into text. ElevenLabs Flash v2.5 speaks Maya's responses at a natural pace.

### Gemini

Gemini 3.5 Flash powers Maya's conversation and extracts structured intake facts. Gemini also detects the active language and creates follow-up questions.

### Twilio

Twilio provides the real inbound phone number. The number is attached directly to the Cater Vapi assistant.

### Vercel

Vercel hosts the Next.js application and server functions. Vercel Runtime Cache shares temporary live state between the phone tool and dashboard.

## Reliability and responsible AI

Cater uses several controls to reduce common AI failures:

- Zod rejects output that does not match the intake schema.
- Null values do not silently delete confirmed facts.
- Duplicate Vapi tool calls return the saved result.
- Long answers receive a focused review for missing facts.
- The assistant asks for missing information instead of inventing it.
- Cater stores what the caller reports without making a legal conclusion.
- Cater does not estimate case value or decide whether a firm should accept a case.
- The current deployment accepts fictional demo data only.

## API routes

| Route | Purpose |
| --- | --- |
| `POST /api/vapi/tool` | Receives authenticated `sync_intake` tool calls from Vapi. |
| `GET /api/intake/live` | Returns the current live intake state. |
| `POST /api/intake/demo` | Sends typed rehearsal input through Gemini. |
| `POST /api/intake/reset` | Starts a clean intake session. |

## Technology stack

- Next.js 16 and React 19
- TypeScript
- Vapi
- Twilio
- ElevenLabs Scribe and Flash v2.5
- Gemini 3.5 Flash
- Zod
- Vercel Functions and Runtime Cache
- Tailwind CSS
- Vitest

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

The provisioning script updates the assistant, creates the `sync_intake` tool, and attaches the Twilio number.

Read [`scripts/README.md`](scripts/README.md) before use. The script provides a read-only check and an idempotent update. An idempotent update does not create duplicate resources when it runs again.

## Verify the project

```bash
npm run typecheck
npm test
npm run build
```

## Next steps

These features are planned, not implemented:

- Send a secure evidence-upload link during the call.
- Extract facts from police reports, insurance cards, and accident photos.
- Transfer urgent or qualified calls to a human intake specialist.
- Send the caller a summary for review and correction.
- Connect the completed intake to a legal case-management system.

## Current scope

Cater is a hackathon prototype for fictional intake data. It is not a production legal case-management system.

Cater does not provide legal advice or create an attorney-client relationship. Production use requires secure permanent storage, authentication, consent, audit logs, retention controls, and legal review.
