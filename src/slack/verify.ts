const encoder = new TextEncoder();

/**
 * Verify a Slack request signature using HMAC-SHA256 (Web Crypto API).
 * Returns true if the signature is valid and the timestamp is fresh.
 */
export async function verifySlackRequest(
  signingSecret: string,
  signature: string,
  timestamp: string,
  body: string,
  toleranceSec = 300,
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(now - ts) > toleranceSec) {
    return false;
  }

  const basestring = `v0:${timestamp}:${body}`;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(basestring));
  const computed = "v0=" + arrayBufferToHex(sig);

  return timingSafeEqual(computed, signature);
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, "0");
  }
  return hex;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  // Use crypto.subtle.timingSafeEqual if available (Cloudflare Workers)
  if (
    typeof crypto !== "undefined" &&
    "subtle" in crypto &&
    "timingSafeEqual" in crypto.subtle
  ) {
    return (crypto.subtle as any).timingSafeEqual(aBytes, bBytes);
  }

  // Fallback: constant-time comparison for test environments
  let result = 0;
  for (let i = 0; i < aBytes.length; i++) {
    result |= aBytes[i] ^ bBytes[i];
  }
  return result === 0;
}
