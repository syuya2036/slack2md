import type { SlackReaction } from "../slack/types";
import type { Candidate } from "./candidates";
import { toReactionName } from "./candidates";

export interface CandidateTally {
  candidate: Candidate;
  count: number;
  voters: string[];
}

/**
 * Compute per-candidate vote counts from a reactions array returned by
 * conversations.history. The bot's own seed reaction is subtracted when it
 * appears in the reaction's users list.
 */
export function computeTally(
  candidates: Candidate[],
  reactions: SlackReaction[] | undefined,
  botUserId: string,
): CandidateTally[] {
  const byName = new Map<string, SlackReaction>();
  for (const r of reactions ?? []) {
    byName.set(r.name, r);
  }

  return candidates.map((candidate) => {
    const name = toReactionName(candidate.idx);
    const reaction = byName.get(name);
    if (!reaction) {
      return { candidate, count: 0, voters: [] };
    }
    const voters = (reaction.users ?? []).filter((u) => u !== botUserId);
    return { candidate, count: voters.length, voters };
  });
}
