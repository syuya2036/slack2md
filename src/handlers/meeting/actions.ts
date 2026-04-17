import type { BlockActionsPayload, Env } from "../../slack/types";
import { createSlackClient } from "../../slack/client";
import {
  DEFAULT_ROW_COUNT,
  MODAL_ADD_ROW_ACTION,
  TRIGGER_CANCEL_ACTION,
  TRIGGER_START_ACTION,
  buildMeetingModal,
  type ModalPrivateMetadata,
} from "../../meeting/views";
import { MAX_CANDIDATES } from "../../meeting/candidates";

interface TriggerContextValue {
  channel: string;
  thread_ts?: string;
  trigger_ts: string;
}

/**
 * Handle block_actions: the [日程調整を開始] / [キャンセル] buttons on the
 * ephemeral trigger, and the [候補を増やす] button inside the modal.
 *
 * The [開始] button must call views.open synchronously within 3 seconds, so
 * this function is awaited inline by the interactivity route (not waitUntil).
 */
export async function handleBlockActions(
  payload: BlockActionsPayload,
  env: Env["Bindings"],
): Promise<void> {
  const action = payload.actions?.[0];
  if (!action) return;

  const client = createSlackClient(env.SLACK_BOT_TOKEN);

  switch (action.action_id) {
    case TRIGGER_START_ACTION: {
      const ctx = safeParseTriggerContext(action.value);
      if (!ctx) return;
      const meta: ModalPrivateMetadata = {
        channel: ctx.channel,
        thread_ts: ctx.thread_ts,
        poster_user: payload.user.id,
        rowCount: DEFAULT_ROW_COUNT,
      };
      await client.openView(payload.trigger_id, buildMeetingModal(meta));
      if (payload.response_url) {
        await deleteOriginal(payload.response_url);
      }
      return;
    }

    case TRIGGER_CANCEL_ACTION: {
      if (payload.response_url) {
        await deleteOriginal(payload.response_url);
      }
      return;
    }

    case MODAL_ADD_ROW_ACTION: {
      const view = payload.view as
        | { id: string; hash?: string; private_metadata?: string }
        | undefined;
      if (!view) return;
      const meta = safeParseModalMetadata(view.private_metadata);
      if (!meta) return;
      const current = Number(action.value) || meta.rowCount || DEFAULT_ROW_COUNT;
      const next = Math.min(MAX_CANDIDATES, current + 5);
      await client.updateView({
        view_id: view.id,
        hash: view.hash,
        view: buildMeetingModal({ ...meta, rowCount: next }),
      });
      return;
    }

    default:
      return;
  }
}

function safeParseTriggerContext(value: string | undefined): TriggerContextValue | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as TriggerContextValue;
    if (!parsed.channel || !parsed.trigger_ts) return null;
    return parsed;
  } catch {
    return null;
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

async function deleteOriginal(responseUrl: string): Promise<void> {
  await fetch(responseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ delete_original: true }),
  });
}
