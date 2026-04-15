import type { SlackClient } from "../slack/types";
import { transformMrkdwn, extractUserIds, type UserResolver } from "./transform";
import { formatAttachments } from "./attachments";
import { formatThread } from "./thread";

/**
 * Convert a single Slack message to Markdown.
 */
export async function convertMessage(
  client: SlackClient,
  channelId: string,
  messageTs: string,
): Promise<string> {
  const messages = await client.getConversationsHistory(
    channelId,
    messageTs,
    1,
  );

  if (messages.length === 0) {
    throw new Error("Message not found");
  }

  const message = messages[0];
  const userResolver = await buildUserResolver(client, [message.text]);

  const parts: string[] = [];

  if (message.text) {
    parts.push(transformMrkdwn(message.text, userResolver));
  }

  const att = formatAttachments(message.files, message.attachments);
  if (att) {
    parts.push(att);
  }

  return parts.join("\n\n");
}

/**
 * Convert an entire thread (parent + replies) to Markdown.
 */
export async function convertThread(
  client: SlackClient,
  channelId: string,
  threadTs: string,
): Promise<string> {
  const messages = await client.getConversationsReplies(channelId, threadTs);

  if (messages.length === 0) {
    throw new Error("Thread not found");
  }

  const allTexts = messages.map((m) => m.text).filter(Boolean);
  const userIds = new Set<string>();

  // Collect user IDs from message texts
  for (const text of allTexts) {
    for (const id of extractUserIds(text)) {
      userIds.add(id);
    }
  }

  // Also collect user IDs from message authors
  for (const m of messages) {
    if (m.user) {
      userIds.add(m.user);
    }
  }

  const userResolver = await resolveUsers(client, [...userIds]);
  return formatThread(messages, userResolver);
}

/**
 * Fetch the latest message from a channel.
 */
export async function convertLatestMessage(
  client: SlackClient,
  channelId: string,
): Promise<string> {
  const messages = await client.getConversationsHistory(channelId);

  if (messages.length === 0) {
    throw new Error("No messages found in this channel");
  }

  const message = messages[0];
  const userResolver = await buildUserResolver(client, [message.text]);

  const parts: string[] = [];

  if (message.text) {
    parts.push(transformMrkdwn(message.text, userResolver));
  }

  const att = formatAttachments(message.files, message.attachments);
  if (att) {
    parts.push(att);
  }

  return parts.join("\n\n");
}

/**
 * Build a user resolver from texts that may contain user mentions.
 */
async function buildUserResolver(
  client: SlackClient,
  texts: string[],
): Promise<UserResolver> {
  const userIds = new Set<string>();
  for (const text of texts) {
    if (text) {
      for (const id of extractUserIds(text)) {
        userIds.add(id);
      }
    }
  }
  return resolveUsers(client, [...userIds]);
}

/**
 * Resolve a list of user IDs to a UserResolver function.
 */
async function resolveUsers(
  client: SlackClient,
  userIds: string[],
): Promise<UserResolver> {
  const nameMap = new Map<string, string>();

  const results = await Promise.allSettled(
    userIds.map(async (id) => {
      const user = await client.getUserInfo(id);
      const displayName =
        user.profile.display_name || user.profile.real_name || user.name;
      nameMap.set(id, displayName);
    }),
  );

  // Log failures but don't block the conversion
  for (const r of results) {
    if (r.status === "rejected") {
      console.warn("Failed to resolve user:", r.reason);
    }
  }

  return (id: string) => nameMap.get(id) ?? id;
}
