import type { SlackClient, SlackMessage } from "../slack/types";
import { extractUserIds, type UserResolver } from "./transform";
import { extractUserIdsFromBlocks } from "./rich-text";
import { renderMessageBody, getRichTextBlocks } from "./render";
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
  const userResolver = await buildUserResolverForMessage(client, message);
  return renderMessageBody(message, userResolver);
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

  const userIds = new Set<string>();

  for (const m of messages) {
    if (m.text) {
      for (const id of extractUserIds(m.text)) {
        userIds.add(id);
      }
    }
    const richBlocks = getRichTextBlocks(m);
    if (richBlocks.length > 0) {
      for (const id of extractUserIdsFromBlocks(richBlocks)) {
        userIds.add(id);
      }
    }
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
  const userResolver = await buildUserResolverForMessage(client, message);
  return renderMessageBody(message, userResolver);
}

/**
 * Build a user resolver for a single message (from both text and blocks).
 */
async function buildUserResolverForMessage(
  client: SlackClient,
  message: SlackMessage,
): Promise<UserResolver> {
  const userIds = new Set<string>();

  if (message.text) {
    for (const id of extractUserIds(message.text)) {
      userIds.add(id);
    }
  }

  const richBlocks = getRichTextBlocks(message);
  if (richBlocks.length > 0) {
    for (const id of extractUserIdsFromBlocks(richBlocks)) {
      userIds.add(id);
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

  for (const r of results) {
    if (r.status === "rejected") {
      console.warn("Failed to resolve user:", r.reason);
    }
  }

  return (id: string) => nameMap.get(id) ?? id;
}
