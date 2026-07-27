import assert from "node:assert/strict";
import test from "node:test";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import publishHandler from "../api/articles/publish.js";
import listHandler from "../api/articles.js";
import redeployHandler from "../api/deployments/redeploy.js";
import logoutHandler from "../api/auth/logout.js";
import callbackHandler from "../api/auth/callback.js";
import sessionHandler from "../api/auth/session.js";
import { createSessionToken, SESSION_COOKIE } from "./session.js";

process.env.APP_ORIGIN = "https://blog.example.com";
process.env.SESSION_SECRET = "handler-test-session-secret-at-least-32-bytes";
process.env.GITHUB_REPOSITORY_OWNER = "Atr1ck";
process.env.GITHUB_REPOSITORY_NAME = "Atr1ck.github.io";
process.env.GITHUB_BRANCH = "main";
process.env.VERCEL_API_TOKEN = "vercel-test-token";
process.env.VERCEL_PROJECT_ID = "prj_test";

const VALID_MARKDOWN = `---
title: Handler test
slug: handler-test
date: 2026-07-27
updated: 2026-07-27
tags: []
summary: Handler test article.
published: true
---

# Handler test`;

class MockResponse {
  statusCode = 200;
  body: unknown;
  headers = new Map<string, unknown>();
  ended = false;

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  json(body: unknown) {
    this.body = body;
    return this;
  }

  setHeader(name: string, value: unknown) {
    this.headers.set(name.toLowerCase(), value);
    return this;
  }

  end() {
    this.ended = true;
    return this;
  }

  redirect(status: number, location: string) {
    this.statusCode = status;
    this.headers.set("location", location);
    return this;
  }
}

function responsePair() {
  const response = new MockResponse();
  return { response, vercelResponse: response as unknown as VercelResponse };
}

const writeHandlers = [
  ["publish", publishHandler],
  ["redeploy", redeployHandler],
  ["logout", logoutHandler],
] as const;

for (const [name, handler] of writeHandlers) {
  test(`${name} rejects a missing Origin before external work`, async () => {
    const { response, vercelResponse } = responsePair();
    await handler({ method: "POST", headers: {}, body: {} } as VercelRequest, vercelResponse);
    assert.equal(response.statusCode, 403);
  });

  test(`${name} requires an authenticated session`, async () => {
    const { response, vercelResponse } = responsePair();
    await handler({
      method: "POST",
      headers: { origin: process.env.APP_ORIGIN },
      body: {},
    } as unknown as VercelRequest, vercelResponse);
    assert.equal(response.statusCode, 401);
  });

  test(`${name} rejects a missing CSRF token`, async () => {
    const token = await createSessionToken({ login: "Atr1ck", avatarUrl: "", csrfToken: "required" });
    const { response, vercelResponse } = responsePair();
    await handler({
      method: "POST",
      headers: {
        origin: process.env.APP_ORIGIN,
        cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
      },
      body: {},
    } as VercelRequest, vercelResponse);
    assert.equal(response.statusCode, 403);
  });
}

test("article listing requires authentication before GitHub access", async () => {
  const { response, vercelResponse } = responsePair();
  await listHandler({ method: "GET", headers: {} } as VercelRequest, vercelResponse);
  assert.equal(response.statusCode, 401);
});

test("publish blocks a Vercel production branch mismatch before GitHub writes", async () => {
  const token = await createSessionToken({ login: "Atr1ck", avatarUrl: "", csrfToken: "csrf" });
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (input) => {
    calls += 1;
    assert.match(String(input), /api\.vercel\.com\/v9\/projects\/prj_test/);
    return new Response(JSON.stringify({ link: { productionBranch: "self" } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const { response, vercelResponse } = responsePair();
    await publishHandler({
      method: "POST",
      headers: {
        origin: process.env.APP_ORIGIN,
        cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
        "x-csrf-token": "csrf",
      },
      body: { slug: "handler-test", markdown: VALID_MARKDOWN, expectedSha: null, assets: [] },
    } as unknown as VercelRequest, vercelResponse);
    assert.equal(response.statusCode, 503);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("OAuth callback rejects an invalid state before token exchange", async () => {
  const { response, vercelResponse } = responsePair();
  await callbackHandler({
    method: "GET",
    headers: { cookie: "github_oauth_state=expected" },
    query: { code: "code", state: "wrong" },
  } as unknown as VercelRequest, vercelResponse);
  assert.equal(response.statusCode, 400);
});

test("session endpoint returns an unauthenticated no-store response", async () => {
  const { response, vercelResponse } = responsePair();
  await sessionHandler({ method: "GET", headers: {} } as VercelRequest, vercelResponse);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { authenticated: false });
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});
