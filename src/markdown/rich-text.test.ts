import { describe, it, expect } from "vitest";
import { renderRichTextBlocks, extractUserIdsFromBlocks } from "./rich-text";
import type {
  RichTextBlock,
  RichTextSection,
  RichTextList,
} from "../slack/types";

const resolver = (id: string) => {
  const names: Record<string, string> = { U1: "Alice", U2: "Bob" };
  return names[id] ?? id;
};

function makeBlock(elements: RichTextBlock["elements"]): RichTextBlock[] {
  return [{ type: "rich_text", elements }];
}

function makeSection(
  ...elements: RichTextSection["elements"]
): RichTextSection {
  return { type: "rich_text_section", elements };
}

describe("extractUserIdsFromBlocks", () => {
  it("extracts user IDs from sections", () => {
    const blocks = makeBlock([
      makeSection({ type: "user", user_id: "U1" }, { type: "text", text: " hi" }),
    ]);
    expect(extractUserIdsFromBlocks(blocks)).toEqual(["U1"]);
  });

  it("extracts user IDs from list items", () => {
    const blocks = makeBlock([
      {
        type: "rich_text_list",
        style: "bullet",
        indent: 0,
        elements: [
          makeSection({ type: "user", user_id: "U2" }, { type: "text", text: " task" }),
        ],
      },
    ]);
    expect(extractUserIdsFromBlocks(blocks)).toEqual(["U2"]);
  });

  it("deduplicates IDs", () => {
    const blocks = makeBlock([
      makeSection({ type: "user", user_id: "U1" }),
      makeSection({ type: "user", user_id: "U1" }),
    ]);
    expect(extractUserIdsFromBlocks(blocks)).toEqual(["U1"]);
  });
});

