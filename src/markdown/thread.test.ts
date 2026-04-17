import { describe, it, expect } from "vitest";
import { formatThread, formatTimestamp } from "./thread";
import type { SlackMessage } from "../slack/types";

const resolver = (id: string) => {
  const names: Record<string, string> = { U1: "Alice", U2: "Bob" };
  return names[id] ?? id;
};

describe("formatTimestamp", () => {
  it("converts Slack ts to readable UTC datetime", () => {
    // 1358546515 = 2013-01-18 22:01 UTC
    expect(formatTimestamp("1358546515.000008")).toBe("2013-01-18 22:01 UTC");
  });

  it("returns the original string if not a valid number", () => {
    expect(formatTimestamp("invalid")).toBe("invalid");
  });
});

describe("formatThread", () => {
  it("returns empty string for empty messages array", () => {
    expect(formatThread([], resolver)).toBe("");
  });

  it("formats a single parent message without replies section", () => {
    const messages: SlackMessage[] = [
      { text: "Hello world", ts: "1700000000.000000", user: "U1" },
    ];
    const result = formatThread(messages, resolver);
    expect(result).toContain("**@Alice**");
    expect(result).toContain("Hello world");
    expect(result).not.toContain("## Replies");
  });

  it("formats parent + replies with separator", () => {
    const messages: SlackMessage[] = [
      { text: "Parent message", ts: "1700000000.000000", user: "U1" },
      { text: "Reply 1", ts: "1700000060.000000", user: "U2" },
      { text: "Reply 2", ts: "1700000120.000000", user: "U1" },
    ];
    const result = formatThread(messages, resolver);
    expect(result).toContain("**@Alice**");
    expect(result).toContain("Parent message");
    expect(result).toContain("## Replies");
    expect(result).toContain("**@Bob**");
    expect(result).toContain("Reply 1");
    expect(result).toContain("Reply 2");
  });

  it("includes attachments in thread messages", () => {
    const messages: SlackMessage[] = [
      {
        text: "Check this",
        ts: "1700000000.000000",
        user: "U1",
        files: [
          {
            id: "F1",
            name: "screenshot.png",
            mimetype: "image/png",
            url_private: "https://files.slack.com/screenshot.png",
          },
        ],
      },
    ];
    const result = formatThread(messages, resolver);
    expect(result).toContain("![screenshot.png]");
  });

  it("handles messages with unknown user", () => {
    const messages: SlackMessage[] = [
      { text: "Bot message", ts: "1700000000.000000" },
    ];
    const result = formatThread(messages, resolver);
    expect(result).toContain("**unknown**");
  });

  it("prefers blocks over text when available", () => {
    const messages: SlackMessage[] = [
      {
        text: "• Item 1\n• Item 2",
        ts: "1700000000.000000",
        user: "U1",
        blocks: [
          {
            type: "rich_text",
            elements: [
              {
                type: "rich_text_list",
                style: "bullet",
                indent: 0,
                elements: [
                  { type: "rich_text_section", elements: [{ type: "text", text: "Item 1" }] },
                  { type: "rich_text_section", elements: [{ type: "text", text: "Item 2" }] },
                ],
              },
            ],
          },
        ],
      },
    ];
    const result = formatThread(messages, resolver);
    expect(result).toContain("- Item 1\n- Item 2");
  });
});
