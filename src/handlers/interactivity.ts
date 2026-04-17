import type {
  BlockActionsPayload,
  Env,
  MessageShortcutPayload,
  ViewSubmissionPayload,
} from "../slack/types";
import { handleShortcut } from "./shortcut";
import { handleBlockActions } from "./meeting/actions";
import {
  finalizeViewSubmission,
  validateViewSubmission,
  type ViewSubmissionResponse,
} from "./meeting/submit";
import { MODAL_CALLBACK_ID } from "../meeting/views";

/** Outcome of interactivity routing: what to return synchronously + what to defer. */
export interface InteractivityResult {
  /** JSON body to return (for view_submission errors / clear). */
  body?: unknown;
  /** Async work for waitUntil. */
  deferred?: Promise<void>;
}

/**
 * Route a Slack interactivity payload. Some branches (views.open for button
 * clicks) must be awaited inline because of the 3s trigger_id deadline;
 * others (public posting after view_submission) are deferred.
 */
export async function routeInteractivity(
  parsed: { type?: string } & Record<string, unknown>,
  env: Env["Bindings"],
): Promise<InteractivityResult> {
  switch (parsed.type) {
    case "message_action": {
      return {
        deferred: handleShortcut(
          parsed as unknown as MessageShortcutPayload,
          env,
        ).catch((err) => {
          console.error("Shortcut error:", err);
        }),
      };
    }

    case "block_actions": {
      // Must complete within 3s to use trigger_id for views.open.
      await handleBlockActions(parsed as unknown as BlockActionsPayload, env);
      return {};
    }

    case "view_submission": {
      const payload = parsed as unknown as ViewSubmissionPayload;
      if (payload.view.callback_id !== MODAL_CALLBACK_ID) {
        return {};
      }
      const validated = validateViewSubmission(payload);
      if ("response_action" in validated) {
        const errorResponse: ViewSubmissionResponse = validated;
        return { body: errorResponse };
      }
      return {
        deferred: finalizeViewSubmission(payload, validated, env).catch(
          (err) => {
            console.error("view_submission finalize error:", err);
          },
        ),
      };
    }

    case "view_closed":
    default:
      return {};
  }
}
