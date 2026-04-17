import { describe, expect, it } from "vitest";
import { matchesMeetingKeyword, normalizeForMatch } from "./keywords";

describe("matchesMeetingKeyword", () => {
  it("matches ASCII keywords with word-ish boundaries", () => {
    expect(matchesMeetingKeyword("明日の mtg は何時？")).toBe(true);
    expect(matchesMeetingKeyword("MTG 30分")).toBe(true);
    expect(matchesMeetingKeyword("let's set up a meeting")).toBe(true);
    expect(matchesMeetingKeyword("meetings tomorrow")).toBe(true);
  });

  it("does not match ASCII keywords embedded in other letters", () => {
    expect(matchesMeetingKeyword("geometric drawing")).toBe(false);
    expect(matchesMeetingKeyword("algorithm")).toBe(false);
    expect(matchesMeetingKeyword("smtg")).toBe(false);
  });

  it("matches Japanese keywords as substrings", () => {
    expect(matchesMeetingKeyword("ミーティングしよう")).toBe(true);
    expect(matchesMeetingKeyword("明日打ち合わせですね")).toBe(true);
    expect(matchesMeetingKeyword("打合せの件")).toBe(true);
    expect(matchesMeetingKeyword("打ち合せ予定")).toBe(true);
    expect(matchesMeetingKeyword("打合わせ時間")).toBe(true);
    expect(matchesMeetingKeyword("今週の会議")).toBe(true);
    expect(matchesMeetingKeyword("面談お願いします")).toBe(true);
  });

  it("handles 全角 ASCII via NFKC normalization", () => {
    expect(matchesMeetingKeyword("ＭＴＧどうしますか")).toBe(true);
    expect(matchesMeetingKeyword("ｍｔｇ の件")).toBe(true);
    expect(matchesMeetingKeyword("Ｍｔｇ 予定")).toBe(true);
  });

  it("returns false for empty or non-matching text", () => {
    expect(matchesMeetingKeyword("")).toBe(false);
    expect(matchesMeetingKeyword("hello world")).toBe(false);
    expect(matchesMeetingKeyword("今日は雨です")).toBe(false);
  });
});

describe("normalizeForMatch", () => {
  it("lowercases and applies NFKC", () => {
    expect(normalizeForMatch("ＭＴＧ")).toBe("mtg");
    expect(normalizeForMatch("Meeting")).toBe("meeting");
  });
});
