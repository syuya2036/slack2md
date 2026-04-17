import { Hono } from "hono";
import type { Env, SlackEventEnvelope, SlashCommandPayload } from "./slack/types";
import { verifySlackRequest } from "./slack/verify";
import { handleSlashCommand } from "./handlers/slash-command";
import { handleMtgSlashCommand } from "./handlers/meeting/slash";
import { handleEventCallback } from "./handlers/events";
import { routeInteractivity } from "./handlers/interactivity";

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

// Slash command endpoint: /tomd, /mtg
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

  if (payload.command === "/mtg") {
    // views.open must use trigger_id within 3s — await inline.
    try {
      await handleMtgSlashCommand(payload, c.env);
    } catch (err) {
      console.error("/mtg command error:", err);
      return c.json({
        response_type: "ephemeral",
        text: ":warning: 日程調整の起動に失敗しました。再度お試しください。",
      });
    }
    return c.body(null, 200);
  }

  // Default: /tomd — ack immediately, process asynchronously.
  c.executionCtx.waitUntil(
    handleSlashCommand(payload, c.env).catch((err) => {
      console.error("Unhandled slash command error:", err);
    }),
  );

  return c.body(null, 200);
});

// Interactivity endpoint (message shortcuts, block_actions, view_submission)
app.post("/slack/interactivity", async (c) => {
  const body = c.get("rawBody");
  const params = new URLSearchParams(body);
  const jsonPayload = params.get("payload");

  if (!jsonPayload) {
    return c.text("Missing payload", 400);
  }

  let parsed: { type?: string } & Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonPayload);
  } catch {
    return c.text("Invalid payload", 400);
  }

  let result;
  try {
    result = await routeInteractivity(parsed, c.env);
  } catch (err) {
    console.error("Interactivity routing error:", err);
    return c.body(null, 200);
  }

  if (result.deferred) {
    c.executionCtx.waitUntil(result.deferred);
  }

  if (result.body !== undefined) {
    return c.json(result.body);
  }
  return c.body(null, 200);
});

// Events API endpoint: url_verification + event_callback
app.post("/slack/events", async (c) => {
  const body = c.get("rawBody");
  let envelope: SlackEventEnvelope;
  try {
    envelope = JSON.parse(body);
  } catch {
    return c.text("Invalid payload", 400);
  }

  if (envelope.type === "url_verification") {
    return c.json({ challenge: envelope.challenge ?? "" });
  }

  if (envelope.type === "event_callback") {
    c.executionCtx.waitUntil(
      handleEventCallback(envelope, c.env).catch((err) => {
        console.error("Events handler error:", err);
      }),
    );
  }

  return c.body(null, 200);
});

export default app;
