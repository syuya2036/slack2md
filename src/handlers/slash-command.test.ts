import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseCommandText, handleSlashCommand } from "./slash-command";
import type { SlashCommandPayload, Env } from "../slack/types";

describe("parseCommandText", () => {
  const defaultChannel = "C_DEFAULT";

  it("returns latest mode for empty text", () => {
    expect(parseCommandText("", defaultChannel)).toEqual({
      mode: "latest",
      channelId: defaultChannel,
    });
  });

  it("returns latest mode for whitespace-only text", () => {
    expect(parseCommandText("   ", defaultChannel)).toEqual({
      mode: "latest",
      channelId: defaultChannel,
    });
  });

  it("parses a valid permalink in single mode", () => {
    const result = parseCommandText(
      "https://workspace.slack.com/archives/C123/p1700000000123456",
      defaultChannel,
    );
    expect(result.mode).toBe("single");
    expect(result.channelId).toBe("C123");
    expect(result.messageTs).toBe("1700000000.123456");
  });

  it("returns single mode with invalid permalink (no channelId)", () => {
    const result = parseCommandText("not-a-valid-url", defaultChannel);
    expect(result.mode).toBe("single");
    expect(result.channelId).toBeUndefined();
  });

  it("parses thread mode with valid permalink", () => {
    const result = parseCommandText(
      "thread https://workspace.slack.com/archives/C456/p1700000000654321",
      defaultChannel,
    );
    expect(result.mode).toBe("thread");
    expect(result.channelId).toBe("C456");
    expect(result.threadTs).toBe("1700000000.654321");
  });

  it("returns thread mode with invalid permalink", () => {
    const result = parseCommandText("thread bad-url", defaultChannel);
    expect(result.mode).toBe("thread");
    expect(result.channelId).toBeUndefined();
  });

  it("uses messageTs as threadTs when thread_ts param is absent", () => {
    const result = parseCommandText(
      "thread https://workspace.slack.com/archives/C789/p1700000000111111",
      defaultChannel,
    );
    expect(result.threadTs).toBe("1700000000.111111");
  });
});

describe("handleSlashCommand", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fetchSpy: any;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true })),
    );
  });

  const makePayload = (text = ""): SlashCommandPayload => ({
    command: "/tomd",
    text,
    response_url: "https://hooks.slack.com/commands/resp",
    trigger_id: "T123",
    user_id: "U_USER",
    user_name: "testuser",
    team_id: "T_TEAM",
    channel_id: "C_CHANNEL",
    channel_name: "general",
    api_app_id: "A_APP",
  });

  const env: Env["Bindings"] = {
    SLACK_BOT_TOKEN: "xoxb-test",
    SLACK_SIGNING_SECRET: "secret",
  };

  it("posts error for invalid permalink in single mode", async () => {
    await handleSlashCommand(makePayload("not-a-url"), env);

    // Should have posted to response_url
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://hooks.slack.com/commands/resp",
      expect.objectContaining({ method: "POST" }),
    );

    const body = JSON.parse(
      (fetchSpy.mock.calls[0][1] as any).body as string,
    );
    expect(body.response_type).toBe("ephemeral");
    expect(body.text).toContain("Invalid permalink");
  });

  it("posts error for invalid permalink in thread mode", async () => {
    await handleSlashCommand(makePayload("thread bad-url"), env);

    const body = JSON.parse(
      (fetchSpy.mock.calls[0][1] as any).body as string,
    );
    expect(body.text).toContain("Invalid permalink");
  });

  it("handles Slack API errors gracefully", async () => {
    // Mock conversations.history to fail
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error: "channel_not_found" })),
    );
    // Mock response_url post
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));

    await handleSlashCommand(makePayload(""), env);

    // Should have posted an error to response_url
    const lastCall = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1];
    const body = JSON.parse((lastCall[1] as any).body as string);
    expect(body.text).toContain("Failed to convert");
  });
});
