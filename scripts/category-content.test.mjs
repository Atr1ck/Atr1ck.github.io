import assert from "node:assert/strict";
import test from "node:test";
import { validateCategories } from "./category-content.mjs";

test("validates and orders article and picture categories", () => {
  const result = validateCategories({
    version: 1,
    articles: [{ slug: "uncategorized", name: "未分类", order: 999 }, { slug: "tech", name: "技术", order: 10 }],
    pictures: [{ slug: "uncategorized", name: "未分类", order: 999 }],
  });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.value.articles.map((item) => item.slug), ["tech", "uncategorized"]);
});

test("rejects duplicate, unsafe, and incomplete categories", () => {
  const result = validateCategories({
    version: 1,
    articles: [{ slug: "Bad Slug", name: "", order: -1 }],
    pictures: [{ slug: "same", name: "A", order: 1 }, { slug: "same", name: "B", order: 2 }],
  });
  assert.ok(result.errors.some((error) => error.includes("slug is invalid")));
  assert.ok(result.errors.some((error) => error.includes("duplicate")));
  assert.ok(result.errors.filter((error) => error.includes("must include uncategorized")).length === 2);
});
