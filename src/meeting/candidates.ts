/** A single candidate time slot stored in the bot's message metadata. */
export interface Candidate {
  /** 1-based index used to pair the entry with its number emoji. */
  idx: number;
  /** ISO date "YYYY-MM-DD". */
  date: string;
  /** Wall-clock time "HH:MM" (24h). Optional; if absent, the slot is date-only. */
  time?: string;
  /** Precomputed human-readable label used in the public message. */
  label: string;
}

export const MAX_CANDIDATES = 10;

/** Unicode number emoji 1️⃣–🔟 used as the reaction vote. */
const NUMBER_EMOJIS: Record<number, { name: string; unicode: string }> = {
  1: { name: "one", unicode: "1\u20E3" },
  2: { name: "two", unicode: "2\u20E3" },
  3: { name: "three", unicode: "3\u20E3" },
  4: { name: "four", unicode: "4\u20E3" },
  5: { name: "five", unicode: "5\u20E3" },
  6: { name: "six", unicode: "6\u20E3" },
  7: { name: "seven", unicode: "7\u20E3" },
  8: { name: "eight", unicode: "8\u20E3" },
  9: { name: "nine", unicode: "9\u20E3" },
  10: { name: "keycap_ten", unicode: "\uD83D\uDD1F" },
};

/** Slack reaction :name: for the n-th candidate (1-indexed). */
export function toReactionName(n: number): string {
  const entry = NUMBER_EMOJIS[n];
  if (!entry) {
    throw new RangeError(`No reaction emoji for candidate index ${n}`);
  }
  return entry.name;
}

/** Unicode character rendering of the number emoji. */
export function toNumberEmoji(n: number): string {
  const entry = NUMBER_EMOJIS[n];
  if (!entry) {
    throw new RangeError(`No number emoji for index ${n}`);
  }
  return entry.unicode;
}

const JA_WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/** Format "YYYY-MM-DD (曜) HH:MM" label. */
export function formatCandidateLabel(date: string, time?: string): string {
  const weekday = jaWeekday(date);
  const base = weekday ? `${date} (${weekday})` : date;
  return time ? `${base} ${time}` : base;
}

function jaWeekday(isoDate: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (Number.isNaN(dt.getTime())) return null;
  return JA_WEEKDAYS[dt.getUTCDay()];
}

/** Build a Candidate from user-supplied date/time inputs. */
export function makeCandidate(
  idx: number,
  date: string,
  time: string | undefined,
): Candidate {
  return {
    idx,
    date,
    time,
    label: formatCandidateLabel(date, time),
  };
}
