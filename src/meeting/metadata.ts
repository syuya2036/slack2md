import type { SlackMessageMetadata } from "../slack/types";
import type { Candidate } from "./candidates";
import { toReactionName } from "./candidates";

export const MTG_EVENT_TYPE = "mtg_schedule_v1";

export interface MtgSchedulePayload {
  v: 1;
  title: string;
  createdBy: string;
  candidates: Candidate[];
  allowedEmojis: string[];
}

export function buildMtgMetadata(
  title: string,
  createdBy: string,
  candidates: Candidate[],
): SlackMessageMetadata {
  const allowedEmojis = candidates.map((c) => toReactionName(c.idx));
  const payload: MtgSchedulePayload = {
    v: 1,
    title,
    createdBy,
    candidates,
    allowedEmojis,
  };
  return {
    event_type: MTG_EVENT_TYPE,
    event_payload: payload as unknown as Record<string, unknown>,
  };
}

/** Decode message metadata if it belongs to this feature; otherwise null. */
export function decodeMtgMetadata(
  metadata: SlackMessageMetadata | undefined,
): MtgSchedulePayload | null {
  if (!metadata) return null;
  if (metadata.event_type !== MTG_EVENT_TYPE) return null;
  const raw = metadata.event_payload as unknown as MtgSchedulePayload;
  if (!raw || raw.v !== 1) return null;
  if (!Array.isArray(raw.candidates)) return null;
  return raw;
}
