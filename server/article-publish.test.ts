import assert from "node:assert/strict";
import test from "node:test";
import {
  publishArticle,
  validatePublishRequest,
} from "./article-publish.js";
import type {
  GitHubRequester,
  PublishDependencies,
} from "./article-publish.js";
import { HttpError } from "./http.js";
import {
  MAX_MARKDOWN_BYTES,
  MAX_PUBLISH_ASSET_BYTES,
  MAX_PUBLISH_REQUEST_BYTES,
  MAX_TOTAL_ASSET_BYTES,
} from "../shared/publish-limits.js";

const VALID_MARKDOWN = `---
title: Example article
slug: example-article
date: 2026-07-27
updated: 2026-07-27
tags:
  - React
summary: A valid article summary.
published: true
---

# Example article

Body.`;

test("validates a complete publish request", () => {
  const result = validatePublishRequest({
    slug: "example-article",
    markdown: VALID_MARKDOWN,
    expectedSha: null,
    assets: [{
      path: "public/articles/images/example-article/cover.webp",
      contentBase64: Buffer.from("image-data").toString("base64"),
    }],
  });

  assert.equal(result.slug, "example-article");
  assert.equal(result.assets.length, 1);
});

test("accepts an omitted or empty optional summary", () => {
  const withoutSummary = VALID_MARKDOWN.replace("summary: A valid article summary.\n", "");
  const emptySummary = VALID_MARKDOWN.replace("summary: A valid article summary.", "summary: ''");

  for (const markdown of [withoutSummary, emptySummary]) {
    assert.doesNotThrow(() => validatePublishRequest({
      slug: "example-article",
      markdown,
      expectedSha: null,
      assets: [],
    }));
  }
});

test("rejects a non-string or oversized optional summary", () => {
  const invalidSummaries = [
    VALID_MARKDOWN.replace("summary: A valid article summary.", "summary: 123"),
    VALID_MARKDOWN.replace("summary: A valid article summary.", `summary: ${"x".repeat(241)}`),
  ];

  for (const markdown of invalidSummaries) {
    assert.throws(
      () => validatePublishRequest({
        slug: "example-article",
        markdown,
        expectedSha: null,
        assets: [],
      }),
      (error) => error instanceof HttpError && error.status === 400,
    );
  }
});

test("rejects mismatched slugs and unsafe asset paths", () => {
  assert.throws(
    () => validatePublishRequest({
      slug: "different-slug",
      markdown: VALID_MARKDOWN,
      expectedSha: null,
      assets: [],
    }),
    (error) => error instanceof HttpError && error.status === 400,
  );

  assert.throws(
    () => validatePublishRequest({
      slug: "example-article",
      markdown: VALID_MARKDOWN,
      expectedSha: null,
      assets: [{
        path: "public/articles/images/example-article/../secret.txt",
        contentBase64: Buffer.from("secret").toString("base64"),
      }],
    }),
    (error) => error instanceof HttpError && error.status === 400,
  );

  assert.throws(
    () => validatePublishRequest({
      slug: "example-article",
      markdown: VALID_MARKDOWN,
      expectedSha: null,
      assets: [{
        path: "public/articles/images/example-article/payload.html",
        contentBase64: Buffer.from("payload").toString("base64"),
      }],
    }),
    (error) => error instanceof HttpError && error.status === 400,
  );
});

test("accepts allowed HTML and rejects unsupported raw HTML", () => {
  assert.doesNotThrow(() => validatePublishRequest({
    slug: "example-article",
    markdown: VALID_MARKDOWN.replace("Body.", `<div class="note" style="color: crimson"><img src="https://example.com/image.webp" alt="Example" width="320" /></div>`),
    expectedSha: null,
    assets: [],
  }));

  assert.throws(
    () => validatePublishRequest({
      slug: "example-article",
      markdown: VALID_MARKDOWN.replace("Body.", "<script>alert(1)</script>"),
      expectedSha: null,
      assets: [],
    }),
    (error) => error instanceof HttpError && error.status === 400 && error.message.includes("<script>"),
  );

  assert.doesNotThrow(() => validatePublishRequest({
    slug: "example-article",
    markdown: VALID_MARKDOWN.replace("Body.", "<https://example.com>\n\n```html\n<div>code only</div>\n```"),
    expectedSha: null,
    assets: [],
  }));
});

