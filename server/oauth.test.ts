import assert from "node:assert/strict";
import test from "node:test";
import { assertOAuthCallback, authenticateGitHubCode } from "./oauth.js";
import { HttpError } from "./http.js";

process.env.GITHUB_OAUTH_CLIENT_ID = "client";
process.env.GITHUB_OAUTH_CLIENT_SECRET = "secret";
process.env.GITHUB_ADMIN_LOGINS = "Atr1ck,SecondAdmin";

test("validates OAuth state with a required code", () => {
  assert.doesNotThrow(() => assertOAuthCallback("code", "same", "same"));
  assert.throws(
    () => assertOAuthCallback("code", "wrong", "expected"),
    (error) => error instanceof HttpError && error.status === 400,
  );
});

test("authenticates an allowlisted GitHub user", async () => {
  const responses = [
    new Response(JSON.stringify({ access_token: "oauth-token" }), { status: 200 }),
    new Response(JSON.stringify({ login: "atr1ck", avatar_url: "https://example.com/avatar.png" }), { status: 200 }),
  ];
  const user = await authenticateGitHubCode("code", async () => responses.shift()!);
  assert.equal(user.login, "atr1ck");
});

test("rejects a GitHub user outside the administrator allowlist", async () => {
  const responses = [
    new Response(JSON.stringify({ access_token: "oauth-token" }), { status: 200 }),
    new Response(JSON.stringify({ login: "stranger", avatar_url: "" }), { status: 200 }),
  ];
  await assert.rejects(
    authenticateGitHubCode("code", async () => responses.shift()!),
    (error) => error instanceof HttpError && error.status === 403,
  );
});
