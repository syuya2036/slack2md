import { describe, expect, it } from "vitest";
import { computeTally } from "./tally";
import { makeCandidate } from "./candidates";

describe("computeTally", () => {
  const BOT = "UBOT";
  const candidates = [
    makeCandidate(1, "2026-04-20", "14:00"),
    makeCandidate(2, "2026-04-21", "10:00"),
  ];

  it("returns zero counts when no reactions", () => {
    const result = computeTally(candidates, [], BOT);
    expect(result[0].count).toBe(0);
    expect(result[1].count).toBe(0);
  });

  it("subtracts the bot's own reaction", () => {
    const result = computeTally(
      candidates,
      [{ name: "one", count: 3, users: [BOT, "U1", "U2"] }],
      BOT,
    );
    expect(result[0].count).toBe(2);
    expect(result[0].voters).toEqual(["U1", "U2"]);
    expect(result[1].count).toBe(0);
  });

  it("does not double-subtract if bot is absent from users", () => {
    // reactions.add failed with already_reacted, so bot isn't actually in users
    const result = computeTally(
      candidates,
      [{ name: "two", count: 1, users: ["U1"] }],
      BOT,
    );
    expect(result[1].count).toBe(1);
    expect(result[1].voters).toEqual(["U1"]);
  });

  it("ignores unrelated reactions", () => {
    const result = computeTally(
      candidates,
      [{ name: "thumbsup", count: 5, users: ["U1", "U2", "U3", "U4", "U5"] }],
      BOT,
    );
    expect(result[0].count).toBe(0);
    expect(result[1].count).toBe(0);
  });
});
