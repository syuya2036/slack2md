import type { SlackFile, SlackAttachment } from "../slack/types";

/**
 * Format Slack file attachments and legacy attachments into Markdown.
 */
export function formatAttachments(
  files?: SlackFile[],
  attachments?: SlackAttachment[],
): string {
  const lines: string[] = [];

  if (files) {
    for (const file of files) {
      lines.push(formatFile(file));
    }
  }

  if (attachments) {
    for (const att of attachments) {
      const formatted = formatLegacyAttachment(att);
      if (formatted) {
        lines.push(formatted);
      }
    }
  }

  return lines.join("\n\n");
}

function formatFile(file: SlackFile): string {
  const name = file.title || file.name || "file";
  const url = file.url_private;

  if (file.mimetype.startsWith("image/")) {
    return `![${name}](${url})`;
  }

  return `- attachment: [${name}](${url})`;
}

function formatLegacyAttachment(att: SlackAttachment): string | null {
  const parts: string[] = [];

  if (att.pretext) {
    parts.push(att.pretext);
  }

  if (att.image_url) {
    const alt = att.title || "image";
    parts.push(`![${alt}](${att.image_url})`);
  } else if (att.title && att.title_link) {
    parts.push(`[${att.title}](${att.title_link})`);
  } else if (att.title) {
    parts.push(`**${att.title}**`);
  }

  if (att.text) {
    const quoted = att.text
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
    parts.push(quoted);
  }

  return parts.length > 0 ? parts.join("\n\n") : null;
}
