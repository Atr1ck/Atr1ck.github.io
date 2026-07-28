import assert from "node:assert/strict";
import test from "node:test";
import { createCategory, validateCategoryCreateRequest } from "./category-publish.js";
import type { CategoryPublishDependencies } from "./category-publish.js";
import type { GitHubRequester } from "./article-publish.js";
import { HttpError } from "./http.js";

const categorySha = "e".repeat(40);
const categories = {
  version: 1 as const,
  articles: [
    { slug: "tech", name: "技术", order: 10 },
    { slug: "uncategorized", name: "未分类", order: 999 },
  ],
  pictures: [{ slug: "uncategorized", name: "未分类", order: 999 }],
};

function validRequest(overrides = {}) {
  return { group: "articles", category: { slug: "notes", name: "随笔" }, expectedSha: categorySha, ...overrides };
}

test("validates a category creation request", () => {
  assert.deepEqual(validateCategoryCreateRequest(validRequest()), validRequest());
  for (const category of [
    { slug: "Bad Slug", name: "坏分类" },
    { slug: "uncategorized", name: "保留分类" },
    { slug: "valid", name: "" },
  ]) {
    assert.throws(() => validateCategoryCreateRequest(validRequest({ category })), (error) => error instanceof HttpError && error.status === 400);
  }
});

function dependencies(fileSha = categorySha) {
  const calls: Array<{ route: string; init?: RequestInit }> = [];
  const base = "a".repeat(40);
  const request: GitHubRequester = async <T>(route: string, init?: RequestInit): Promise<T> => {
    calls.push({ route, init });
    if (route.endsWith("/git/ref/heads/main") && !init) return { object: { sha: base } } as T;
    if (route.includes("/contents/content/categories.json")) return { sha: fileSha, encoding: "base64", content: Buffer.from(JSON.stringify(categories)).toString("base64") } as T;
    if (route.endsWith(`/git/commits/${base}`)) return { tree: { sha: "b".repeat(40) } } as T;
    if (route.endsWith("/git/blobs")) return { sha: "1".repeat(40) } as T;
    if (route.endsWith("/git/trees")) return { sha: "c".repeat(40) } as T;
    if (route.endsWith("/git/commits")) return { sha: "d".repeat(40), html_url: "https://github.com/commit/category" } as T;
    if (route.endsWith("/git/refs/heads/main") && init?.method === "PATCH") return {} as T;
    throw new Error(`Unexpected route: ${route}`);
  };
  return { calls, dependencies: { request, repository: { owner: "Atr1ck", repo: "Atr1ck.github.io", branch: "main" } } satisfies CategoryPublishDependencies };
}

test("adds a category before uncategorized in one non-forced commit", async () => {
  const { calls, dependencies: deps } = dependencies();
  const result = await createCategory(validateCategoryCreateRequest(validRequest()), deps);
  assert.deepEqual(result.categories.articles.map((category) => category.slug), ["tech", "notes", "uncategorized"]);
  assert.equal(result.categories.articles[1].order, 20);
  assert.equal(result.categorySha, "1".repeat(40));
  const treeCall = calls.find((call) => call.route.endsWith("/git/trees"));
  const tree = JSON.parse(String(treeCall?.init?.body));
  assert.deepEqual(tree.tree.map((entry: { path: string }) => entry.path), ["content/categories.json"]);
  const refCall = calls.find((call) => call.route.endsWith("/git/refs/heads/main") && call.init?.method === "PATCH");
  assert.deepEqual(JSON.parse(String(refCall?.init?.body)), { sha: "d".repeat(40), force: false });
});

test("rejects stale SHA and duplicate categories before creating blobs", async () => {
  const stale = dependencies("f".repeat(40));
  await assert.rejects(() => createCategory(validateCategoryCreateRequest(validRequest()), stale.dependencies), (error) => error instanceof HttpError && error.status === 409);
  assert.equal(stale.calls.some((call) => call.route.endsWith("/git/blobs")), false);

  const duplicate = dependencies();
  await assert.rejects(() => createCategory(validateCategoryCreateRequest(validRequest({ category: { slug: "tech", name: "新技术" } })), duplicate.dependencies), (error) => error instanceof HttpError && error.status === 409);
  assert.equal(duplicate.calls.some((call) => call.route.endsWith("/git/blobs")), false);
});
