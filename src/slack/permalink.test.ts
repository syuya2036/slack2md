import { describe, it, expect } from "vitest";
import { parsePermalink } from "./permalink";

describe("parsePermalink", () => {
  it("parses a standard permalink", () => {
    const result = parsePermalink(
      "https://myworkspace.slack.com/archives/C123ABC/p1358546515000008",
    );
    expect(result).toEqual({
      channelId: "C123ABC",
      messageTs: "1358546515.000008",
      threadTs: undefined,
    });
  });

  it("parses a threaded permalink with thread_ts", () => {
    const result = parsePermalink(
      "https://myworkspace.slack.com/archives/C123ABC/p1358546515000008?thread_ts=1358546510.000001&cid=C123ABC",
    );
    expect(result).toEqual({
      channelId: "C123ABC",
      messageTs: "1358546515.000008",
      threadTs: "1358546510.000001",
    });
  });

  it("returns null for an invalid URL", () => {
    expect(parsePermalink("not-a-url")).toBeNull();
  });

  it("returns null for a non-Slack URL", () => {
    expect(
      parsePermalink("https://example.com/archives/C123/p1234567890000000"),
    ).toBeNull();
  });

  it("returns null for a URL without /archives/", () => {
    expect(
      parsePermalink("https://myworkspace.slack.com/messages/C123/p1234567890000000"),
    ).toBeNull();
  });

  it("returns null for a URL with malformed timestamp", () => {
    expect(
      parsePermalink("https://myworkspace.slack.com/archives/C123/pabc"),
    ).toBeNull();
  });

  it("returns null when p-segment timestamp is too short", () => {
    expect(
      parsePermalink("https://myworkspace.slack.com/archives/C123/p123"),
    ).toBeNull();
  });

  it("handles various workspace subdomains", () => {
    const result = parsePermalink(
      "https://my-company-dev.slack.com/archives/C999XYZ/p1700000000123456",
    );
    expect(result).toEqual({
      channelId: "C999XYZ",
      messageTs: "1700000000.123456",
      threadTs: undefined,
    });
  });

  it("returns null for missing p-prefix in timestamp segment", () => {
    expect(
      parsePermalink("https://foo.slack.com/archives/C123/1234567890000000"),
    ).toBeNull();
  });

  it("returns null for a URL with only archives and channel", () => {
    expect(
      parsePermalink("https://foo.slack.com/archives/C123"),
    ).toBeNull();
  });
});
