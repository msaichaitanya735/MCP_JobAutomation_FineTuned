/**
 * Tiny HMAC-signed session cookie helpers, Edge-runtime safe.
 *
 * The session value is `${issuedAtMs}.${hmacSha256Hex(secret, issuedAtMs)}`.
 * On verify we check the HMAC and the age. No JWT, no library.
 *
 * Two server-side env vars are required:
 *   DEMO_PASSWORD        - the shared password the user types at /login
 *   AUTH_COOKIE_SECRET   - random key used to sign the session cookie
 */

const SESSION_COOKIE = "demo_session";
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  // Caller is responsible for ensuring equal length when meaningful.
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function signSession(
  secret: string,
  issuedAt: number = Date.now()
): Promise<string> {
  const ts = String(issuedAt);
  const sig = await hmacSha256Hex(secret, ts);
  return `${ts}.${sig}`;
}

export async function verifySession(secret: string, value: string): Promise<boolean> {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 2) return false;
  const [ts, sig] = parts;
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;
  const ageMs = Date.now() - tsNum;
  if (ageMs < 0 || ageMs > SESSION_MAX_AGE_SEC * 1000) return false;
  const expected = await hmacSha256Hex(secret, ts);
  return timingSafeEqual(sig, expected);
}

/**
 * Constant-time password check. We HMAC both inputs against a fixed key so the
 * comparison is over equal-length 64-char hex digests regardless of the
 * provided password length.
 */
export async function checkPassword(provided: string, expected: string): Promise<boolean> {
  if (!expected) return false;
  const fixedKey = "job-pipeline-demo-password-compare-v1";
  const [a, b] = await Promise.all([
    hmacSha256Hex(fixedKey, provided),
    hmacSha256Hex(fixedKey, expected),
  ]);
  return timingSafeEqual(a, b);
}

export const AUTH = {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SEC,
};
