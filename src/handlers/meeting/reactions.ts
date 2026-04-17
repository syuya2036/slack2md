import type { Env, SlackReactionEvent } from "../../slack/types";
import { createSlackClient } from "../../slack/client";
import { decodeMtgMetadata } from "../../meeting/metadata";
import { toReactionName } from "../../meeting/candidates";
import { computeTally } from "../../meeting/tally";
import {
  buildPublicMessageBlocks,
  buildPublicMessageFallback,
} from "../../meeting/views";

// Cache bot user_id across requests within the same isolate.
let cachedBotUserId: string | null = null;

/**
 * Handle reaction_added / reaction_removed events. If the target message has
 * our metadata, rebuild its blocks with fresh tally counts and call chat.update.
 *
 * Idempotent: always recomputes from the latest reactions, so duplicate events
 * produce the same state.
 */
export async function handleReactionEvent(
  event: SlackReactionEvent,
  env: Env["Bindings"],
): Promise<void> {
  if (!event.item || event.item.type !== "message") return;

  const client = createSlackClient(env.SLACK_BOT_TOKEN);

  if (!cachedBotUserId) {
    try {
      const auth = await client.authTest();
      cachedBotUserId = auth.user_id;
    } catch (err) {
      console.error("auth.test failed:", err);
      return;
    }
  }

  // Ignore the bot's own seed reactions.
  if (event.user === cachedBotUserId) return;

  // Cheap allowed-emoji pre-check to skip unrelated reactions.
  const allowed = new Set(
    Array.from({ length: 10 }, (_, i) => toReactionName(i + 1)),
  );
  if (!allowed.has(event.reaction)) return;

  const messages = await client.getConversationsHistory(
    event.item.channel,
    event.item.ts,
    1,
    { include_all_metadata: true },
  );
  const message = messages[0];
  if (!message || message.ts !== event.item.ts) return;

  const payload = decodeMtgMetadata(message.metadata);
  if (!payload) return;

  const tallies = computeTally(
    payload.candidates,
    message.reactions,
    cachedBotUserId,
  );

  const blocks = buildPublicMessageBlocks({
    title: payload.title,
    createdBy: payload.createdBy,
    tallies,
  });

  await client.updateMessage({
    channel: event.item.channel,
    ts: event.item.ts,
    text: buildPublicMessageFallback(payload.title),
    blocks,
    // CRITICAL: re-pass metadata; chat.update drops it silently otherwise.
    metadata: message.metadata,
  });
}

/** Test hook: reset the cached bot user id. */
export function _resetBotUserIdCache(): void {
  cachedBotUserId = null;
}

/** Test hook: inject a bot user id. */
export function _setBotUserIdCache(userId: string): void {
  cachedBotUserId = userId;
}
