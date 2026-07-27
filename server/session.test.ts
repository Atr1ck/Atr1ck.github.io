import assert from "node:assert/strict";
import test from "node:test";
import type { VercelRequest } from "@vercel/node";
import { HttpError } from "./http.js";
import {
  assertCsrf,
  createSessionToken,
  readSessionToken,
  safeEqual,
} from "./session.js";

process.env.SESSION_SECRET = "test-session-secret-with-at-least-32-characters";

test("encrypts and decrypts an admin session", async () => {
  const source = {
    login: "Atr1ck",
    avatarUrl: "https://example.com/avatar.png",
    csrfToken: "csrf-token",
  };

  const token = await createSessionToken(source);
  assert.notEqual(token.includes(source.login), true);
  assert.deepEqual(await readSessionToken(token), source);
});

test("rejects a modified session token", async () => {
  const token = await createSessionToken({
    login: "Atr1ck",
    avatarUrl: "https://example.com/avatar.png",
    csrfToken: "csrf-token",
  });
  const segments = token.split(".");
  const ciphertext = segments[3];
  const index = Math.floor(ciphertext.length / 2);
  const replacement = ciphertext[index] === "a" ? "b" : "a";
  segments[3] = `${ciphertext.slice(0, index)}${replacement}${ciphertext.slice(index + 1)}`;
  assert.equal(await readSessionToken(segments.join(".")), null);
});

test("uses timing-safe CSRF equality and rejects missing tokens", () => {
  assert.equal(safeEqual("same-token", "same-token"), true);
  assert.equal(safeEqual("same-token", "other-token"), false);

  const request = { headers: {} } as VercelRequest;
  assert.throws(
    () => assertCsrf(request, { login: "Atr1ck", avatarUrl: "", csrfToken: "required" }),
    (error) => error instanceof HttpError && error.status === 403,
  );
});
