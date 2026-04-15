import { describe, it, expect } from "vitest";
import { transformMrkdwn, extractUserIds } from "./transform";

const defaultResolver = (id: string) => id;

describe("extractUserIds", () => {
  it("extracts user IDs from text", () => {
    expect(extractUserIds("Hello <@U123ABC> and <@U456DEF>")).toEqual([
      "U123ABC",
      "U456DEF",
    ]);
  });

  it("deduplicates user IDs", () => {
    expect(extractUserIds("<@U123> said hi to <@U123>")).toEqual(["U123"]);
  });

  it("returns empty array for text without mentions", () => {
    expect(extractUserIds("no mentions here")).toEqual([]);
  });
});

describe("transformMrkdwn", () => {
  describe("entity decoding", () => {
    it("decodes &amp; &lt; &gt;", () => {
      expect(transformMrkdwn("a &amp; b &lt; c &gt; d")).toBe("a & b < c > d");
    });
  });

  describe("user mentions", () => {
    it("resolves user mentions with a resolver", () => {
      const resolver = (id: string) => (id === "U123" ? "Alice" : id);
      expect(transformMrkdwn("Hello <@U123>!", resolver)).toBe(
        "Hello @Alice!",
      );
    });

    it("keeps the ID if resolver returns it", () => {
      expect(transformMrkdwn("Hi <@U999>", defaultResolver)).toBe(
        "Hi @U999",
      );
    });
  });

  describe("channel mentions", () => {
    it("resolves channel mentions", () => {
      expect(transformMrkdwn("Go to <#C123|general>")).toBe(
        "Go to #general",
      );
    });
  });

  describe("special mentions", () => {
    it("resolves <!here>", () => {
      expect(transformMrkdwn("Hey <!here>")).toBe("Hey @here");
    });

    it("resolves <!channel>", () => {
      expect(transformMrkdwn("FYI <!channel>")).toBe("FYI @channel");
    });

    it("resolves <!everyone>", () => {
      expect(transformMrkdwn("Attention <!everyone>")).toBe(
        "Attention @everyone",
      );
    });
  });

  describe("usergroup mentions", () => {
    it("resolves subteam mentions", () => {
      expect(
        transformMrkdwn("Notify <!subteam^S123|engineering>"),
      ).toBe("Notify @engineering");
    });
  });

  describe("date formatting", () => {
    it("uses fallback text for date tokens", () => {
      expect(
        transformMrkdwn("Posted <!date^1392734382^{date}|Feb 18, 2014>"),
      ).toBe("Posted Feb 18, 2014");
    });
  });

  describe("links", () => {
    it("converts labeled links", () => {
      expect(
        transformMrkdwn("See <https://example.com|our docs>"),
      ).toBe("See [our docs](https://example.com)");
    });

    it("converts bare links", () => {
      expect(transformMrkdwn("Visit <https://example.com>")).toBe(
        "Visit https://example.com",
      );
    });

    it("converts mailto links", () => {
      expect(
        transformMrkdwn("Email <mailto:test@example.com|test@example.com>"),
      ).toBe("Email [test@example.com](mailto:test@example.com)");
    });
  });

  describe("bold", () => {
    it("converts *bold* to **bold**", () => {
      expect(transformMrkdwn("This is *bold* text")).toBe(
        "This is **bold** text",
      );
    });

    it("converts *multi word bold* to **multi word bold**", () => {
      expect(transformMrkdwn("*multi word bold*")).toBe(
        "**multi word bold**",
      );
    });

    it("handles bold at start of text", () => {
      expect(transformMrkdwn("*bold* start")).toBe("**bold** start");
    });

    it("does not match * with trailing space (list marker)", () => {
      expect(transformMrkdwn("* list item")).toBe("* list item");
    });
  });

  describe("italic", () => {
    it("converts _italic_ to *italic*", () => {
      expect(transformMrkdwn("This is _italic_ text")).toBe(
        "This is *italic* text",
      );
    });

    it("does not convert underscores in URLs", () => {
      const url = "https://example.com/foo_bar_baz";
      expect(transformMrkdwn(url)).toBe(url);
    });

    it("does not convert snake_case identifiers", () => {
      expect(transformMrkdwn("use my_variable_name here")).toBe(
        "use my_variable_name here",
      );
    });

    it("converts italic at start of text", () => {
      expect(transformMrkdwn("_italic_ start")).toBe("*italic* start");
    });
  });

  describe("strikethrough", () => {
    it("converts ~strike~ to ~~strike~~", () => {
      expect(transformMrkdwn("This is ~deleted~ text")).toBe(
        "This is ~~deleted~~ text",
      );
    });

    it("converts at start of text", () => {
      expect(transformMrkdwn("~gone~ now")).toBe("~~gone~~ now");
    });
  });

  describe("code preservation", () => {
    it("preserves inline code", () => {
      expect(transformMrkdwn("Use `*not bold*` here")).toBe(
        "Use `*not bold*` here",
      );
    });

    it("preserves fenced code blocks", () => {
      const input = "Before\n```\n*not bold*\n_not italic_\n```\nAfter";
      expect(transformMrkdwn(input)).toBe(
        "Before\n```\n*not bold*\n_not italic_\n```\nAfter",
      );
    });

    it("preserves code blocks with language hint", () => {
      const input = "```javascript\nconst x = 1;\n```";
      expect(transformMrkdwn(input)).toBe("```javascript\nconst x = 1;\n```");
    });
  });

  describe("blockquotes", () => {
    it("adds space after > if missing", () => {
      expect(transformMrkdwn("&gt;quoted text")).toBe("> quoted text");
    });

    it("keeps space if already present", () => {
      expect(transformMrkdwn("&gt; quoted text")).toBe("> quoted text");
    });

    it("handles multi-line blockquotes", () => {
      expect(transformMrkdwn("&gt;line 1\n&gt;line 2")).toBe(
        "> line 1\n> line 2",
      );
    });
  });

  describe("bullet lists (text fallback)", () => {
    it("converts • to - for bullet lists", () => {
      expect(transformMrkdwn("• Item 1\n• Item 2\n• Item 3")).toBe(
        "- Item 1\n- Item 2\n- Item 3",
      );
    });

    it("preserves indentation for nested bullets", () => {
      expect(transformMrkdwn("• Parent\n  • Child\n    • Grandchild")).toBe(
        "- Parent\n  - Child\n    - Grandchild",
      );
    });

    it("does not convert • in the middle of text", () => {
      expect(transformMrkdwn("Price is 5•00")).toBe("Price is 5•00");
    });

    it("handles mixed content with bullets", () => {
      expect(transformMrkdwn("List:\n• One\n• Two\nDone")).toBe(
        "List:\n- One\n- Two\nDone",
      );
    });
  });

  describe("combined formatting", () => {
    it("handles mixed formatting", () => {
      const input = "Hey <@U123>, check *this* _link_: <https://example.com|click>";
      const resolver = (id: string) => (id === "U123" ? "Bob" : id);
      expect(transformMrkdwn(input, resolver)).toBe(
        "Hey @Bob, check **this** *link*: [click](https://example.com)",
      );
    });

    it("handles entities in complex text", () => {
      expect(transformMrkdwn("a &amp; b in `code &amp; more`")).toBe(
        "a & b in `code &amp; more`",
      );
    });
  });
});
