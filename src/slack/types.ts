/** Hono environment bindings */
export type Env = {
  Bindings: {
    SLACK_BOT_TOKEN: string;
    SLACK_SIGNING_SECRET: string;
  };
  Variables: {
    rawBody: string;
  };
};

/** Slash command POST body (form-encoded) */
export interface SlashCommandPayload {
  command: string;
  text: string;
  response_url: string;
  trigger_id: string;
  user_id: string;
  user_name: string;
  team_id: string;
  channel_id: string;
  channel_name: string;
  api_app_id: string;
}

/** Message shortcut (message_action) payload */
export interface MessageShortcutPayload {
  type: "message_action";
  callback_id: string;
  trigger_id: string;
  response_url: string;
  team: { id: string; domain: string };
  channel: { id: string; name: string };
  user: { id: string; name: string };
  message: SlackMessage;
}

/** A Slack message from the API */
export interface SlackMessage {
  type?: string;
  user?: string;
  bot_id?: string;
  text: string;
  ts: string;
  thread_ts?: string;
  reply_count?: number;
  files?: SlackFile[];
  attachments?: SlackAttachment[];
}

/** File attached to a message */
export interface SlackFile {
  id: string;
  name: string;
  title?: string;
  mimetype: string;
  url_private: string;
  permalink?: string;
}

/** Legacy attachment on a message */
export interface SlackAttachment {
  fallback?: string;
  text?: string;
  pretext?: string;
  title?: string;
  title_link?: string;
  image_url?: string;
  thumb_url?: string;
}

/** User profile from users.info */
export interface SlackUser {
  id: string;
  name: string;
  profile: {
    real_name?: string;
    display_name?: string;
  };
}

/** Generic Slack API response wrapper */
export interface SlackApiResponse<T> {
  ok: boolean;
  error?: string;
  response_metadata?: { next_cursor?: string };
  [key: string]: unknown;
}

/** Slack client interface for dependency injection */
export interface SlackClient {
  getConversationsHistory(
    channel: string,
    latest?: string,
    limit?: number,
  ): Promise<SlackMessage[]>;
  getConversationsReplies(
    channel: string,
    threadTs: string,
  ): Promise<SlackMessage[]>;
  getUserInfo(userId: string): Promise<SlackUser>;
}
