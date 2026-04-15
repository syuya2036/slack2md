import type { SlackMessage } from "../slack/types";
import { transformMrkdwn, type UserResolver } from "./transform";
import { formatAttachments } from "./attachments";

/**
 * Format a thread (parent + replies) into a Markdown document.
 * The first message in the array is the parent (Slack API convention).
 */
export function formatThread(
  messages: SlackMessage[],
  userResolver: UserResolver,
): string {
  if (messages.length === 0) {
    return "";
  }

  const sections: string[] = [];

  // Parent message
  const parent = messages[0];
  sections.push(formatMessageSection(parent, userResolver));

  // Replies
  if (messages.length > 1) {
    sections.push("## Replies");

    for (let i = 1; i < messages.length; i++) {
      sections.push(formatMessageSection(messages[i], userResolver));
    }
  }

  return sections.join("\n\n---\n\n");
}

function formatMessageSection(
  message: SlackMessage,
  userResolver: UserResolver,
): string {
  const parts: string[] = [];

  // Author and timestamp header
  const author = message.user ? `@${userResolver(message.user)}` : "unknown";
  const time = formatTimestamp(message.ts);
  parts.push(`**${author}** — ${time}`);

  // Message body
  if (message.text) {
    parts.push(transformMrkdwn(message.text, userResolver));
  }

  // Attachments
  const att = formatAttachments(message.files, message.attachments);
  if (att) {
    parts.push(att);
  }

  return parts.join("\n\n");
}

/**
 * Convert a Slack message timestamp (Unix epoch string) to a readable UTC datetime.
 * e.g. "1358546515.000008" → "2013-01-19 01:41 UTC"
 */
export function formatTimestamp(ts: string): string {
  const seconds = parseFloat(ts);
  if (isNaN(seconds)) {
    return ts;
  }
  const date = new Date(seconds * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes} UTC`;
}
