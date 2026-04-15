/**
 * Post an ephemeral message to a Slack response_url.
 */
export async function postEphemeral(
  responseUrl: string,
  text: string,
): Promise<void> {
  const res = await fetch(responseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      response_type: "ephemeral",
      text,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to post ephemeral: ${res.status}`);
  }
}

/**
 * Format a success response with source permalink and converted markdown.
 */
export function formatSuccess(permalink: string, markdown: string): string {
  return `:paperclip: *Source:* <${permalink}>\n\n---\n${markdown}\n---`;
}

/**
 * Format a success response without permalink (e.g. for latest message mode).
 */
export function formatSuccessNoLink(markdown: string): string {
  return `---\n${markdown}\n---`;
}

/**
 * Format a user-friendly error message.
 */
export function formatError(message: string): string {
  return `:warning: ${message}`;
}
