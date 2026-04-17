import type { Env, ViewSubmissionPayload } from "../../slack/types";
import { createSlackClient } from "../../slack/client";
import {
  MAX_CANDIDATES,
  makeCandidate,
  toReactionName,
  type Candidate,
} from "../../meeting/candidates";
import { buildMtgMetadata } from "../../meeting/metadata";
import {
  buildPublicMessageBlocks,
  buildPublicMessageFallback,
  type ModalPrivateMetadata,
} from "../../meeting/views";
import { computeTally } from "../../meeting/tally";

export interface ViewSubmissionResponse {
  response_action: "errors";
  errors: Record<string, string>;
}

/**
 * Validate the submitted view. Returns a Slack-compatible errors payload or
 * null if validation succeeded.
 *
 * MUST be called synchronously within the 3s ack window; posting the public
 * message and seeding reactions happens in a follow-up async task.
 */
export function validateViewSubmission(
  payload: ViewSubmissionPayload,
): { candidates: Candidate[]; title: string; meta: ModalPrivateMetadata } | ViewSubmissionResponse {
  const meta = safeParseModalMetadata(payload.view.private_metadata);
  if (!meta) {
    return {
      response_action: "errors",
      errors: {
        title: "内部エラー：もう一度お試しください。",
      },
    };
  }

  const values = payload.view.state.values;
  const title = values.title?.val?.value?.trim() ?? "";
  if (!title) {
    return {
      response_action: "errors",
      errors: { title: "タイトルを入力してください。" },
    };
  }

  const candidates: Candidate[] = [];
  for (let i = 1; i <= MAX_CANDIDATES; i++) {
    const dateBlock = values[`slot_${i}_date`];
    const timeBlock = values[`slot_${i}_time`];
    const date = dateBlock?.val?.selected_date;
    const time = timeBlock?.val?.selected_time;
    if (!date) continue;
    candidates.push(makeCandidate(candidates.length + 1, date, time));
    if (candidates.length >= MAX_CANDIDATES) break;
  }

  if (candidates.length < 2) {
    return {
      response_action: "errors",
      errors: {
        slot_1_date: "候補は2件以上入力してください。",
      },
    };
  }

  return { candidates, title, meta };
}

/**
 * After successful validation, post the public scheduling message and seed
 * number-emoji reactions. Runs in waitUntil after the 3s ack.
 */
export async function finalizeViewSubmission(
  payload: ViewSubmissionPayload,
  validated: { candidates: Candidate[]; title: string; meta: ModalPrivateMetadata },
  env: Env["Bindings"],
): Promise<void> {
  const { candidates, title, meta } = validated;
  const client = createSlackClient(env.SLACK_BOT_TOKEN);
  const createdBy = payload.user.id;

  const tallies = computeTally(candidates, [], "");
  const blocks = buildPublicMessageBlocks({ title, createdBy, tallies });
  const metadata = buildMtgMetadata(title, createdBy, candidates);

  const result = await client.postMessage({
    channel: meta.channel,
    text: buildPublicMessageFallback(title),
    thread_ts: meta.thread_ts,
    blocks,
    metadata,
  });

  for (const c of candidates) {
    try {
      await client.addReaction(result.channel, result.ts, toReactionName(c.idx));
    } catch (err) {
      console.error(`Failed to seed reaction ${c.idx}:`, err);
    }
  }
}

function safeParseModalMetadata(value: string | undefined): ModalPrivateMetadata | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as ModalPrivateMetadata;
    if (!parsed.channel || !parsed.poster_user) return null;
    return parsed;
  } catch {
    return null;
  }
}
