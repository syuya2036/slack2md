import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifySlackRequest } from "./verify";

const SECRET = "8f742231b10e8888abcd99yez56789d0";

async function computeSignature(
  secret: string,
  timestamp: string,
  body: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`v0:${timestamp}:${body}`),
  );
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `v0=${hex}`;
}

describe("verifySlackRequest", () => {
  let realDateNow: () => number;

  beforeEach(() => {
    realDateNow = Date.now;
  });

  afterEach(() => {
    Date.now = realDateNow;
  });

  it("accepts a valid signature with fresh timestamp", async () => {
    const now = Math.floor(Date.now() / 1000);
    const timestamp = String(now);
    const body = "token=xyzz0WbapA4vBCDEFasx0q6G&command=%2Ftomd&text=";
    const signature = await computeSignature(SECRET, timestamp, body);

    const result = await verifySlackRequest(
      SECRET,
      signature,
      timestamp,
      body,
    );
    expect(result).toBe(true);
  });

  it("rejects an invalid signature", async () => {
    const now = Math.floor(Date.now() / 1000);
    const timestamp = String(now);
    const body = "some body";
    const badSig = "v0=0000000000000000000000000000000000000000000000000000000000000000";

    const result = await verifySlackRequest(SECRET, badSig, timestamp, body);
    expect(result).toBe(false);
  });

  it("rejects a stale timestamp (> 5 minutes old)", async () => {
    const now = Math.floor(Date.now() / 1000);
    const staleTimestamp = String(now - 400); // 400 seconds ago
    const body = "test body";
    const signature = await computeSignature(SECRET, staleTimestamp, body);

    const result = await verifySlackRequest(
      SECRET,
      signature,
      staleTimestamp,
      body,
    );
    expect(result).toBe(false);
  });

  it("rejects a future timestamp (> 5 minutes ahead)", async () => {
    const now = Math.floor(Date.now() / 1000);
    const futureTimestamp = String(now + 400);
    const body = "test body";
    const signature = await computeSignature(SECRET, futureTimestamp, body);

    const result = await verifySlackRequest(
      SECRET,
      signature,
      futureTimestamp,
      body,
    );
    expect(result).toBe(false);
  });

  it("accepts a timestamp within tolerance", async () => {
    const now = Math.floor(Date.now() / 1000);
    const timestamp = String(now - 200); // 200 seconds ago, within 300s tolerance
    const body = "test body";
    const signature = await computeSignature(SECRET, timestamp, body);

    const result = await verifySlackRequest(
      SECRET,
      signature,
      timestamp,
      body,
    );
    expect(result).toBe(true);
  });

  it("handles empty body with valid signature", async () => {
    const now = Math.floor(Date.now() / 1000);
    const timestamp = String(now);
    const body = "";
    const signature = await computeSignature(SECRET, timestamp, body);

    const result = await verifySlackRequest(
      SECRET,
      signature,
      timestamp,
      body,
    );
    expect(result).toBe(true);
  });

  it("rejects non-numeric timestamp", async () => {
    const result = await verifySlackRequest(SECRET, "v0=abc", "notanumber", "body");
    expect(result).toBe(false);
  });

  it("supports custom tolerance", async () => {
    const now = Math.floor(Date.now() / 1000);
    const timestamp = String(now - 200);
    const body = "test";
    const signature = await computeSignature(SECRET, timestamp, body);

    // With 100s tolerance, 200s ago should fail
    const result = await verifySlackRequest(SECRET, signature, timestamp, body, 100);
    expect(result).toBe(false);
  });
});
