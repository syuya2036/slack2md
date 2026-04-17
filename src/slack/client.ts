import type {
  ConversationsHistoryOptions,
  PostEphemeralArgs,
  PostMessageArgs,
  PostMessageResult,
  SlackClient,
  SlackMessage,
  SlackUser,
  UpdateMessageArgs,
} from "./types";

const SLACK_API = "https://slack.com/api";

/**
 * Create a thin Slack Web API client using the Fetch API.
 * Maintains a per-request user cache.
 */
export function createSlackClient(token: string): SlackClient {
  const userCache = new Map<string, SlackUser>();

  async function apiCallGet<T>(
    method: string,
    params: Record<string, string>,
  ): Promise<T> {
    const url = new URL(`${SLACK_API}/${method}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error(
        `Slack API HTTP error: ${method} returned ${res.status}`,
      );
    }

    const data = (await res.json()) as { ok: boolean; error?: string } & T;
    if (!data.ok) {
      throw new Error(`Slack API error: ${method} - ${data.error ?? "unknown"}`);
    }

    return data;
  }

  async function apiCallJson<T>(
    method: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const res = await fetch(`${SLACK_API}/${method}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(
        `Slack API HTTP error: ${method} returned ${res.status}`,
      );
    }

    const data = (await res.json()) as { ok: boolean; error?: string } & T;
    if (!data.ok) {
      throw new Error(`Slack API error: ${method} - ${data.error ?? "unknown"}`);
    }

    return data;
  }

  return {
    async getConversationsHistory(
      channel: string,
      latest?: string,
      limit = 1,
      opts?: ConversationsHistoryOptions,
    ): Promise<SlackMessage[]> {
      const params: Record<string, string> = {
        channel,
        limit: String(limit),
        inclusive: "true",
      };
      if (latest) {
        params.latest = latest;
      }
      if (opts?.include_all_metadata) {
        params.include_all_metadata = "true";
      }

      const data = await apiCallGet<{ messages: SlackMessage[] }>(
        "conversations.history",
        params,
      );
      return data.messages ?? [];
    },

    async getConversationsReplies(
      channel: string,
      threadTs: string,
    ): Promise<SlackMessage[]> {
      const data = await apiCallGet<{ messages: SlackMessage[] }>(
        "conversations.replies",
        { channel, ts: threadTs },
      );
      return data.messages ?? [];
    },

    async getUserInfo(userId: string): Promise<SlackUser> {
      const cached = userCache.get(userId);
      if (cached) return cached;

      const data = await apiCallGet<{ user: SlackUser }>("users.info", {
        user: userId,
      });
      userCache.set(userId, data.user);
      return data.user;
    },

    async postMessage(args: PostMessageArgs): Promise<PostMessageResult> {
      const data = await apiCallJson<PostMessageResult>("chat.postMessage", {
        channel: args.channel,
        text: args.text,
        ...(args.thread_ts ? { thread_ts: args.thread_ts } : {}),
        ...(args.blocks ? { blocks: args.blocks } : {}),
        ...(args.metadata ? { metadata: args.metadata } : {}),
      });
      return { ts: data.ts, channel: data.channel };
    },

    async postEphemeral(args: PostEphemeralArgs): Promise<void> {
      await apiCallJson<unknown>("chat.postEphemeral", {
        channel: args.channel,
        user: args.user,
        text: args.text,
        ...(args.thread_ts ? { thread_ts: args.thread_ts } : {}),
        ...(args.blocks ? { blocks: args.blocks } : {}),
      });
    },

    async updateMessage(args: UpdateMessageArgs): Promise<void> {
      await apiCallJson<unknown>("chat.update", {
        channel: args.channel,
        ts: args.ts,
        text: args.text,
        ...(args.blocks ? { blocks: args.blocks } : {}),
        ...(args.metadata ? { metadata: args.metadata } : {}),
      });
    },

    async openView(
      triggerId: string,
      view: unknown,
    ): Promise<{ id: string; hash: string }> {
      const data = await apiCallJson<{ view: { id: string; hash: string } }>(
        "views.open",
        { trigger_id: triggerId, view },
      );
      return { id: data.view.id, hash: data.view.hash };
    },

    async updateView(args: {
      view_id: string;
      hash?: string;
      view: unknown;
    }): Promise<void> {
      await apiCallJson<unknown>("views.update", {
        view_id: args.view_id,
        ...(args.hash ? { hash: args.hash } : {}),
        view: args.view,
      });
    },

    async addReaction(
      channel: string,
      ts: string,
      name: string,
    ): Promise<void> {
      try {
        await apiCallJson<unknown>("reactions.add", {
          channel,
          timestamp: ts,
          name,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("already_reacted")) return;
        throw err;
      }
    },

    async authTest(): Promise<{ user_id: string; bot_id: string }> {
      const data = await apiCallJson<{ user_id: string; bot_id: string }>(
        "auth.test",
        {},
      );
      return { user_id: data.user_id, bot_id: data.bot_id };
    },
  };
}