describe("renderRichTextBlocks", () => {
  describe("sections (paragraphs)", () => {
    it("renders plain text", () => {
      const blocks = makeBlock([
        makeSection({ type: "text", text: "Hello world" }),
      ]);
      expect(renderRichTextBlocks(blocks, resolver)).toBe("Hello world");
    });

    it("renders multiple sections as paragraphs", () => {
      const blocks = makeBlock([
        makeSection({ type: "text", text: "Paragraph 1" }),
        makeSection({ type: "text", text: "Paragraph 2" }),
      ]);
      expect(renderRichTextBlocks(blocks, resolver)).toBe(
        "Paragraph 1\n\nParagraph 2",
      );
    });
  });

  describe("inline formatting", () => {
    it("applies bold", () => {
      const blocks = makeBlock([
        makeSection({ type: "text", text: "bold", style: { bold: true } }),
      ]);
      expect(renderRichTextBlocks(blocks, resolver)).toBe("**bold**");
    });

    it("applies italic", () => {
      const blocks = makeBlock([
        makeSection({ type: "text", text: "italic", style: { italic: true } }),
      ]);
      expect(renderRichTextBlocks(blocks, resolver)).toBe("*italic*");
    });

    it("applies strikethrough", () => {
      const blocks = makeBlock([
        makeSection({ type: "text", text: "deleted", style: { strike: true } }),
      ]);
      expect(renderRichTextBlocks(blocks, resolver)).toBe("~~deleted~~");
    });

    it("applies inline code", () => {
      const blocks = makeBlock([
        makeSection({ type: "text", text: "code", style: { code: true } }),
      ]);
      expect(renderRichTextBlocks(blocks, resolver)).toBe("`code`");
    });

    it("combines multiple styles", () => {
      const blocks = makeBlock([
        makeSection({
          type: "text",
          text: "strong",
          style: { bold: true, italic: true },
        }),
      ]);
      expect(renderRichTextBlocks(blocks, resolver)).toBe("***strong***");
    });
  });

  describe("inline elements", () => {
    it("renders links with text", () => {
      const blocks = makeBlock([
        makeSection({
          type: "link",
          url: "https://example.com",
          text: "Example",
        }),
      ]);
      expect(renderRichTextBlocks(blocks, resolver)).toBe(
        "[Example](https://example.com)",
      );
    });

    it("renders bare links", () => {
      const blocks = makeBlock([
        makeSection({ type: "link", url: "https://example.com" }),
      ]);
      expect(renderRichTextBlocks(blocks, resolver)).toBe(
        "https://example.com",
      );
    });

    it("renders user mentions", () => {
      const blocks = makeBlock([
        makeSection({ type: "user", user_id: "U1" }),
      ]);
      expect(renderRichTextBlocks(blocks, resolver)).toBe("@Alice");
    });

    it("renders broadcast mentions", () => {
      const blocks = makeBlock([
        makeSection({ type: "broadcast", range: "here" }),
      ]);
      expect(renderRichTextBlocks(blocks, resolver)).toBe("@here");
    });

    it("renders emoji with unicode", () => {
      const blocks = makeBlock([
        makeSection({ type: "emoji", name: "wave", unicode: "1f44b" }),
      ]);
      expect(renderRichTextBlocks(blocks, resolver)).toBe("👋");
    });

    it("renders emoji without unicode as shortcode", () => {
      const blocks = makeBlock([
        makeSection({ type: "emoji", name: "custom_emoji" }),
      ]);
      expect(renderRichTextBlocks(blocks, resolver)).toBe(":custom_emoji:");
    });
  });

  describe("bullet lists", () => {
    it("renders a flat bullet list", () => {
      const blocks = makeBlock([
        {
          type: "rich_text_list",
          style: "bullet",
          indent: 0,
          elements: [
            makeSection({ type: "text", text: "Item 1" }),
            makeSection({ type: "text", text: "Item 2" }),
            makeSection({ type: "text", text: "Item 3" }),
          ],
        },
      ]);
      expect(renderRichTextBlocks(blocks, resolver)).toBe(
        "- Item 1\n- Item 2\n- Item 3",
      );
    });

    it("renders nested bullet lists", () => {
      const blocks = makeBlock([
        {
          type: "rich_text_list",
          style: "bullet",
          indent: 0,
          elements: [
            makeSection({ type: "text", text: "Parent 1" }),
            makeSection({ type: "text", text: "Parent 2" }),
          ],
        },
        {
          type: "rich_text_list",
          style: "bullet",
          indent: 1,
          elements: [
            makeSection({ type: "text", text: "Child 2a" }),
            makeSection({ type: "text", text: "Child 2b" }),
          ],
        },
        {
          type: "rich_text_list",
          style: "bullet",
          indent: 0,
          elements: [
            makeSection({ type: "text", text: "Parent 3" }),
          ],
        },
      ]);
      expect(renderRichTextBlocks(blocks, resolver)).toBe(
        "- Parent 1\n- Parent 2\n  - Child 2a\n  - Child 2b\n- Parent 3",
      );
    });

    it("renders deeply nested bullet lists", () => {
      const blocks = makeBlock([
        {
          type: "rich_text_list",
          style: "bullet",
          indent: 0,
          elements: [makeSection({ type: "text", text: "Level 0" })],
        },
        {
          type: "rich_text_list",
          style: "bullet",
          indent: 1,
          elements: [makeSection({ type: "text", text: "Level 1" })],
        },
        {
          type: "rich_text_list",
          style: "bullet",
          indent: 2,
          elements: [makeSection({ type: "text", text: "Level 2" })],
        },
      ]);
      expect(renderRichTextBlocks(blocks, resolver)).toBe(
        "- Level 0\n  - Level 1\n    - Level 2",
      );
    });
  });

  describe("ordered lists", () => {
    it("renders a flat ordered list", () => {
      const blocks = makeBlock([
        {
          type: "rich_text_list",
          style: "ordered",
          indent: 0,
          elements: [
            makeSection({ type: "text", text: "First" }),
            makeSection({ type: "text", text: "Second" }),
            makeSection({ type: "text", text: "Third" }),
          ],
        },
      ]);
      expect(renderRichTextBlocks(blocks, resolver)).toBe(
        "1. First\n2. Second\n3. Third",
      );
    });

    it("renders nested ordered lists with independent counters", () => {
      const blocks = makeBlock([
        {
          type: "rich_text_list",
          style: "ordered",
          indent: 0,
          elements: [
            makeSection({ type: "text", text: "Parent 1" }),
            makeSection({ type: "text", text: "Parent 2" }),
          ],
        },
        {
          type: "rich_text_list",
          style: "ordered",
          indent: 1,
          elements: [
            makeSection({ type: "text", text: "Child a" }),
            makeSection({ type: "text", text: "Child b" }),
          ],
        },
      ]);
      expect(renderRichTextBlocks(blocks, resolver)).toBe(
        "1. Parent 1\n2. Parent 2\n  1. Child a\n  2. Child b",
      );
    });
  });

  describe("mixed lists", () => {
    it("renders mixed bullet and ordered lists", () => {
      const blocks = makeBlock([
        {
          type: "rich_text_list",
          style: "ordered",
          indent: 0,
          elements: [
            makeSection({ type: "text", text: "Step 1" }),
            makeSection({ type: "text", text: "Step 2" }),
          ],
        },
        {
          type: "rich_text_list",
          style: "bullet",
          indent: 1,
          elements: [
            makeSection({ type: "text", text: "Detail A" }),
            makeSection({ type: "text", text: "Detail B" }),
          ],
        },
      ]);
      expect(renderRichTextBlocks(blocks, resolver)).toBe(
        "1. Step 1\n2. Step 2\n  - Detail A\n  - Detail B",
      );
    });
  });

  describe("lists with formatted content", () => {
    it("renders list items with inline formatting", () => {
      const blocks = makeBlock([
        {
          type: "rich_text_list",
          style: "bullet",
          indent: 0,
          elements: [
            makeSection(
              { type: "text", text: "Use " },
              { type: "text", text: "bold", style: { bold: true } },
              { type: "text", text: " here" },
            ),
            makeSection(
              { type: "link", url: "https://example.com", text: "Link item" },
            ),
          ],
        },
      ]);
      expect(renderRichTextBlocks(blocks, resolver)).toBe(
        "- Use **bold** here\n- [Link item](https://example.com)",
      );
    });
  });

  describe("preformatted (code blocks)", () => {
    it("renders a code block", () => {
      const blocks = makeBlock([
        {
          type: "rich_text_preformatted",
          elements: [{ type: "text", text: "const x = 1;\nconsole.log(x);" }],
        },
      ]);
      expect(renderRichTextBlocks(blocks, resolver)).toBe(
        "```\nconst x = 1;\nconsole.log(x);\n```",
      );
    });
  });

  describe("quotes", () => {
    it("renders a blockquote", () => {
      const blocks = makeBlock([
        {
          type: "rich_text_quote",
          elements: [{ type: "text", text: "A wise person once said" }],
        },
      ]);
      expect(renderRichTextBlocks(blocks, resolver)).toBe(
        "> A wise person once said",
      );
    });

    it("renders multi-line blockquotes", () => {
      const blocks = makeBlock([
        {
          type: "rich_text_quote",
          elements: [{ type: "text", text: "Line 1\nLine 2" }],
        },
      ]);
      expect(renderRichTextBlocks(blocks, resolver)).toBe(
        "> Line 1\n> Line 2",
      );
    });
  });

  describe("mixed content", () => {
    it("renders paragraph, list, and code together", () => {
      const blocks = makeBlock([
        makeSection({ type: "text", text: "Here is a list:" }),
        {
          type: "rich_text_list",
          style: "bullet",
          indent: 0,
          elements: [
            makeSection({ type: "text", text: "Item A" }),
            makeSection({ type: "text", text: "Item B" }),
          ],
        },
        makeSection({ type: "text", text: "And some code:" }),
        {
          type: "rich_text_preformatted",
          elements: [{ type: "text", text: "hello()" }],
        },
      ]);
      const result = renderRichTextBlocks(blocks, resolver);
      expect(result).toBe(
        "Here is a list:\n\n- Item A\n- Item B\n\nAnd some code:\n\n```\nhello()\n```",
      );
    });
  });
});
