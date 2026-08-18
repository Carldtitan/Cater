import { describe, expect, it } from "vitest";

import {
  calculateMissingFields,
  mergeIntake,
  mergeTranscript,
  nextQuestion,
} from "./logic";
import { emptyIntake, type ExtractionPatch } from "./schema";

function patch(overrides: Partial<ExtractionPatch> = {}): ExtractionPatch {
  return {
    language: "en",
    updates: {},
    arrayUpdates: {},
    nextQuestion: "",
    ...overrides,
  };
}

describe("intake logic", () => {
  it("preserves prior facts while applying explicit corrections", () => {
    const original = {
      ...emptyIntake(),
      fullName: "Jordan Lee",
      incidentLocation: "Oak Street",
      injuries: ["back pain"],
    };
    const next = mergeIntake(
      original,
      patch({
        updates: { incidentLocation: "Pine Street" },
        arrayUpdates: {
          injuries: { operation: "replace", values: ["neck pain"] },
        },
      }),
    );

    expect(next.fullName).toBe("Jordan Lee");
    expect(next.incidentLocation).toBe("Pine Street");
    expect(next.injuries).toEqual(["neck pain"]);
  });

  it("deduplicates appended lists and transcript entries", () => {
    const next = mergeIntake(
      { ...emptyIntake(), injuries: ["Back pain"] },
      patch({
        arrayUpdates: {
          injuries: {
            operation: "append",
            values: ["back pain", "Headache"],
          },
        },
      }),
    );
    expect(next.injuries).toEqual(["Back pain", "Headache"]);

    expect(
      mergeTranscript(
        [{ role: "user", text: "It happened Monday." }],
        [
          { role: "user", text: " it happened  monday. " },
          { role: "assistant", text: "Where did it happen?" },
        ],
      ),
    ).toHaveLength(2);
  });

  it("calculates missing fields and provides localized follow-ups", () => {
    const intake = { ...emptyIntake(), fullName: "Mei Chen" };
    const missing = calculateMissingFields(intake);
    expect(missing).not.toContain("fullName");
    expect(missing[0]).toBe("phone");
    expect(nextQuestion("zh", missing)).toContain("电话号码");
  });
});
