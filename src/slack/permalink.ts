export interface ParsedPermalink {
  channelId: string;
  messageTs: string;
  threadTs?: string;
}

/**
 * Parse a Slack permalink URL to extract channel ID and message timestamp.
 *
 * Formats:
 *   https://<workspace>.slack.com/archives/<channelId>/p<tsWithoutDot>
 *   https://<workspace>.slack.com/archives/<channelId>/p<tsWithoutDot>?thread_ts=<ts>&cid=<channelId>
 */
export function parsePermalink(url: string): ParsedPermalink | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (!parsed.hostname.endsWith(".slack.com")) {
    return null;
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  // Expected: ["archives", channelId, "p<timestamp>"]
  if (segments.length < 3 || segments[0] !== "archives") {
    return null;
  }

  const channelId = segments[1];
  const tsSegment = segments[2];

  if (!tsSegment.startsWith("p") || tsSegment.length < 2) {
    return null;
  }

  const rawTs = tsSegment.slice(1); // remove 'p' prefix
  if (!/^\d+$/.test(rawTs)) {
    return null;
  }

  // Insert dot: last 6 digits are the fractional part
  // e.g. "1358546515000008" -> "1358546515.000008"
  if (rawTs.length <= 6) {
    return null;
  }
  const messageTs = rawTs.slice(0, -6) + "." + rawTs.slice(-6);

  const threadTs = parsed.searchParams.get("thread_ts") ?? undefined;

  return { channelId, messageTs, threadTs };
}
