import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleShortcut } from "./shortcut";
import type { MessageShortcutPayload, Env } from "../slack/types";

describe("handleShortcut", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fetchSpy: any;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  const makePayload = (): MessageShortcutPayload => ({
    type: "message_action",
    callback_id: "convert_to_markdown",
    trigger_id: "T123",
    response_url: "https://hooks.slack.com/actions/resp",
    team: { id: "T_TEAM", domain: "workspace" },
    channel: { id: "C_CHANNEL", name: "general" },
    user: { id: "U_USER", name: "testuser" },
    message: {
      text: "Hello *world*",
      ts: "1700000000.000000",
      user: "U_AUTHOR",
    },
  });

  const env: Env["Bindings"] = {
    SLACK_BOT_TOKEN: "xoxb-test",
    SLACK_SIGNING_SECRET: "secret",
  };

  it("converts message and posts to response_url", async () => {
    // Mock conversations.history to return the message
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          messages: [{ text: "Hello *world*", ts: "1700000000.000000", user: "U_AUTHOR" }],
        }),
      ),
    );
    // Mock users.info for the mention
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          user: {
            id: "U_AUTHOR",
            name: "author",
            profile: { display_name: "Author" },
          },
        }),
      ),
    );
    // Mock response_url post
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));

    await handleShortcut(makePayload(), env);

    // Last call should be to response_url
    const lastCall = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1];
    expect(lastCall[0]).toBe("https://hooks.slack.com/actions/resp");
    const body = JSON.parse((lastCall[1] as any).body as string);
    expect(body.response_type).toBe("ephemeral");
    expect(body.text).toContain("**world**");
  });

  it("handles API errors gracefully", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error: "channel_not_found" })),
    );
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));

    await handleShortcut(makePayload(), env);

    const lastCall = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1];
    const body = JSON.parse((lastCall[1] as any).body as string);
    expect(body.text).toContain("Failed to convert");
  });
});
