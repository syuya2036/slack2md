/**
 * Keywords that trigger the meeting scheduling flow when found in a channel message.
 * Edit this list to tune trigger behavior.
 *
 * - ASCII keywords are matched with a letter-boundary lookaround so words like
 *   "geometric" do not match "mtg".
 * - Japanese keywords are matched as plain substrings ("ミーティングしよう" hits).
 * - Input is NFKC-normalized and lowercased, so 全角 / 大小文字の揺れは吸収される。
 */
export const ASCII_MEETING_KEYWORDS: readonly string[] = [
  "mtg",
  "meeting",
];

export const JA_MEETING_KEYWORDS: readonly string[] = [
  "ミーティング",
  "みーてぃんぐ",
  "打ち合わせ",
  "打合せ",
  "打ち合せ",
  "打合わせ",
  "うちあわせ",
  "会議",
  "面談",
];

export const MEETING_KEYWORDS: readonly string[] = [
  ...ASCII_MEETING_KEYWORDS,
  ...JA_MEETING_KEYWORDS,
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildRegex(
  ascii: readonly string[],
  ja: readonly string[],
): RegExp {
  const parts: string[] = [];
  if (ascii.length > 0) {
    const alt = ascii.map(escapeRegex).join("|");
    // Require a letter boundary before the keyword so "smtg"/"algomtg" don't
    // match, but accept trailing letters so "meetings" / "mtgs" do.
    parts.push(`(?<![a-z])(?:${alt})`);
  }
  if (ja.length > 0) {
    parts.push(ja.map(escapeRegex).join("|"));
  }
  return new RegExp(parts.join("|"), "iu");
}

const KEYWORD_REGEX = buildRegex(ASCII_MEETING_KEYWORDS, JA_MEETING_KEYWORDS);

/** Normalize text for case-insensitive, width-insensitive matching. */
export function normalizeForMatch(text: string): string {
  return text.normalize("NFKC").toLowerCase();
}

/** Does the given message text contain any meeting keyword? */
export function matchesMeetingKeyword(text: string): boolean {
  if (!text) return false;
  return KEYWORD_REGEX.test(normalizeForMatch(text));
}
