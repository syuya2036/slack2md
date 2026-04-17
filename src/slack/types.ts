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
  blocks?: SlackBlock[];
  files?: SlackFile[];
  attachments?: SlackAttachment[];
  reactions?: SlackReaction[];
  metadata?: SlackMessageMetadata;
}

/** Reaction summary returned by conversations.history / reactions.get */
export interface SlackReaction {
  name: string;
  count: number;
  users: string[];
}

/** Message metadata (chat.postMessage `metadata` field) */
export interface SlackMessageMetadata {
  event_type: string;
  event_payload: Record<string, unknown>;
}

// --- Block Kit types ---

export type SlackBlock = RichTextBlock | UnknownBlock;

export interface RichTextBlock {
  type: "rich_text";
  block_id?: string;
  elements: RichTextElement[];
}

interface UnknownBlock {
  type: string;
  [key: string]: unknown;
}

export type RichTextElement =
  | RichTextSection
  | RichTextList
  | RichTextPreformatted
  | RichTextQuote;

export interface RichTextSection {
  type: "rich_text_section";
  elements: RichTextInlineElement[];
}

export interface RichTextList {
  type: "rich_text_list";
  style: "bullet" | "ordered";
  indent: number;
  border?: number;
  elements: RichTextSection[];
}

export interface RichTextPreformatted {
  type: "rich_text_preformatted";
  elements: RichTextInlineElement[];
  border?: number;
}

export interface RichTextQuote {
  type: "rich_text_quote";
  elements: RichTextInlineElement[];
  border?: number;
}

export type RichTextInlineElement =
  | RichTextText
  | RichTextLink
  | RichTextUserMention
  | RichTextChannelMention
  | RichTextUsergroupMention
  | RichTextEmoji
  | RichTextBroadcast;

export interface RichTextStyle {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
}

export interface RichTextText {
  type: "text";
  text: string;
  style?: RichTextStyle;
}

export interface RichTextLink {
  type: "link";
  url: string;
  text?: string;
  style?: RichTextStyle;
}

export interface RichTextUserMention {
  type: "user";
  user_id: string;
  style?: RichTextStyle;
}

export interface RichTextChannelMention {
  type: "channel";
  channel_id: string;
  style?: RichTextStyle;
}

export interface RichTextUsergroupMention {
  type: "usergroup";
  usergroup_id: string;
  style?: RichTextStyle;
}

export interface RichTextEmoji {
  type: "emoji";
  name: string;
  unicode?: string;
  style?: RichTextStyle;
}

export interface RichTextBroadcast {
  type: "broadcast";
  range: "here" | "channel" | "everyone";
  style?: RichTextStyle;
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

/** Options for getConversationsHistory */
export interface ConversationsHistoryOptions {
  include_all_metadata?: boolean;
}

/** Arguments for chat.postMessage */
export interface PostMessageArgs {
  channel: string;
  text: string;
  thread_ts?: string;
  blocks?: unknown[];
  metadata?: SlackMessageMetadata;
}

/** Result of chat.postMessage */
export interface PostMessageResult {
  ts: string;
  channel: string;
}

/** Arguments for chat.postEphemeral */
export interface PostEphemeralArgs {
  channel: string;
  user: string;
  text: string;
  thread_ts?: string;
  blocks?: unknown[];
}

/** Arguments for chat.update */
export interface UpdateMessageArgs {
  channel: string;
  ts: string;
  text: string;
  blocks?: unknown[];
  metadata?: SlackMessageMetadata;
}

/** Slack client interface for dependency injection */
export interface SlackClient {
  getConversationsHistory(
    channel: string,
    latest?: string,
    limit?: number,
    opts?: ConversationsHistoryOptions,
  ): Promise<SlackMessage[]>;
  getConversationsReplies(
    channel: string,
    threadTs: string,
  ): Promise<SlackMessage[]>;
  getUserInfo(userId: string): Promise<SlackUser>;
  postMessage(args: PostMessageArgs): Promise<PostMessageResult>;
  postEphemeral(args: PostEphemeralArgs): Promise<void>;
  updateMessage(args: UpdateMessageArgs): Promise<void>;
  openView(triggerId: string, view: unknown): Promise<{ id: string; hash: string }>;
  updateView(args: { view_id: string; hash?: string; view: unknown }): Promise<void>;
  addReaction(channel: string, ts: string, name: string): Promise<void>;
  authTest(): Promise<{ user_id: string; bot_id: string }>;
}

/** Slack Events API outer envelope */
export interface SlackEventEnvelope {
  type: "url_verification" | "event_callback" | string;
  challenge?: string;
  team_id?: string;
  api_app_id?: string;
  event?: SlackEvent;
  event_id?: string;
  event_time?: number;
}

/** Specific Slack events we subscribe to */
export type SlackEvent =
  | SlackMessageEvent
  | SlackReactionEvent
  | { type: string; [key: string]: unknown };

export interface SlackMessageEvent {
  type: "message";
  subtype?: string;
  channel: string;
  channel_type?: string;
  user?: string;
  bot_id?: string;
  app_id?: string;
  text: string;
  ts: string;
  thread_ts?: string;
  event_ts?: string;
}

export interface SlackReactionEvent {
  type: "reaction_added" | "reaction_removed";
  user: string;
  reaction: string;
  item_user?: string;
  item: {
    type: "message";
    channel: string;
    ts: string;
  };
  event_ts: string;
}

/** Block Kit block_actions interactivity payload (subset used here) */
export interface BlockActionsPayload {
  type: "block_actions";
  user: { id: string; name?: string; team_id?: string };
  trigger_id: string;
  team?: { id: string; domain?: string };
  channel?: { id: string; name?: string };
  container?: {
    type?: string;
    channel_id?: string;
    message_ts?: string;
    thread_ts?: string;
    is_ephemeral?: boolean;
  };
  response_url?: string;
  actions: Array<{
    action_id: string;
    block_id?: string;
    type: string;
    value?: string;
    selected_date?: string;
    selected_time?: string;
  }>;
  view?: unknown;
}

/** View submission payload (subset) */
export interface ViewSubmissionPayload {
  type: "view_submission";
  user: { id: string; name?: string };
  team?: { id: string; domain?: string };
  trigger_id: string;
  view: {
    id: string;
    hash: string;
    callback_id: string;
    private_metadata?: string;
    state: {
      values: Record<string, Record<string, {
        type: string;
        value?: string;
        selected_date?: string;
        selected_time?: string;
      }>>;
    };
  };
}
