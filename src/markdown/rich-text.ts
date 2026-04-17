/**
 * Render Block Kit rich_text blocks to standard Markdown.
 * Handles sections, lists (bullet/ordered with nesting), code blocks, and quotes.
 */

import type {
  RichTextBlock,
  RichTextElement,
  RichTextSection,
  RichTextList,
  RichTextPreformatted,
  RichTextQuote,
  RichTextInlineElement,
  RichTextStyle,
} from "../slack/types";
import type { UserResolver } from "./transform";

/**
 * Extract all user IDs referenced in rich_text blocks.
 */
export function extractUserIdsFromBlocks(blocks: RichTextBlock[]): string[] {
  const ids = new Set<string>();
  for (const block of blocks) {
    for (const el of block.elements) {
      collectUserIdsFromElement(el, ids);
    }
  }
  return [...ids];
}

function collectUserIdsFromElement(
  el: RichTextElement,
  ids: Set<string>,
): void {
  switch (el.type) {
    case "rich_text_section":
    case "rich_text_preformatted":
    case "rich_text_quote":
      for (const inline of el.elements) {
        if (inline.type === "user") {
          ids.add(inline.user_id);
        }
      }
      break;
    case "rich_text_list":
      for (const item of el.elements) {
        collectUserIdsFromElement(item, ids);
      }
      break;
  }
}

/**
 * Render an array of rich_text blocks to Markdown.
 */
export function renderRichTextBlocks(
  blocks: RichTextBlock[],
  userResolver: UserResolver,
): string {
  const parts: string[] = [];
  for (const block of blocks) {
    parts.push(renderRichTextBlock(block, userResolver));
  }
  return parts.join("\n\n");
}

function renderRichTextBlock(
  block: RichTextBlock,
  userResolver: UserResolver,
): string {
  const parts: string[] = [];

  // Group consecutive list elements to handle them together
  let i = 0;
  while (i < block.elements.length) {
    const el = block.elements[i];

    if (el.type === "rich_text_list") {
      // Collect consecutive list elements (they form a single logical list with nesting)
      const listGroup: RichTextList[] = [el];
      let j = i + 1;
      while (j < block.elements.length && block.elements[j].type === "rich_text_list") {
        listGroup.push(block.elements[j] as RichTextList);
        j++;
      }
      parts.push(renderListGroup(listGroup, userResolver));
      i = j;
    } else {
      parts.push(renderElement(el, userResolver));
      i++;
    }
  }

  return parts.join("\n\n");
}

function renderElement(
  el: RichTextElement,
  userResolver: UserResolver,
): string {
  switch (el.type) {
    case "rich_text_section":
      return renderSection(el, userResolver);
    case "rich_text_list":
      // Single list (not grouped) — render as a standalone list
      return renderListGroup([el], userResolver);
    case "rich_text_preformatted":
      return renderPreformatted(el);
    case "rich_text_quote":
      return renderQuote(el, userResolver);
    default:
      return "";
  }
}

function renderSection(
  section: RichTextSection,
  userResolver: UserResolver,
): string {
  return renderInlineElements(section.elements, userResolver);
}

/**
 * Render a group of consecutive list blocks into a Markdown list.
 * Slack represents nesting via separate blocks with increasing `indent` values.
 */
function renderListGroup(
  lists: RichTextList[],
  userResolver: UserResolver,
): string {
  const lines: string[] = [];
  // Track ordered list counters per indent level
  const orderedCounters = new Map<number, number>();

  for (const list of lists) {
    const indent = list.indent;
    const style = list.style;

    // Reset counter for this indent level if it's a new bullet list at this level
    if (style === "ordered" && !orderedCounters.has(indent)) {
      orderedCounters.set(indent, 0);
    }

    for (const item of list.elements) {
      const content = renderSection(item, userResolver);
      const indentStr = "  ".repeat(indent);

      if (style === "ordered") {
        const count = (orderedCounters.get(indent) ?? 0) + 1;
        orderedCounters.set(indent, count);
        lines.push(`${indentStr}${count}. ${content}`);
      } else {
        lines.push(`${indentStr}- ${content}`);
      }
    }
  }

  return lines.join("\n");
}

function renderPreformatted(
  el: RichTextPreformatted,
): string {
  // Render as fenced code block
  // Inline elements in preformatted blocks are plain text (no formatting applied)
  const content = el.elements
    .map((inline) => {
      if (inline.type === "text") return inline.text;
      if (inline.type === "link") return inline.url;
      return "";
    })
    .join("");
  return "```\n" + content + "\n```";
}

function renderQuote(
  el: RichTextQuote,
  userResolver: UserResolver,
): string {
  const content = renderInlineElements(el.elements, userResolver);
  return content
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

/**
 * Render an array of inline elements to a Markdown string.
 */
function renderInlineElements(
  elements: RichTextInlineElement[],
  userResolver: UserResolver,
): string {
  return elements.map((el) => renderInlineElement(el, userResolver)).join("");
}

function renderInlineElement(
  el: RichTextInlineElement,
  userResolver: UserResolver,
): string {
  switch (el.type) {
    case "text":
      return applyStyle(el.text, el.style);
    case "link":
      return renderLink(el.url, el.text, el.style);
    case "user":
      return applyStyle(`@${userResolver(el.user_id)}`, el.style);
    case "channel":
      // Channel name isn't in the block data, just show the ID
      return applyStyle(`#${el.channel_id}`, el.style);
    case "usergroup":
      return applyStyle(`@${el.usergroup_id}`, el.style);
    case "emoji":
      if (el.unicode) {
        return String.fromCodePoint(
          ...el.unicode.split("-").map((hex) => parseInt(hex, 16)),
        );
      }
      return `:${el.name}:`;
    case "broadcast":
      return applyStyle(`@${el.range}`, el.style);
    default:
      return "";
  }
}

function renderLink(
  url: string,
  text: string | undefined,
  style?: RichTextStyle,
): string {
  if (text && text !== url) {
    return applyStyle(`[${text}](${url})`, style);
  }
  return applyStyle(url, style);
}

function applyStyle(text: string, style?: RichTextStyle): string {
  if (!style) return text;

  let result = text;

  // Code must be applied first (innermost)
  if (style.code) {
    result = `\`${result}\``;
  }

  if (style.bold) {
    result = `**${result}**`;
  }
  if (style.italic) {
    result = `*${result}*`;
  }
  if (style.strike) {
    result = `~~${result}~~`;
  }

  return result;
}
