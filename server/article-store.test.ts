import assert from "node:assert/strict";
import test from "node:test";
import { listAdminArticles, readAdminArticle } from "./article-store.js";
import type { ArticleStoreDependencies } from "./article-store.js";

const MARKDOWN = `---
title: Hidden article
slug: hidden-article
date: 2026-07-26
updated: 2026-07-27
tags:
  - Notes
summary: Hidden article summary.
cover: null
published: false
---

# Hidden article

Draft body.`;

function dependencies(): ArticleStoreDependencies {
  return {
    repository: { owner: "Atr1ck", repo: "Atr1ck.github.io", branch: "main" },
    request: async <T>(route: string): Promise<T> => {
      if (route.includes("/contents/public/articles?")) {
        return [
          { name: "images", path: "public/articles/images", sha: "1".repeat(40), type: "dir" },
          { name: "hidden-article.md", path: "public/articles/hidden-article.md", sha: "a".repeat(40), type: "file" },
        ] as T;
      }
      if (route.includes("/contents/public/articles/hidden-article.md?")) {
        return { name: "hidden-article.md", path: "public/articles/hidden-article.md", sha: "a".repeat(40), type: "file" } as T;
      }
      if (route.endsWith(`/git/blobs/${"a".repeat(40)}`)) {
        return { encoding: "base64", content: Buffer.from(MARKDOWN).toString("base64") } as T;
      }
      if (route.includes("/commits?path=")) {
        return [{ sha: "b".repeat(40), html_url: "https://github.com/commit/test" }] as T;
      }
      throw new Error(`Unexpected route: ${route}`);
    },
  };
}

test("lists unpublished articles with their GitHub SHA", async () => {
  const articles = await listAdminArticles(dependencies());
  assert.equal(articles.length, 1);
  assert.equal(articles[0].published, false);
  assert.equal(articles[0].sha, "a".repeat(40));
  assert.equal(articles[0].lastCommitSha, "b".repeat(40));
  assert.equal("markdown" in articles[0], false);
});

test("reads a slug article and returns editable Markdown", async () => {
  const article = await readAdminArticle("hidden-article", dependencies());
  assert.equal(article.slug, "hidden-article");
  assert.equal(article.markdown, MARKDOWN);
});
