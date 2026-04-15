# slack2md

A Slack bot that converts Slack messages to standard Markdown, running on Cloudflare Workers.

[日本語版 README](./README.ja.md)

## Features

- **`/tomd` slash command** — Convert messages to Markdown
  - No arguments: converts the latest message in the channel
  - With permalink: converts the specified message
  - Thread mode: converts an entire thread
- **Message shortcut** — "Convert to Markdown" right-click action
- **Slack mrkdwn to Markdown** — Properly converts bold, italic, strikethrough, links, mentions, code blocks, blockquotes
- **Attachment handling** — Images as `![alt](url)`, files as attachment list items
- **Thread support** — Parent message + replies formatted as a structured document
- **Ephemeral responses** — Results are visible only to the user who invoked the command

## Usage

### Slash Command

```
/tomd                              # Convert the latest message in this channel
/tomd <permalink>                  # Convert a specific message
/tomd thread <permalink>           # Convert an entire thread
```

### Message Shortcut

1. Hover over a message
2. Click the "..." (more actions) menu
3. Select **Convert to Markdown**
4. The converted Markdown appears as an ephemeral message

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install -g wrangler`)
- A Cloudflare account
- A Slack workspace where you can install apps

### 1. Clone and Install

```bash
git clone https://github.com/syuya2036/slack2md.git
cd slack2md
npm install
```

### 2. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App** > **From scratch**
2. Name it (e.g., "slack2md") and select your workspace

#### OAuth & Permissions

Add the following **Bot Token Scopes**:

| Scope | Purpose |
|-------|---------|
| `commands` | Register slash commands |
| `chat:write` | Send ephemeral messages |
| `channels:history` | Read messages in public channels |
| `groups:history` | Read messages in private channels |
| `im:history` | Read messages in DMs |
| `mpim:history` | Read messages in group DMs |
| `users:read` | Resolve user mentions to display names |

Install the app to your workspace and note the **Bot User OAuth Token** (`xoxb-...`).

#### Slash Command

1. Go to **Slash Commands** > **Create New Command**
2. Command: `/tomd`
3. Request URL: `https://<your-worker>.workers.dev/slack/commands`
4. Description: "Convert a Slack message to Markdown"
5. Usage hint: `[thread] [permalink]`

#### Interactivity

1. Go to **Interactivity & Shortcuts** > toggle **On**
2. Request URL: `https://<your-worker>.workers.dev/slack/interactivity`
3. Under **Shortcuts**, click **Create New Shortcut** > **On messages**
4. Name: `Convert to Markdown`
5. Callback ID: `convert_to_markdown`

#### Signing Secret

Go to **Basic Information** and note the **Signing Secret**.

### 3. Configure Workers Secrets

```bash
wrangler secret put SLACK_BOT_TOKEN
# Paste your xoxb-... token

wrangler secret put SLACK_SIGNING_SECRET
# Paste your signing secret
```

### 4. Deploy

```bash
npm run deploy
```

Update the Slack app's Request URLs to your deployed Worker URL if needed.

## Local Development

```bash
# Create .dev.vars with your secrets
cat > .dev.vars << 'EOF'
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_SIGNING_SECRET=your-signing-secret
EOF

# Start local dev server
npm run dev
```

Use a tunneling tool (e.g., `cloudflared tunnel`, ngrok) to expose your local server to Slack.

## Testing

```bash
npm test              # Run tests once
npm run test:watch    # Run tests in watch mode
npm run typecheck     # TypeScript type checking
```

## Project Structure

```
src/
  index.ts                 # Hono app entry point, routes, middleware
  slack/
    types.ts               # Slack payload and API type definitions
    verify.ts              # Request signature verification (Web Crypto)
    permalink.ts           # Permalink URL parser
    client.ts              # Thin Slack Web API client (fetch-based)
  handlers/
    slash-command.ts       # /tomd command handler
    shortcut.ts            # Message shortcut handler
  markdown/
    converter.ts           # Orchestrator: fetches data, resolves users, calls transforms
    transform.ts           # Slack mrkdwn → Markdown pure transforms
    attachments.ts         # File and image attachment formatting
    thread.ts              # Thread (parent + replies) formatting
  utils/
    response.ts            # Ephemeral response helpers
    truncate.ts            # Long message truncation
```

## Conversion Rules

| Slack | Markdown |
|-------|----------|
| `*bold*` | `**bold**` |
| `_italic_` | `*italic*` |
| `~strikethrough~` | `~~strikethrough~~` |
| `` `inline code` `` | `` `inline code` `` |
| ` ```code block``` ` | ` ```code block``` ` |
| `<@U123>` | `@display_name` |
| `<#C123\|general>` | `#general` |
| `<!here>` | `@here` |
| `<https://...\|text>` | `[text](https://...)` |
| `>` quote | `>` quote |
| Image attachment | `![filename](url)` |
| File attachment | `- attachment: [filename](url)` |

## Thread Mode Output

```markdown
**@author** — 2024-01-15 14:30 UTC

Parent message content here.

---

## Replies

---

**@reply_author** — 2024-01-15 14:35 UTC

Reply message content here.
```

## Known Limitations

- **Private file URLs**: Slack's `url_private` URLs require authentication. The Markdown output contains these URLs, but they won't be accessible outside Slack without a valid token. This is noted in the output but not resolved automatically.
- **Response length**: Slack ephemeral messages have a character limit. Long messages or threads are truncated with a notice. Future versions may use file uploads for full output.
- **User resolution**: If the bot cannot access a user's profile (e.g., deleted users, external users), the raw user ID is shown instead of a display name.
- **Emoji**: Custom emoji shortcodes (`:custom_emoji:`) are passed through as-is. Standard Unicode emoji are preserved.
- **Code language detection**: Code blocks are passed through without automatic language detection. The original language hint (if provided by the user) is preserved.

## Security Considerations

- All requests are verified using Slack's signing secret (HMAC-SHA256)
- Bot token and signing secret are stored as Cloudflare Workers Secrets, never in code
- Message content is processed in-memory and not persisted
- Be cautious when using the bot in channels with sensitive information — the ephemeral response is only visible to the invoking user, but the content passes through Slack's servers and the Worker
- Private channel access depends on whether the bot has been invited to the channel

## Future Extensions

- `/tomd github` — Output optimized for GitHub-flavored Markdown
- `/tomd notion` — Output optimized for Notion paste
- Snippet/file upload for long content instead of truncation
- Code block language auto-detection
- Rich block (Block Kit) element conversion
- Custom emoji resolution

## License

MIT
