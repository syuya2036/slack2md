import { describe, expect, it } from "vitest";
import {
  formatCandidateLabel,
  makeCandidate,
  toNumberEmoji,
  toReactionName,
} from "./candidates";

describe("toNumberEmoji", () => {
  it("returns unicode number emoji for 1–10", () => {
    expect(toNumberEmoji(1)).toBe("1\u20E3");
    expect(toNumberEmoji(5)).toBe("5\u20E3");
    expect(toNumberEmoji(9)).toBe("9\u20E3");
    expect(toNumberEmoji(10)).toBe("\uD83D\uDD1F");
  });

  it("throws for out-of-range indices", () => {
    expect(() => toNumberEmoji(0)).toThrow();
    expect(() => toNumberEmoji(11)).toThrow();
  });
});

describe("toReactionName", () => {
  it("maps 1..9 to named emoji and 10 to keycap_ten", () => {
    expect(toReactionName(1)).toBe("one");
    expect(toReactionName(9)).toBe("nine");
    expect(toReactionName(10)).toBe("keycap_ten");
  });
});

describe("formatCandidateLabel", () => {
  it("adds Japanese weekday", () => {
    // 2026-04-20 is a Monday.
    expect(formatCandidateLabel("2026-04-20")).toBe("2026-04-20 (月)");
    expect(formatCandidateLabel("2026-04-20", "14:00")).toBe(
      "2026-04-20 (月) 14:00",
    );
  });

  it("falls back gracefully for malformed dates", () => {
    expect(formatCandidateLabel("not-a-date")).toBe("not-a-date");
  });
});

describe("makeCandidate", () => {
  it("builds a Candidate with label", () => {
    const c = makeCandidate(1, "2026-04-20", "14:00");
    expect(c.idx).toBe(1);
    expect(c.date).toBe("2026-04-20");
    expect(c.time).toBe("14:00");
    expect(c.label).toBe("2026-04-20 (月) 14:00");
  });
});
