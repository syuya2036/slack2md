# slack2md

A Slack bot that converts Slack messages to standard Markdown and coordinates meeting schedules, running on Cloudflare Workers.

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
- **Meeting scheduler** — In-Slack replacement for 調整さん / cal.com
  - Auto-detects keywords (`mtg`, `MTG`, `meeting`, `ミーティング`, `打ち合わせ`, `打合せ`, `会議`, `面談`, …) in channel messages and offers an ephemeral prompt
  - `/mtg` slash command opens the scheduling modal directly
  - Block Kit modal with datepicker + timepicker for up to 10 candidates
  - Participants vote by clicking pre-seeded 1️⃣–🔟 reactions
  - Tally updates live (chat.update) on every `reaction_added` / `reaction_removed`
  - **No database**: state is stored entirely in the posted message's metadata

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

### Meeting Scheduler

**Auto trigger**: Post a message in a channel that contains a meeting keyword
(e.g. `mtg`, `MTG`, `meeting`, `ミーティング`, `打ち合わせ`, `打合せ`, `会議`,
`面談`). The bot replies with an ephemeral card offering **[日程調整を開始]**
and **[キャンセル]** buttons.

**Manual trigger**: Run `/mtg` in any channel to open the scheduling modal
directly.

Keyword list and boundary rules live in
[`src/meeting/keywords.ts`](./src/meeting/keywords.ts) — edit it and redeploy
to tune trigger behavior.

Flow:

1. Click **日程調整を開始** (or run `/mtg`) — a modal opens.
2. Enter a title and 2–10 candidate date / time slots. Click **候補を増やす** to
   reveal up to 10 rows.
3. Submit — the bot posts a message with numbered candidates and pre-adds
   1️⃣2️⃣3️⃣… reactions.
4. Participants click a number reaction to vote; the bot updates the post's
   vote counts in real time.

Candidate data is stored in the message's `metadata.event_payload`, so no
database is required.

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
| `chat:write` | Send messages and ephemerals |
| `chat:write.public` | Post scheduling messages in channels the bot has not joined |
| `channels:history` | Read messages in public channels |
| `groups:history` | Read messages in private channels |
| `im:history` | Read messages in DMs |
| `mpim:history` | Read messages in group DMs |
| `users:read` | Resolve user mentions to display names |
| `reactions:read` | Read reaction counts on scheduling messages |
| `reactions:write` | Seed 1️⃣–🔟 reactions on scheduling messages |

Install the app to your workspace and note the **Bot User OAuth Token** (`xoxb-...`).

#### Slash Commands

Create both slash commands pointing at the same endpoint:

| Command | Description | Usage hint |
|---------|-------------|------------|
| `/tomd` | Convert a Slack message to Markdown | `[thread] [permalink]` |
| `/mtg` | Start a meeting scheduling modal | _none_ |

Request URL: `https://<your-worker>.workers.dev/slack/commands`

#### Interactivity

1. Go to **Interactivity & Shortcuts** > toggle **On**
2. Request URL: `https://<your-worker>.workers.dev/slack/interactivity`
3. Under **Shortcuts**, click **Create New Shortcut** > **On messages**
4. Name: `Convert to Markdown`
5. Callback ID: `convert_to_markdown`

#### Event Subscriptions

1. Go to **Event Subscriptions** > toggle **On**
2. Request URL: `https://<your-worker>.workers.dev/slack/events`
3. Under **Subscribe to bot events**, add:
   - `message.channels`, `message.groups`, `message.im`, `message.mpim` (trigger detection)
   - `reaction_added`, `reaction_removed` (live tally updates)
4. Save changes and **reinstall the app** to the workspace so new scopes take
   effect.

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
    types.ts               # Slack payload, Block Kit, and API type definitions
    verify.ts              # Request signature verification (Web Crypto)
    permalink.ts           # Permalink URL parser
    client.ts              # Thin Slack Web API client (fetch-based)
  handlers/
    slash-command.ts       # /tomd command handler
    shortcut.ts            # Message shortcut handler
    events.ts              # Events API router (messages + reactions)
    interactivity.ts       # Interactivity router (message_action, block_actions, view_submission)
    meeting/
      trigger.ts           # Keyword-triggered ephemeral prompt
      actions.ts           # [設定] / [キャンセル] / [候補を増やす] button handlers
      submit.ts            # view_submission → public post + reaction seeding
      reactions.ts         # reaction_added/removed → chat.update tally
      slash.ts             # /mtg command handler
  meeting/
    keywords.ts            # Configurable trigger keyword list + matcher
    candidates.ts          # Candidate slot type + number emoji helpers
    metadata.ts            # mtg_schedule_v1 metadata encode/decode
    tally.ts               # Per-candidate vote counting (bot reaction excluded)
    views.ts               # Block Kit builders for ephemeral / modal / public message
  markdown/
    converter.ts           # Orchestrator: fetches data, resolves users, calls transforms
    render.ts              # Message body renderer (prefers blocks, falls back to text)
    rich-text.ts           # Block Kit rich_text renderer (lists, code blocks, quotes)
    transform.ts           # Slack mrkdwn → Markdown pure transforms (text fallback)
    attachments.ts         # File and image attachment formatting
    thread.ts              # Thread (parent + replies) formatting
  utils/
    response.ts            # Ephemeral response helpers
    truncate.ts            # Long message truncation
```

## Conversion Rules

### Inline Formatting

| Slack | Markdown |
|-------|----------|
| `*bold*` | `**bold**` |
| `_italic_` | `*italic*` |
| `~strikethrough~` | `~~strikethrough~~` |
| `` `inline code` `` | `` `inline code` `` |
| ` ```code block``` ` | ` ```code block``` ` |

### Mentions & Links

| Slack | Markdown |
|-------|----------|
| `<@U123>` | `@display_name` |
| `<#C123\|general>` | `#general` |
| `<!here>` | `@here` |
| `<https://...\|text>` | `[text](https://...)` |
| `>` quote | `>` quote |

### Lists (via Block Kit rich_text)

| Slack | Markdown |
|-------|----------|
| Bullet list | `- item` |
| Ordered list | `1. item` |
| Nested bullet (indent 1) | `  - item` |
| Nested ordered (indent 1) | `  1. item` |
| Deeper nesting (indent 2+) | `    - item` (2 spaces per level) |
| Mixed bullet/ordered nesting | Correctly mixed output |

When Block Kit `rich_text` blocks are available in the message, the bot uses them for accurate list structure. Otherwise, it falls back to the `text` field and converts `•` (U+2022) bullets to `-`.

### Attachments

| Slack | Markdown |
|-------|----------|
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
