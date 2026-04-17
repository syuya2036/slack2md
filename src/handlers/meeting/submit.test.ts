import { describe, expect, it } from "vitest";
import { validateViewSubmission } from "./submit";
import type { ViewSubmissionPayload } from "../../slack/types";
import { MODAL_CALLBACK_ID } from "../../meeting/views";

function makePayload(overrides: {
  title?: string;
  slots?: Array<{ date?: string; time?: string }>;
  private_metadata?: string;
}): ViewSubmissionPayload {
  const values: ViewSubmissionPayload["view"]["state"]["values"] = {};
  if (overrides.title !== undefined) {
    values.title = { val: { type: "plain_text_input", value: overrides.title } };
  }
  (overrides.slots ?? []).forEach((slot, i) => {
    const n = i + 1;
    values[`slot_${n}_date`] = {
      val: { type: "datepicker", selected_date: slot.date },
    };
    values[`slot_${n}_time`] = {
      val: { type: "timepicker", selected_time: slot.time },
    };
  });

  return {
    type: "view_submission",
    user: { id: "U_ORG" },
    trigger_id: "T",
    view: {
      id: "V",
      hash: "H",
      callback_id: MODAL_CALLBACK_ID,
      private_metadata:
        overrides.private_metadata ??
        JSON.stringify({
          channel: "C1",
          poster_user: "U_ORG",
          rowCount: 5,
        }),
      state: { values },
    },
  };
}

describe("validateViewSubmission", () => {
  it("accepts ≥2 candidates with a title", () => {
    const result = validateViewSubmission(
      makePayload({
        title: "Design Sync",
        slots: [
          { date: "2026-04-20", time: "14:00" },
          { date: "2026-04-21" },
          {},
        ],
      }),
    );
    expect("response_action" in result).toBe(false);
    if ("response_action" in result) throw new Error("unreachable");
    expect(result.title).toBe("Design Sync");
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[1].date).toBe("2026-04-21");
    expect(result.candidates[1].time).toBeUndefined();
  });

  it("rejects empty title", () => {
    const result = validateViewSubmission(
      makePayload({ title: "  ", slots: [{ date: "2026-04-20" }, { date: "2026-04-21" }] }),
    );
    expect("response_action" in result).toBe(true);
    if (!("response_action" in result)) throw new Error("unreachable");
    expect(result.errors.title).toContain("タイトル");
  });

  it("rejects <2 candidates", () => {
    const result = validateViewSubmission(
      makePayload({ title: "Sync", slots: [{ date: "2026-04-20" }] }),
    );
    expect("response_action" in result).toBe(true);
    if (!("response_action" in result)) throw new Error("unreachable");
    expect(result.errors.slot_1_date).toBeDefined();
  });

  it("rejects missing private_metadata", () => {
    const result = validateViewSubmission(
      makePayload({
        title: "Sync",
        slots: [{ date: "2026-04-20" }, { date: "2026-04-21" }],
        private_metadata: "",
      }),
    );
    expect("response_action" in result).toBe(true);
  });
});
