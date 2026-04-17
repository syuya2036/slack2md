import { describe, expect, it, vi, beforeEach } from "vitest";
import { handleEventCallback } from "./events";
import type { Env, SlackEventEnvelope } from "../slack/types";
import { _resetBotUserIdCache, _setBotUserIdCache } from "./meeting/reactions";

describe("handleEventCallback", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fetchSpy: any;
  const env: Env["Bindings"] = {
    SLACK_BOT_TOKEN: "xoxb-test",
    SLACK_SIGNING_SECRET: "secret",
  };

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
    _resetBotUserIdCache();
  });

  it("posts an ephemeral on message events containing a keyword", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));

    const envelope: SlackEventEnvelope = {
      type: "event_callback",
      event: {
        type: "message",
        user: "U1",
        channel: "C1",
        text: "明日 mtg しよう",
        ts: "100.0",
      },
    };
    await handleEventCallback(envelope, env);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const call = fetchSpy.mock.calls[0];
    expect(call[0]).toContain("chat.postEphemeral");
    const body = JSON.parse(call[1].body as string);
    expect(body.channel).toBe("C1");
    expect(body.user).toBe("U1");
    expect(Array.isArray(body.blocks)).toBe(true);
  });

  it("ignores bot messages", async () => {
    const envelope: SlackEventEnvelope = {
      type: "event_callback",
      event: {
        type: "message",
        bot_id: "B1",
        channel: "C1",
        text: "mtg reminder",
        ts: "100.0",
      },
    };
    await handleEventCallback(envelope, env);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("ignores messages without keywords", async () => {
    const envelope: SlackEventEnvelope = {
      type: "event_callback",
      event: {
        type: "message",
        user: "U1",
        channel: "C1",
        text: "hello world",
        ts: "100.0",
      },
    };
    await handleEventCallback(envelope, env);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("ignores reaction events on unrelated messages", async () => {
    _setBotUserIdCache("UBOT");

    // conversations.history returns a message without our metadata
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          messages: [
            { text: "unrelated", ts: "200.0", user: "U9" },
          ],
        }),
      ),
    );

    const envelope: SlackEventEnvelope = {
      type: "event_callback",
      event: {
        type: "reaction_added",
        user: "U2",
        reaction: "one",
        item: { type: "message", channel: "C1", ts: "200.0" },
        event_ts: "200.1",
      },
    };
    await handleEventCallback(envelope, env);
    // One history call, no chat.update
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toContain("conversations.history");
  });

  it("updates mtg message on a real vote", async () => {
    _setBotUserIdCache("UBOT");

    // conversations.history returns a message with our metadata + reactions
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          messages: [
            {
              text: "Sync の日程調整",
              ts: "200.0",
              user: "UBOT",
              metadata: {
                event_type: "mtg_schedule_v1",
                event_payload: {
                  v: 1,
                  title: "Sync",
                  createdBy: "U_ORG",
                  candidates: [
                    {
                      idx: 1,
                      date: "2026-04-20",
                      time: "14:00",
                      label: "2026-04-20 (月) 14:00",
                    },
                    {
                      idx: 2,
                      date: "2026-04-21",
                      time: "10:00",
                      label: "2026-04-21 (火) 10:00",
                    },
                  ],
                  allowedEmojis: ["one", "two"],
                },
              },
              reactions: [
                { name: "one", count: 2, users: ["UBOT", "U2"] },
                { name: "two", count: 1, users: ["UBOT"] },
              ],
            },
          ],
        }),
      ),
    );
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));

    const envelope: SlackEventEnvelope = {
      type: "event_callback",
      event: {
        type: "reaction_added",
        user: "U2",
        reaction: "one",
        item: { type: "message", channel: "C1", ts: "200.0" },
        event_ts: "200.1",
      },
    };
    await handleEventCallback(envelope, env);

    const update = fetchSpy.mock.calls.find((c: unknown[]) =>
      String(c[0]).includes("chat.update"),
    );
    expect(update).toBeDefined();
    const body = JSON.parse((update[1] as { body: string }).body);
    expect(body.channel).toBe("C1");
    expect(body.ts).toBe("200.0");
    expect(body.metadata.event_type).toBe("mtg_schedule_v1");
    const sectionTexts = (body.blocks as Array<{ type: string; text?: { text?: string } }>)
      .filter((b) => b.type === "section")
      .map((b) => b.text?.text ?? "")
      .join("\n");
    expect(sectionTexts).toContain("1票");
    expect(sectionTexts).toContain("0票");
    expect(sectionTexts).toContain("<@U2>");
  });
});
