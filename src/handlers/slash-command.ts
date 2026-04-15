import type { SlashCommandPayload, Env } from "../slack/types";
import { createSlackClient } from "../slack/client";
import { parsePermalink } from "../slack/permalink";
import {
  convertMessage,
  convertThread,
  convertLatestMessage,
} from "../markdown/converter";
import { truncate } from "../utils/truncate";
import {
  postEphemeral,
  formatSuccess,
  formatSuccessNoLink,
  formatError,
} from "../utils/response";

interface ParsedCommand {
  mode: "latest" | "single" | "thread";
  permalink?: string;
  channelId?: string;
  messageTs?: string;
  threadTs?: string;
}

/**
 * Parse the /tomd command text into a structured command.
 */
export function parseCommandText(
  text: string,
  defaultChannelId: string,
): ParsedCommand {
  const trimmed = text.trim();

  if (!trimmed) {
    return { mode: "latest", channelId: defaultChannelId };
  }

  if (trimmed.startsWith("thread ")) {
    const permalink = trimmed.slice("thread ".length).trim();
    const parsed = parsePermalink(permalink);
    if (!parsed) {
      return { mode: "thread", permalink };
    }
    return {
      mode: "thread",
      permalink,
      channelId: parsed.channelId,
      messageTs: parsed.messageTs,
      threadTs: parsed.threadTs ?? parsed.messageTs,
    };
  }

  const parsed = parsePermalink(trimmed);
  if (!parsed) {
    return { mode: "single", permalink: trimmed };
  }
  return {
    mode: "single",
    permalink: trimmed,
    channelId: parsed.channelId,
    messageTs: parsed.messageTs,
  };
}

/**
 * Handle a /tomd slash command. Called from waitUntil after acking.
 */
export async function handleSlashCommand(
  payload: SlashCommandPayload,
  env: Env["Bindings"],
): Promise<void> {
  try {
    const cmd = parseCommandText(payload.text, payload.channel_id);
    const client = createSlackClient(env.SLACK_BOT_TOKEN);
    let markdown: string;

    switch (cmd.mode) {
      case "latest": {
        markdown = await convertLatestMessage(client, cmd.channelId!);
        const result = truncate(formatSuccessNoLink(markdown));
        await postEphemeral(payload.response_url, result);
        return;
      }

      case "single": {
        if (!cmd.channelId || !cmd.messageTs) {
          await postEphemeral(
            payload.response_url,
            formatError(
              "Invalid permalink. Use a Slack message permalink like: `/tomd https://workspace.slack.com/archives/C.../p...`",
            ),
          );
          return;
        }
        markdown = await convertMessage(client, cmd.channelId, cmd.messageTs);
        const result = truncate(formatSuccess(cmd.permalink!, markdown));
        await postEphemeral(payload.response_url, result);
        return;
      }

      case "thread": {
        if (!cmd.channelId || !cmd.threadTs) {
          await postEphemeral(
            payload.response_url,
            formatError(
              "Invalid permalink. Use: `/tomd thread https://workspace.slack.com/archives/C.../p...`",
            ),
          );
          return;
        }
        markdown = await convertThread(client, cmd.channelId, cmd.threadTs);
        const result = truncate(formatSuccess(cmd.permalink!, markdown));
        await postEphemeral(payload.response_url, result);
        return;
      }
    }
  } catch (err) {
    console.error("Slash command error:", err);
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
