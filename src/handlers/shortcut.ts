import type { MessageShortcutPayload, Env } from "../slack/types";
import { createSlackClient } from "../slack/client";
import { convertMessage } from "../markdown/converter";
import { truncate } from "../utils/truncate";
import {
  postEphemeral,
  formatSuccessNoLink,
  formatError,
} from "../utils/response";

/**
 * Handle a "Convert to Markdown" message shortcut. Called from waitUntil after acking.
 */
export async function handleShortcut(
  payload: MessageShortcutPayload,
  env: Env["Bindings"],
): Promise<void> {
  try {
    const client = createSlackClient(env.SLACK_BOT_TOKEN);
    const channelId = payload.channel.id;
    const messageTs = payload.message.ts;

    // Re-fetch message via API to get full data (files, attachments)
    const markdown = await convertMessage(client, channelId, messageTs);
    const result = truncate(formatSuccessNoLink(markdown));
    await postEphemeral(payload.response_url, result);
  } catch (err) {
    console.error("Shortcut error:", err);
    try {
      await postEphemeral(
        payload.response_url,
        formatError("Failed to convert message. Please try again."),
      );
    } catch (postErr) {
      console.error("Failed to post error response:", postErr);
    }
  }
}
