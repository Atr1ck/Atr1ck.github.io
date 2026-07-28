import assert from "node:assert/strict";
import test from "node:test";
import { listAdminArticles, readAdminArticle } from "./article-store.js";
import type { ArticleStoreDependencies } from "./article-store.js";
import { HttpError } from "./http.js";

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

function dependencies(markdown = MARKDOWN): ArticleStoreDependencies {
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
        return { encoding: "base64", content: Buffer.from(markdown).toString("base64") } as T;
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

test("normalizes an omitted optional summary to an empty string", async () => {
  const markdown = MARKDOWN.replace("summary: Hidden article summary.\n", "");
  const article = await readAdminArticle("hidden-article", dependencies(markdown));

  assert.equal(article.summary, "");
  assert.equal(article.markdown, markdown);
});

function notFound(): HttpError {
  return new HttpError(404, "Not Found", { status: 404 });
}

test("reports when the GitHub App installation cannot access the configured repository", async () => {
  const restricted = dependencies();
  restricted.request = async <T>(route: string): Promise<T> => {
    if (route.includes("/contents/public/articles?")) throw notFound();
    if (route === "/repos/Atr1ck/Atr1ck.github.io") throw notFound();
    throw new Error(`Unexpected route: ${route}`);
  };

  await assert.rejects(
    () => listAdminArticles(restricted),
    (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.status, 503);
      assert.match(error.message, /installation cannot access Atr1ck\/Atr1ck\.github\.io/);
      assert.deepEqual(error.details, {
        code: "GITHUB_APP_REPOSITORY_ACCESS_DENIED",
        repository: "Atr1ck/Atr1ck.github.io",
        hint: "Install the GitHub App on this repository, then verify GITHUB_APP_INSTALLATION_ID, GITHUB_REPOSITORY_OWNER, and GITHUB_REPOSITORY_NAME in Vercel.",
      });
      return true;
    },
  );
});

test("reports when the configured GitHub branch does not exist", async () => {
  const wrongBranch = dependencies();
  wrongBranch.repository.branch = "missing";
  wrongBranch.request = async <T>(route: string): Promise<T> => {
    if (route.includes("/contents/public/articles?")) throw notFound();
    if (route === "/repos/Atr1ck/Atr1ck.github.io") return { full_name: "Atr1ck/Atr1ck.github.io" } as T;
    if (route === "/repos/Atr1ck/Atr1ck.github.io/branches/missing") throw notFound();
    throw new Error(`Unexpected route: ${route}`);
  };

  await assert.rejects(
    () => listAdminArticles(wrongBranch),
    (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.status, 503);
      assert.match(error.message, /branch missing was not found/);
      assert.equal((error.details as { code: string }).code, "GITHUB_BRANCH_NOT_FOUND");
      return true;
    },
  );
});

test("reports when the articles directory is missing from an accessible branch", async () => {
  const missingDirectory = dependencies();
  missingDirectory.request = async <T>(route: string): Promise<T> => {
    if (route.includes("/contents/public/articles?")) throw notFound();
    if (route === "/repos/Atr1ck/Atr1ck.github.io") return { full_name: "Atr1ck/Atr1ck.github.io" } as T;
    if (route === "/repos/Atr1ck/Atr1ck.github.io/branches/main") return { name: "main" } as T;
    throw new Error(`Unexpected route: ${route}`);
  };

  await assert.rejects(
    () => listAdminArticles(missingDirectory),
    (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.status, 502);
      assert.match(error.message, /directory public\/articles was not found/);
      assert.equal((error.details as { code: string }).code, "GITHUB_ARTICLES_DIRECTORY_NOT_FOUND");
      return true;
    },
  );
});
