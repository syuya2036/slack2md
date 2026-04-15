import { Hono } from "hono";
import type { Env } from "./slack/types";
import type { SlashCommandPayload, MessageShortcutPayload } from "./slack/types";
import { verifySlackRequest } from "./slack/verify";
import { handleSlashCommand } from "./handlers/slash-command";
import { handleShortcut } from "./handlers/shortcut";

const app = new Hono<Env>();

// Health check
app.get("/", (c) => c.text("slack2md is running"));

// Slack signature verification middleware
app.use("/slack/*", async (c, next) => {
  const signature = c.req.header("x-slack-signature") ?? "";
  const timestamp = c.req.header("x-slack-request-timestamp") ?? "";
  const body = await c.req.text();

  const valid = await verifySlackRequest(
    c.env.SLACK_SIGNING_SECRET,
    signature,
    timestamp,
    body,
  );

  if (!valid) {
    return c.text("Invalid signature", 401);
  }

  // Store raw body for handlers (stream already consumed)
  c.set("rawBody", body);
  await next();
});

// Slash command endpoint: /tomd
app.post("/slack/commands", async (c) => {
  const body = c.get("rawBody");
  const params = new URLSearchParams(body);
  const payload: SlashCommandPayload = {
    command: params.get("command") ?? "",
    text: params.get("text") ?? "",
    response_url: params.get("response_url") ?? "",
    trigger_id: params.get("trigger_id") ?? "",
    user_id: params.get("user_id") ?? "",
    user_name: params.get("user_name") ?? "",
    team_id: params.get("team_id") ?? "",
    channel_id: params.get("channel_id") ?? "",
    channel_name: params.get("channel_name") ?? "",
    api_app_id: params.get("api_app_id") ?? "",
  };

  // Ack immediately, process asynchronously
  c.executionCtx.waitUntil(
    handleSlashCommand(payload, c.env).catch((err) => {
      console.error("Unhandled slash command error:", err);
    }),
  );

  return c.body(null, 200);
});

// Interactivity endpoint (message shortcuts, etc.)
app.post("/slack/interactivity", async (c) => {
  const body = c.get("rawBody");
  const params = new URLSearchParams(body);
  const jsonPayload = params.get("payload");

  if (!jsonPayload) {
    return c.text("Missing payload", 400);
  }

  let parsed: { type?: string };
  try {
    parsed = JSON.parse(jsonPayload);
  } catch {
    return c.text("Invalid payload", 400);
  }

  if (parsed.type === "message_action") {
    c.executionCtx.waitUntil(
      handleShortcut(parsed as MessageShortcutPayload, c.env).catch((err) => {
        console.error("Unhandled shortcut error:", err);
      }),
    );
  }

  return c.body(null, 200);
});

export default app;
