import type { SlackClient, SlackMessage, SlackUser } from "./types";

const SLACK_API = "https://slack.com/api";

/**
 * Create a thin Slack Web API client using the Fetch API.
 * Maintains a per-request user cache.
 */
export function createSlackClient(token: string): SlackClient {
  const userCache = new Map<string, SlackUser>();

  async function apiCall<T>(
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

  return {
    async getConversationsHistory(
      channel: string,
      latest?: string,
      limit = 1,
    ): Promise<SlackMessage[]> {
      const params: Record<string, string> = {
        channel,
        limit: String(limit),
        inclusive: "true",
      };
      if (latest) {
        params.latest = latest;
      }

      const data = await apiCall<{ messages: SlackMessage[] }>(
        "conversations.history",
        params,
      );
      return data.messages ?? [];
    },

    async getConversationsReplies(
      channel: string,
      threadTs: string,
    ): Promise<SlackMessage[]> {
      const data = await apiCall<{ messages: SlackMessage[] }>(
        "conversations.replies",
        { channel, ts: threadTs },
      );
      return data.messages ?? [];
    },

    async getUserInfo(userId: string): Promise<SlackUser> {
      const cached = userCache.get(userId);
      if (cached) return cached;

      const data = await apiCall<{ user: SlackUser }>("users.info", {
        user: userId,
      });
      userCache.set(userId, data.user);
      return data.user;
    },
  };
}
