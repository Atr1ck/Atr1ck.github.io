import assert from "node:assert/strict";
import test from "node:test";
import { countArticleCharacters, formatArticleWordCount } from "../shared/article-word-count";

test("counts readable Markdown characters and ignores whitespace", () => {
  assert.equal(countArticleCharacters("# 标题\n\nHello，世界！"), 11);
});

test("ignores Markdown syntax, image data, link targets, and code blocks", () => {
  const markdown = [
    "**正文** [链接](https://example.com) ![图片说明](/image.png)",
    "",
    "行内 `code` 保留",
    "",
    "```ts",
    "const ignored = true;",
    "```",
  ].join("\n");

  assert.equal(countArticleCharacters(markdown), 12);
});

test("ignores visible URL labels but keeps descriptive link labels", () => {
  assert.equal(countArticleCharacters("https://example.com [官网](https://example.com)"), 2);
});

test("counts visible HTML text but excludes preformatted code and images", () => {
  assert.equal(countArticleCharacters("<div>HTML <strong>正文</strong><pre>code</pre><img alt=\"说明\"></div>"), 6);
});

test("formats the stable empty state and thousands separators", () => {
  assert.equal(formatArticleWordCount(0), "0 字");
  assert.equal(formatArticleWordCount(1234), "1,234 字");
});
