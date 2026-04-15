import { describe, it, expect } from "vitest";
import { formatAttachments } from "./attachments";
import type { SlackFile, SlackAttachment } from "../slack/types";

describe("formatAttachments", () => {
  it("returns empty string for no attachments", () => {
    expect(formatAttachments()).toBe("");
    expect(formatAttachments([], [])).toBe("");
  });

  it("formats image files as ![alt](url)", () => {
    const files: SlackFile[] = [
      {
        id: "F1",
        name: "photo.png",
        mimetype: "image/png",
        url_private: "https://files.slack.com/photo.png",
      },
    ];
    expect(formatAttachments(files)).toBe(
      "![photo.png](https://files.slack.com/photo.png)",
    );
  });

  it("uses title over name for images", () => {
    const files: SlackFile[] = [
      {
        id: "F1",
        name: "photo.png",
        title: "My Screenshot",
        mimetype: "image/png",
        url_private: "https://files.slack.com/photo.png",
      },
    ];
    expect(formatAttachments(files)).toBe(
      "![My Screenshot](https://files.slack.com/photo.png)",
    );
  });

  it("formats non-image files as attachment list items", () => {
    const files: SlackFile[] = [
      {
        id: "F2",
        name: "report.pdf",
        mimetype: "application/pdf",
        url_private: "https://files.slack.com/report.pdf",
      },
    ];
    expect(formatAttachments(files)).toBe(
      "- attachment: [report.pdf](https://files.slack.com/report.pdf)",
    );
  });

  it("formats multiple files", () => {
    const files: SlackFile[] = [
      {
        id: "F1",
        name: "img.jpg",
        mimetype: "image/jpeg",
        url_private: "https://files.slack.com/img.jpg",
      },
      {
        id: "F2",
        name: "doc.txt",
        mimetype: "text/plain",
        url_private: "https://files.slack.com/doc.txt",
      },
    ];
    const result = formatAttachments(files);
    expect(result).toContain("![img.jpg]");
    expect(result).toContain("- attachment: [doc.txt]");
  });

  it("formats legacy attachments with image_url", () => {
    const attachments: SlackAttachment[] = [
      { image_url: "https://example.com/image.png", title: "Preview" },
    ];
    expect(formatAttachments(undefined, attachments)).toBe(
      "![Preview](https://example.com/image.png)",
    );
  });

  it("formats legacy attachments with title and link", () => {
    const attachments: SlackAttachment[] = [
      { title: "Article", title_link: "https://example.com/article" },
    ];
    expect(formatAttachments(undefined, attachments)).toBe(
      "[Article](https://example.com/article)",
    );
  });

  it("formats legacy attachments with text as blockquote", () => {
    const attachments: SlackAttachment[] = [
      { text: "Some quoted text\nSecond line" },
    ];
    expect(formatAttachments(undefined, attachments)).toBe(
      "> Some quoted text\n> Second line",
    );
  });

  it("formats legacy attachment with pretext", () => {
    const attachments: SlackAttachment[] = [
      { pretext: "Check this out:", title: "Link", title_link: "https://example.com" },
    ];
    const result = formatAttachments(undefined, attachments);
    expect(result).toContain("Check this out:");
    expect(result).toContain("[Link](https://example.com)");
  });

  it("uses fallback alt text for image without title", () => {
    const attachments: SlackAttachment[] = [
      { image_url: "https://example.com/img.png" },
    ];
    expect(formatAttachments(undefined, attachments)).toBe(
      "![image](https://example.com/img.png)",
    );
  });

  it("skips empty legacy attachments", () => {
    const attachments: SlackAttachment[] = [{}];
    expect(formatAttachments(undefined, attachments)).toBe("");
  });
});
