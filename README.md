# Cater

Cater is a multilingual, voice-first personal-injury intake workspace. Callers speak with Maya in English, Spanish, or Mandarin while the firm's dashboard updates during the call.

## Live architecture

`Twilio inbound call -> Vapi -> ElevenLabs speech -> Gemini conversation -> sync_intake -> Gemini Hack extraction -> Vercel Runtime Cache -> live dashboard`

The dashboard also includes fictional typed rehearsal inputs. They use the same Gemini extraction and state pipeline as the phone tool; no intake results are hard-coded.

## Local development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and provide the listed values. See [`scripts/README.md`](scripts/README.md) for the idempotent Vapi provisioning and verification commands.

## Checks

```bash
npm run typecheck
npm test
npm run build
```

This hackathon deployment stores fictional demo state for 30 minutes. It is not a production legal case-management system.
