import type { Env, SlackMessageEvent } from "../../slack/types";
import { createSlackClient } from "../../slack/client";
import { matchesMeetingKeyword } from "../../meeting/keywords";
import { buildTriggerEphemeralBlocks } from "../../meeting/views";

/**
 * Handle a `message` event. If the text contains a meeting keyword and the
 * sender is a real user (not a bot), post an ephemeral prompt offering to start
 * a scheduling flow.
 */
export async function handleMessageEvent(
  event: SlackMessageEvent,
  env: Env["Bindings"],
): Promise<void> {
  if (event.subtype) return;
  if (event.bot_id || event.app_id) return;
  if (!event.user) return;
  if (!event.text) return;
  if (!matchesMeetingKeyword(event.text)) return;

  const client = createSlackClient(env.SLACK_BOT_TOKEN);
  await client.postEphemeral({
    channel: event.channel,
    user: event.user,
    text: "日程調整を始めますか？",
    thread_ts: event.thread_ts,
    blocks: buildTriggerEphemeralBlocks({
      channel: event.channel,
      thread_ts: event.thread_ts ?? event.ts,
      trigger_ts: event.ts,
    }),
  });
}
