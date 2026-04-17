import { describe, expect, it } from "vitest";
import { buildMtgMetadata, decodeMtgMetadata, MTG_EVENT_TYPE } from "./metadata";
import { makeCandidate } from "./candidates";

describe("mtg metadata", () => {
  const sample = () => [
    makeCandidate(1, "2026-04-20", "14:00"),
    makeCandidate(2, "2026-04-21", "10:00"),
  ];

  it("round-trips a payload", () => {
    const metadata = buildMtgMetadata("Design Review", "U111", sample());
    expect(metadata.event_type).toBe(MTG_EVENT_TYPE);
    const decoded = decodeMtgMetadata(metadata);
    expect(decoded).not.toBeNull();
    expect(decoded!.title).toBe("Design Review");
    expect(decoded!.createdBy).toBe("U111");
    expect(decoded!.candidates).toHaveLength(2);
    expect(decoded!.allowedEmojis).toEqual(["one", "two"]);
  });

  it("rejects foreign event_type", () => {
    const decoded = decodeMtgMetadata({
      event_type: "something_else",
      event_payload: { v: 1, title: "", createdBy: "", candidates: [], allowedEmojis: [] },
    });
    expect(decoded).toBeNull();
  });

  it("rejects mismatched version", () => {
    const decoded = decodeMtgMetadata({
      event_type: MTG_EVENT_TYPE,
      event_payload: { v: 2, title: "", createdBy: "", candidates: [], allowedEmojis: [] },
    });
    expect(decoded).toBeNull();
  });

  it("rejects undefined metadata", () => {
    expect(decodeMtgMetadata(undefined)).toBeNull();
  });
});
