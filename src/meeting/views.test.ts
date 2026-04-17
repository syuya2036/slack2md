import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROW_COUNT,
  MODAL_CALLBACK_ID,
  MODAL_ADD_ROW_ACTION,
  TRIGGER_CANCEL_ACTION,
  TRIGGER_START_ACTION,
  buildMeetingModal,
  buildPublicMessageBlocks,
  buildTriggerEphemeralBlocks,
} from "./views";
import { makeCandidate } from "./candidates";
import { computeTally } from "./tally";

describe("buildTriggerEphemeralBlocks", () => {
  it("includes start and cancel buttons with serialized context", () => {
    const blocks = buildTriggerEphemeralBlocks({
      channel: "C1",
      thread_ts: "100.000",
      trigger_ts: "100.000",
    }) as Array<{ type: string; elements?: Array<{ action_id: string; value?: string }> }>;
    const actions = blocks.find((b) => b.type === "actions");
    expect(actions).toBeDefined();
    const actionIds = actions!.elements!.map((e) => e.action_id);
    expect(actionIds).toContain(TRIGGER_START_ACTION);
    expect(actionIds).toContain(TRIGGER_CANCEL_ACTION);
    const startBtn = actions!.elements!.find(
      (e) => e.action_id === TRIGGER_START_ACTION,
    );
    const value = JSON.parse(startBtn!.value!);
    expect(value.channel).toBe("C1");
  });
});

describe("buildMeetingModal", () => {
  it("builds default 5 rows with correct callback_id", () => {
    const view = buildMeetingModal({
      channel: "C1",
      poster_user: "U1",
      rowCount: DEFAULT_ROW_COUNT,
    }) as { callback_id: string; blocks: Array<{ type: string; block_id?: string; action_id?: string }> };
    expect(view.callback_id).toBe(MODAL_CALLBACK_ID);
    const slotDates = view.blocks.filter(
      (b) => typeof b.block_id === "string" && /^slot_\d+_date$/.test(b.block_id),
    );
    expect(slotDates).toHaveLength(5);
  });

  it("expands to 10 rows and hides the add button at the cap", () => {
    const view = buildMeetingModal({
      channel: "C1",
      poster_user: "U1",
      rowCount: 10,
    }) as { blocks: Array<{ type: string; block_id?: string; elements?: Array<{ action_id: string }> }> };
    const slotDates = view.blocks.filter(
      (b) => typeof b.block_id === "string" && /^slot_\d+_date$/.test(b.block_id),
    );
    expect(slotDates).toHaveLength(10);
    const hasAdd = view.blocks.some(
      (b) =>
        b.type === "actions" &&
        (b.elements ?? []).some((e) => e.action_id === MODAL_ADD_ROW_ACTION),
    );
    expect(hasAdd).toBe(false);
  });
});

describe("buildPublicMessageBlocks", () => {
  it("renders candidate lines with number emoji and vote counts", () => {
    const candidates = [
      makeCandidate(1, "2026-04-20", "14:00"),
      makeCandidate(2, "2026-04-21", "10:00"),
    ];
    const tallies = computeTally(
      candidates,
      [{ name: "one", count: 2, users: ["UBOT", "U1"] }],
      "UBOT",
    );
    const blocks = buildPublicMessageBlocks({
      title: "Design Sync",
      createdBy: "U_ORG",
      tallies,
    }) as Array<{ type: string; text?: { text?: string } }>;
    const sections = blocks.filter((b) => b.type === "section");
    const concat = sections.map((s) => s.text?.text ?? "").join("\n");
    expect(concat).toContain("1\u20E3");
    expect(concat).toContain("2026-04-20 (月) 14:00");
    expect(concat).toContain("1票");
    expect(concat).toContain("<@U1>");
    expect(concat).toContain("0票");
  });
});
