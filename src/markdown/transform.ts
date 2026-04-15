/**
 * Transform Slack mrkdwn text to standard Markdown.
 * All functions here are pure — no side effects or API calls.
 */

export type UserResolver = (userId: string) => string;

/**
 * Extract all user IDs referenced in a Slack mrkdwn text.
 */
export function extractUserIds(text: string): string[] {
  const matches = text.matchAll(/<@(U[A-Z0-9]+)>/g);
  const ids = new Set<string>();
  for (const m of matches) {
    ids.add(m[1]);
  }
  return [...ids];
}

/**
 * Main entry point: convert Slack mrkdwn to standard Markdown.
 */
export function transformMrkdwn(
  text: string,
  userResolver: UserResolver = (id) => id,
): string {
  // Protect code blocks and inline code from formatting transforms
  const { text: protected_, restore } = protectCode(text);

  let result = protected_;

  // 1. Decode HTML entities (Slack pre-encodes these)
  result = decodeEntities(result);

  // 2. Resolve mentions and links
  result = resolveUserMentions(result, userResolver);
  result = resolveChannelMentions(result);
  result = resolveSpecialMentions(result);
  result = resolveUsergroupMentions(result);
  result = resolveDateFormatting(result);
  result = resolveLinksWithLabel(result);
  result = resolveBareLinks(result);
  result = resolveMailtoLinks(result);

  // 3. Formatting transforms
  result = transformBold(result);
  result = transformItalic(result);
  result = transformStrikethrough(result);

  // 4. Block-level transforms
  result = transformBlockquotes(result);

  // Restore code blocks
  result = restore(result);

  return result;
}

// --- Code protection ---

interface ProtectedText {
  text: string;
  restore: (t: string) => string;
}

function protectCode(text: string): ProtectedText {
  const placeholders: Map<string, string> = new Map();
  let counter = 0;

  function makePlaceholder(content: string): string {
    const key = `\x00CODEBLOCK_${counter++}\x00`;
    placeholders.set(key, content);
    return key;
  }

  // Protect fenced code blocks first (``` ... ```)
  let result = text.replace(/```[\s\S]*?```/g, (match) =>
    makePlaceholder(match),
  );

  // Then protect inline code (` ... `)
  result = result.replace(/`[^`\n]+`/g, (match) => makePlaceholder(match));

  return {
    text: result,
    restore: (t: string) => {
      let restored = t;
      for (const [key, value] of placeholders) {
        restored = restored.replace(key, value);
      }
      return restored;
    },
  };
}

// --- Entity decoding ---

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

// --- Mention resolution ---

function resolveUserMentions(text: string, resolver: UserResolver): string {
  return text.replace(/<@(U[A-Z0-9]+)>/g, (_, userId) => {
    return `@${resolver(userId)}`;
  });
}

function resolveChannelMentions(text: string): string {
  return text.replace(/<#C[A-Z0-9]+\|([^>]+)>/g, (_, name) => `#${name}`);
}

function resolveSpecialMentions(text: string): string {
  return text
    .replace(/<!here>/g, "@here")
    .replace(/<!channel>/g, "@channel")
    .replace(/<!everyone>/g, "@everyone");
}

function resolveUsergroupMentions(text: string): string {
  return text.replace(
    /<!subteam\^[A-Z0-9]+\|([^>]+)>/g,
    (_, name) => `@${name}`,
  );
}

function resolveDateFormatting(text: string): string {
  return text.replace(/<!date\^[^>]+\|([^>]+)>/g, (_, fallback) => fallback);
}

// --- Link resolution ---

function resolveLinksWithLabel(text: string): string {
  return text.replace(
    /<(https?:\/\/[^|>]+)\|([^>]+)>/g,
    (_, url, label) => `[${label}](${url})`,
  );
}

function resolveBareLinks(text: string): string {
  return text.replace(/<(https?:\/\/[^>]+)>/g, (_, url) => url);
}

function resolveMailtoLinks(text: string): string {
  return text.replace(
    /<mailto:([^|>]+)\|([^>]+)>/g,
    (_, addr, label) => `[${label}](mailto:${addr})`,
  );
}

// --- Formatting transforms ---

function transformBold(text: string): string {
  // Slack: *bold* → Markdown: **bold**
  // Must not match list markers like "* item" (space after *)
  // Must require non-space content between markers
  return text.replace(
    /(^|[\s([{])\*(\S(?:[^*]*\S)?)\*(?=[\s)\]}.,:;!?]|$)/gm,
    (_, before, content) => `${before}**${content}**`,
  );
}

function transformItalic(text: string): string {
  // Slack: _italic_ → Markdown: *italic*
  // Must not match underscores in URLs or snake_case identifiers
  // Only match when _ is at word boundary (preceded by whitespace/start)
  return text.replace(
    /(^|[\s([{])_(\S(?:[^_]*\S)?)_(?=[\s)\]}.,:;!?]|$)/gm,
    (_, before, content) => `${before}*${content}*`,
  );
}

function transformStrikethrough(text: string): string {
  // Slack: ~strike~ → Markdown: ~~strike~~
  return text.replace(
    /(^|[\s([{])~(\S(?:[^~]*\S)?)~(?=[\s)\]}.,:;!?]|$)/gm,
    (_, before, content) => `${before}~~${content}~~`,
  );
}

// --- Block-level transforms ---

function transformBlockquotes(text: string): string {
  // Ensure blockquote lines have proper spacing: "> text"
  return text.replace(/^>(.*)/gm, (_, content) => {
    if (content.startsWith(" ")) {
      return `>${content}`;
    }
    return `> ${content}`;
  });
}
