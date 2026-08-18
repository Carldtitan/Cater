import { describe, expect, it } from "vitest";

import {
  extractVapiTranscript,
  latestCallerAnswer,
  parseVapiToolCalls,
  vapiSessionId,
} from "./vapi";

describe("Vapi payload helpers", () => {
  const payload = {
    message: {
      call: { id: "call-123" },
      toolCallList: [
        {
          id: "tool-1",
          function: {
            name: "sync_intake",
            arguments: JSON.stringify({ latestAnswer: "Fue ayer." }),
          },
        },
      ],
      artifact: {
        messages: [
          { role: "assistant", message: "¿Cuándo ocurrió?" },
          { role: "user", message: "Fue ayer." },
        ],
      },
    },
  };

  it("accepts Vapi function calls and artifact messages", () => {
    const calls = parseVapiToolCalls(payload);
    const transcript = extractVapiTranscript(payload);
    expect(calls).toEqual([
      {
        id: "tool-1",
        name: "sync_intake",
        arguments: { latestAnswer: "Fue ayer." },
      },
    ]);
    expect(vapiSessionId(payload, calls[0].arguments)).toBe("call-123");
    expect(latestCallerAnswer(calls[0].arguments, transcript)).toBe("Fue ayer.");
    expect(transcript).toHaveLength(2);
  });
});
