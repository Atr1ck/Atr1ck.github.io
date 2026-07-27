import assert from "node:assert/strict";
import test from "node:test";
import type { VercelRequest } from "@vercel/node";
import { assertSameOrigin, HttpError, serializeCookie } from "./http.js";

test("sets hardened production cookie attributes", () => {
  const previousVercel = process.env.VERCEL;
  process.env.VERCEL = "1";
  const cookie = serializeCookie("session", "secret", { maxAge: 60 });
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Max-Age=60/);
  if (previousVercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = previousVercel;
});

test("requires an exact configured Origin", () => {
  process.env.APP_ORIGIN = "https://blog.example.com";
  assert.doesNotThrow(() => assertSameOrigin({ headers: { origin: "https://blog.example.com" } } as VercelRequest));
  assert.throws(
    () => assertSameOrigin({ headers: { origin: "https://evil.example.com" } } as VercelRequest),
    (error) => error instanceof HttpError && error.status === 403,
  );
});
