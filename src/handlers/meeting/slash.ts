import type { Env, SlashCommandPayload } from "../../slack/types";
import { createSlackClient } from "../../slack/client";
import {
  DEFAULT_ROW_COUNT,
  buildMeetingModal,
  type ModalPrivateMetadata,
} from "../../meeting/views";

/**
 * Handle the /mtg slash command. Opens the scheduling modal directly.
 *
 * MUST be awaited synchronously because `trigger_id` expires in 3 seconds.
 */
export async function handleMtgSlashCommand(
  payload: SlashCommandPayload,
  env: Env["Bindings"],
): Promise<void> {
  const client = createSlackClient(env.SLACK_BOT_TOKEN);
  const meta: ModalPrivateMetadata = {
    channel: payload.channel_id,
    poster_user: payload.user_id,
    rowCount: DEFAULT_ROW_COUNT,
  };
  await client.openView(payload.trigger_id, buildMeetingModal(meta));
}
