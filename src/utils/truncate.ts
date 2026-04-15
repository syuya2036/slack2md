const DEFAULT_MAX_LENGTH = 3000;
const TRUNCATION_NOTICE = "\n\n... (truncated, full message too long for Slack)";

/**
 * Truncate text to a maximum length, breaking at the last newline.
 */
export function truncate(
  text: string,
  maxLength = DEFAULT_MAX_LENGTH,
): string {
  if (text.length <= maxLength) {
    return text;
  }

  const cutoff = maxLength - TRUNCATION_NOTICE.length;
  const lastNewline = text.lastIndexOf("\n", cutoff);
  const breakPoint = lastNewline > 0 ? lastNewline : cutoff;

  return text.slice(0, breakPoint) + TRUNCATION_NOTICE;
}
