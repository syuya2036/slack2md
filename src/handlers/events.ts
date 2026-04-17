import type {
  Env,
  SlackEventEnvelope,
  SlackMessageEvent,
  SlackReactionEvent,
} from "../slack/types";
import { handleMessageEvent } from "./meeting/trigger";
import { handleReactionEvent } from "./meeting/reactions";

/**
 * Dispatch an Events API `event_callback`. Callers must ack the HTTP response
 * immediately; this function is intended to run inside waitUntil.
 */
export async function handleEventCallback(
  envelope: SlackEventEnvelope,
  env: Env["Bindings"],
): Promise<void> {
  const event = envelope.event;
  if (!event) return;

  switch (event.type) {
    case "message":
      await handleMessageEvent(event as SlackMessageEvent, env);
      return;

    case "reaction_added":
    case "reaction_removed":
      await handleReactionEvent(event as SlackReactionEvent, env);
      return;

    default:
      return;
  }
}
