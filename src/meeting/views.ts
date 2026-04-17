import type { Candidate } from "./candidates";
import { MAX_CANDIDATES, toNumberEmoji } from "./candidates";
import type { CandidateTally } from "./tally";

export const TRIGGER_START_ACTION = "mtg_start";
export const TRIGGER_CANCEL_ACTION = "mtg_cancel";
export const MODAL_CALLBACK_ID = "mtg_submit";
export const MODAL_ADD_ROW_ACTION = "mtg_add_row";

export const DEFAULT_ROW_COUNT = 5;

export interface TriggerContext {
  channel: string;
  thread_ts?: string;
  trigger_ts: string;
}

/** Blocks for the ephemeral prompt shown after a keyword hit. */
export function buildTriggerEphemeralBlocks(ctx: TriggerContext): unknown[] {
  const value = JSON.stringify(ctx);
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "日程調整を始めますか？候補日時を設定して、メンバーに絵文字リアクションで投票してもらえます。",
      },
    },
    {
      type: "actions",
      block_id: "mtg_trigger",
      elements: [
        {
          type: "button",
          action_id: TRIGGER_START_ACTION,
          style: "primary",
          text: { type: "plain_text", text: "日程調整を開始" },
          value,
        },
        {
          type: "button",
          action_id: TRIGGER_CANCEL_ACTION,
          text: { type: "plain_text", text: "キャンセル" },
          value: "cancel",
        },
      ],
    },
  ];
}

export interface ModalPrivateMetadata {
  channel: string;
  thread_ts?: string;
  poster_user: string;
  rowCount: number;
}

/** Build the view_submission modal with `rowCount` candidate rows (<= MAX_CANDIDATES). */
export function buildMeetingModal(meta: ModalPrivateMetadata): unknown {
  const rowCount = Math.max(
    2,
    Math.min(MAX_CANDIDATES, meta.rowCount || DEFAULT_ROW_COUNT),
  );

  const blocks: unknown[] = [
    {
      type: "input",
      block_id: "title",
      label: { type: "plain_text", text: "会議タイトル" },
      element: {
        type: "plain_text_input",
        action_id: "val",
        max_length: 200,
      },
    },
    {
      type: "input",
      block_id: "desc",
      optional: true,
      label: { type: "plain_text", text: "説明 (任意)" },
      element: {
        type: "plain_text_input",
        action_id: "val",
        multiline: true,
        max_length: 1000,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "候補は2件以上、最大10件まで。日付のみ（時刻なし）も可。",
        },
      ],
    },
  ];

  for (let i = 1; i <= rowCount; i++) {
    blocks.push({
      type: "input",
      block_id: `slot_${i}_date`,
      optional: i > 2,
      label: { type: "plain_text", text: `候補 ${i} 日付` },
      element: {
        type: "datepicker",
        action_id: "val",
      },
    });
    blocks.push({
      type: "input",
      block_id: `slot_${i}_time`,
      optional: true,
      label: { type: "plain_text", text: `候補 ${i} 時刻` },
      element: {
        type: "timepicker",
        action_id: "val",
      },
    });
  }

  if (rowCount < MAX_CANDIDATES) {
    blocks.push({
      type: "actions",
      block_id: "mtg_add_row_block",
      elements: [
        {
          type: "button",
          action_id: MODAL_ADD_ROW_ACTION,
          text: { type: "plain_text", text: "候補を増やす" },
          value: String(rowCount),
        },
      ],
    });
  }

  return {
    type: "modal",
    callback_id: MODAL_CALLBACK_ID,
    title: { type: "plain_text", text: "日程調整" },
    submit: { type: "plain_text", text: "投稿する" },
    close: { type: "plain_text", text: "閉じる" },
    private_metadata: JSON.stringify(meta),
    blocks,
  };
}

/** Build the public message blocks showing candidates and current tallies. */
export function buildPublicMessageBlocks(args: {
  title: string;
  createdBy: string;
  tallies: CandidateTally[];
  closed?: boolean;
}): unknown[] {
  const { title, createdBy, tallies, closed } = args;

  const lines = tallies.map((t) => {
    const voters = t.voters.length > 0
      ? ` — ${t.voters.map((u) => `<@${u}>`).join(" ")}`
      : "";
    return `${toNumberEmoji(t.candidate.idx)} *${t.candidate.label}* — ${t.count}票${voters}`;
  });

  const blocks: unknown[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `📅 ${title}` },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: closed
          ? "*この調整は締め切られました。*"
          : "下の数字リアクションをクリックして、参加できる候補に投票してください。",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: lines.join("\n") || "候補がありません。",
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `主催: <@${createdBy}>`,
        },
      ],
    },
  ];

  return blocks;
}

/** Plain-text fallback used as chat.postMessage `text`. */
export function buildPublicMessageFallback(title: string): string {
  return `${title} の日程調整`;
}
