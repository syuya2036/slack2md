/**
 * Render a single Slack message body to Markdown.
 * Prefers Block Kit rich_text blocks (which contain structured lists, code, etc.)
 * and falls back to the mrkdwn text field.
 */

import type { SlackMessage, RichTextBlock } from "../slack/types";
import { transformMrkdwn, type UserResolver } from "./transform";
import { renderRichTextBlocks } from "./rich-text";
import { formatAttachments } from "./attachments";

/**
 * Render a message to Markdown, preferring blocks over text.
 */
export function renderMessageBody(
  message: SlackMessage,
  userResolver: UserResolver,
): string {
  const parts: string[] = [];

  const richBlocks = getRichTextBlocks(message);
  if (richBlocks.length > 0) {
    parts.push(renderRichTextBlocks(richBlocks, userResolver));
  } else if (message.text) {
    parts.push(transformMrkdwn(message.text, userResolver));
  }

  const att = formatAttachments(message.files, message.attachments);
  if (att) {
    parts.push(att);
  }

  return parts.join("\n\n");
}

/**
 * Extract rich_text blocks from a message's blocks array.
 */
export function getRichTextBlocks(message: SlackMessage): RichTextBlock[] {
  if (!message.blocks) return [];
  return message.blocks.filter(
    (b): b is RichTextBlock => b.type === "rich_text",
  );
}
