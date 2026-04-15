import { describe, it, expect } from "vitest";
import { truncate } from "./truncate";

describe("truncate", () => {
  it("returns short text unchanged", () => {
    expect(truncate("hello", 100)).toBe("hello");
  });

  it("returns text at exactly the limit unchanged", () => {
    const text = "a".repeat(100);
    expect(truncate(text, 100)).toBe(text);
  });

  it("truncates long text with notice", () => {
    const text = "a".repeat(200);
    const result = truncate(text, 100);
    expect(result.length).toBeLessThanOrEqual(100);
    expect(result).toContain("... (truncated");
  });

  it("breaks at last newline before limit", () => {
    const text = "line1\nline2\nline3\n" + "a".repeat(200);
    const result = truncate(text, 50);
    expect(result).toContain("... (truncated");
    // Should break at a newline, not in the middle of content
    const beforeNotice = result.split("\n\n...")[0];
    expect(beforeNotice.endsWith("\n") || !beforeNotice.includes("aaa")).toBe(
      true,
    );
  });

  it("uses default max length of 3000", () => {
    const text = "a".repeat(2999);
    expect(truncate(text)).toBe(text);

    const longText = "a".repeat(3001);
    expect(truncate(longText)).toContain("... (truncated");
  });
});
