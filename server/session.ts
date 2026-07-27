import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { EncryptJWT, jwtDecrypt } from "jose";
import type { VercelRequest } from "@vercel/node";
import { requireEnv } from "./config.js";
import { HttpError, parseCookies } from "./http.js";

export const SESSION_COOKIE = "admin_session";
export const OAUTH_STATE_COOKIE = "github_oauth_state";
export const SESSION_DURATION_SECONDS = 8 * 60 * 60;

export interface AdminSession {
  login: string;
  avatarUrl: string;
  csrfToken: string;
}

function getSessionKey(): Uint8Array {
  const secret = requireEnv("SESSION_SECRET");
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("SESSION_SECRET must be at least 32 bytes");
  }
  return createHash("sha256").update(secret).digest();
}

export function createRandomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export async function createSessionToken(session: AdminSession): Promise<string> {
  return new EncryptJWT({
    login: session.login,
    avatarUrl: session.avatarUrl,
    csrfToken: session.csrfToken,
  })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .encrypt(getSessionKey());
}

export async function readSessionToken(token: string): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtDecrypt(token, getSessionKey(), {
      clockTolerance: 5,
    });
    if (
      typeof payload.login !== "string" ||
      typeof payload.avatarUrl !== "string" ||
      typeof payload.csrfToken !== "string"
    ) {
      return null;
    }

    return {
      login: payload.login,
      avatarUrl: payload.avatarUrl,
      csrfToken: payload.csrfToken,
    };
  } catch {
    return null;
  }
}

export async function requireSession(request: VercelRequest): Promise<AdminSession> {
  const token = parseCookies(request)[SESSION_COOKIE];
  const session = token ? await readSessionToken(token) : null;
  if (!session) throw new HttpError(401, "Authentication required");
  return session;
}

export function assertCsrf(request: VercelRequest, session: AdminSession): void {
  const supplied = request.headers["x-csrf-token"];
  const token = Array.isArray(supplied) ? supplied[0] : supplied;
  if (!token || !safeEqual(token, session.csrfToken)) {
    throw new HttpError(403, "Invalid CSRF token");
  }
}

export function safeEqual(first: string, second: string): boolean {
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);
  return firstBuffer.length === secondBuffer.length && timingSafeEqual(firstBuffer, secondBuffer);
}
