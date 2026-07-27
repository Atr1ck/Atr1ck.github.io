import assert from "node:assert/strict";
import test from "node:test";
import {
  extractSummary,
  normalizeDate,
  parseArticle,
  suggestSlug,
  validateArticle,
} from "./article-content.mjs";

test("normalizes single-digit month and day without timezone drift", () => {
  const errors = [];
  assert.equal(normalizeDate("2024-12-9", "date", "post.md", errors), "2024-12-09");
  assert.deepEqual(errors, []);
});
test("rejects invalid calendar dates", () => {
  const errors = [];
  assert.equal(normalizeDate("2025-02-30", "date", "post.md", errors), "");
  assert.deepEqual(errors, ["post.md: date must be a valid calendar date"]);
});

test("extracts a plain-text summary from Markdown", () => {
  const markdown = "# Heading\n\nA **short** paragraph with [a link](https://example.com).\n\n```js\nignored();\n```";
  assert.equal(extractSummary(markdown), "Heading A short paragraph with a link.");
});

test("returns reviewed stable slugs for existing articles", () => {
  assert.equal(suggestSlug("关于消除可选链", "2025-12-20"), "optional-chaining-bundle-size");
});

test("validates the complete article contract", () => {
  const source = `---
title: Example
slug: example-post
date: 2026-07-27
updated: 2026-07-27
tags:
  - React
summary: Example summary.
published: true
---

# Example

Body.`;
  const parsed = parseArticle(source, "/tmp/example.md");
  const result = validateArticle(parsed);

  assert.deepEqual(result.errors, []);
  assert.equal(result.value.slug, "example-post");
  assert.equal(result.value.published, true);
});

test("rejects unsafe slugs and cover paths", () => {
  const source = `---
title: Example
slug: Example Post
date: 2026-07-27
updated: 2026-07-27
tags: []
summary: Example summary.
cover: /images/cover.png
published: true
---

Body.`;
  const result = validateArticle(parseArticle(source, "/tmp/example.md"));

  assert.ok(result.errors.some((error) => error.includes("slug must contain")));
  assert.ok(result.errors.some((error) => error.includes("cover must be stored")));
});
