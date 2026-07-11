/**
 * Lightweight password gate for the whole app.
 *
 * Auth is ON only when APP_PASSWORD is set (so an un-configured deploy is never
 * accidentally locked out). A successful login stores a signed, expiring cookie
 * that the middleware verifies on every request. Everything here uses the Web
 * Crypto API only, so it runs unchanged in the Edge middleware and in Node
 * server actions.
 */
export const AUTH_COOKIE = "sf_session";
const SESSION_DAYS = 30;

export function authEnabled(): boolean {
  return !!process.env.APP_PASSWORD;
}

function secret(): string {
  // AUTH_SECRET signs the cookie; fall back to the password so the gate works
  // with only APP_PASSWORD configured.
  return process.env.AUTH_SECRET || process.env.APP_PASSWORD || "starflare-dev-secret";
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sign(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return toHex(sig);
}

/** Constant-time string compare (equal-length hex/ascii). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Creates a signed session token valid for SESSION_DAYS. */
export async function createSessionToken(): Promise<string> {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const sig = await sign(`sf|${exp}`);
  return `${exp}.${sig}`;
}

/** Verifies a session token's signature and expiry. */
export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 0) return false;
  const exp = Number(token.slice(0, dot));
  const sig = token.slice(dot + 1);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = await sign(`sf|${exp}`);
  return safeEqual(sig, expected);
}

export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;