test("creates blobs, one tree, one commit, and a non-forced ref update", async () => {
  const calls: Array<{ route: string; init?: RequestInit }> = [];
  const baseCommitSha = "a".repeat(40);
  let blobCount = 0;

  const request: GitHubRequester = async <T>(route: string, init?: RequestInit): Promise<T> => {
    calls.push({ route, init });
    if (route.endsWith("/git/ref/heads/main")) {
      return { object: { sha: baseCommitSha } } as T;
    }
    if (route.includes("/contents/")) throw new HttpError(404, "Not Found");
    if (route.endsWith(`/git/commits/${baseCommitSha}`)) {
      return { tree: { sha: "b".repeat(40) } } as T;
    }
    if (route.endsWith("/git/blobs")) {
      blobCount += 1;
      return { sha: String(blobCount).repeat(40) } as T;
    }
    if (route.endsWith("/git/trees")) return { sha: "c".repeat(40) } as T;
    if (route.endsWith("/git/commits")) {
      return {
        sha: "d".repeat(40),
        html_url: "https://github.com/Atr1ck/Atr1ck.github.io/commit/test",
      } as T;
    }
    if (route.endsWith("/git/refs/heads/main")) return {} as T;
    throw new Error(`Unexpected GitHub route: ${route}`);
  };
  const dependencies: PublishDependencies = {
    request,
    repository: { owner: "Atr1ck", repo: "Atr1ck.github.io", branch: "main" },
  };
  const input = validatePublishRequest({
    slug: "example-article",
    markdown: VALID_MARKDOWN,
    expectedSha: null,
    assets: [{
      path: "public/articles/images/example-article/cover.webp",
      contentBase64: Buffer.from("image-data").toString("base64"),
    }],
  });

  const result = await publishArticle(input, dependencies);
  assert.equal(result.status, "submitted");
  assert.equal(result.articleSha, "1".repeat(40));
  assert.equal(blobCount, 2);

  const treeCall = calls.find((call) => call.route.endsWith("/git/trees"));
  assert.ok(treeCall?.init?.body);
  const treeBody = JSON.parse(String(treeCall.init.body));
  assert.equal(treeBody.base_tree, "b".repeat(40));
  assert.equal(treeBody.tree.length, 2);

  const refCall = calls.find((call) => call.route.endsWith("/git/refs/heads/main"));
  assert.ok(refCall?.init?.body);
  assert.deepEqual(JSON.parse(String(refCall.init.body)), {
    sha: "d".repeat(40),
    force: false,
  });
});

test("rejects duplicate asset paths", () => {
  const asset = {
    path: "public/articles/images/example-article/cover.webp",
    contentBase64: Buffer.from("image-data").toString("base64"),
  };
  assert.throws(
    () => validatePublishRequest({
      slug: "example-article",
      markdown: VALID_MARKDOWN,
      expectedSha: null,
      assets: [asset, asset],
    }),
    (error) => error instanceof HttpError && error.status === 400,
  );
});

test("keeps the serialized publish request below the Vercel function limit", () => {
  assert.throws(
    () => validatePublishRequest({
      slug: "example-article",
      markdown: VALID_MARKDOWN,
      expectedSha: null,
      assets: [],
      padding: "x".repeat(MAX_PUBLISH_REQUEST_BYTES),
    }),
    (error) => error instanceof HttpError && error.status === 413 && error.message.includes("4MB"),
  );
});

test("rejects oversized Markdown and selected image payloads", () => {
  assert.throws(
    () => validatePublishRequest({
      slug: "example-article",
      markdown: VALID_MARKDOWN.replace("Body.", "x".repeat(MAX_MARKDOWN_BYTES)),
      expectedSha: null,
      assets: [],
    }),
    (error) => error instanceof HttpError && error.status === 400 && error.message.includes("256KB"),
  );

  assert.throws(
    () => validatePublishRequest({
      slug: "example-article",
      markdown: VALID_MARKDOWN,
      expectedSha: null,
      assets: [{
        path: "public/articles/images/example-article/large.webp",
        contentBase64: Buffer.alloc(MAX_PUBLISH_ASSET_BYTES + 1).toString("base64"),
      }],
    }),
    (error) => error instanceof HttpError && error.status === 400 && error.message.includes("2.75MB"),
  );
});

test("rejects an aggregate image payload above the production request budget", () => {
  const assetBytes = Math.floor(MAX_TOTAL_ASSET_BYTES / 2) + 1;
  assert.throws(
    () => validatePublishRequest({
      slug: "example-article",
      markdown: VALID_MARKDOWN,
      expectedSha: null,
      assets: [
        {
          path: "public/articles/images/example-article/first.webp",
          contentBase64: Buffer.alloc(assetBytes).toString("base64"),
        },
        {
          path: "public/articles/images/example-article/second.webp",
          contentBase64: Buffer.alloc(assetBytes).toString("base64"),
        },
      ],
    }),
    (error) => error instanceof HttpError && error.status === 400 && error.message.includes("Total asset size"),
  );
});

test("rejects stale article SHA before creating blobs", async () => {
  const request: GitHubRequester = async <T>(route: string): Promise<T> => {
    if (route.endsWith("/git/ref/heads/main")) {
      return { object: { sha: "a".repeat(40) } } as T;
    }
    if (route.includes("/contents/")) return { sha: "b".repeat(40) } as T;
    throw new Error(`Unexpected route after conflict: ${route}`);
  };
  const input = validatePublishRequest({
    slug: "example-article",
    markdown: VALID_MARKDOWN,
    expectedSha: "c".repeat(40),
    assets: [],
  });

  await assert.rejects(
    publishArticle(input, {
      request,
      repository: { owner: "Atr1ck", repo: "Atr1ck.github.io", branch: "main" },
    }),
    (error) => error instanceof HttpError && error.status === 409,
  );
});
