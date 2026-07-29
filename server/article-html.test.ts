import assert from "node:assert/strict";
import test from "node:test";
import type { Root } from "hast";
import rehypeSanitize from "rehype-sanitize";
import { unified } from "unified";
import { validateArticleHtml } from "../shared/article-html.js";
import { articleHtmlSchema, rehypeFilterUnsafeArticleStyles } from "../shared/article-html-schema.js";

test("accepts allowed article HTML, media, and inline CSS", () => {
  const errors = validateArticleHtml(`
<section class="note" style="color: crimson; text-align: center">
  <details open><summary>Details</summary><mark>Allowed</mark></details>
  <a href="https://example.com" target="_blank" rel="noreferrer">Link</a>
  <img src="/articles/images/example-article/cover.webp" alt="Cover" width="320" loading="lazy" />
  <video controls poster="https://example.com/poster.webp"><source src="https://example.com/video.mp4" type="video/mp4" /></video>
</section>`);

  assert.deepEqual(errors, []);
});

test("rejects executable and unsupported raw HTML", () => {
  const errors = validateArticleHtml(`<script>alert(1)</script><iframe src="https://example.com"></iframe><input type="text" /><div onclick="alert(1)">x</div>`);

  assert.deepEqual(errors, [
    "不允许使用 <script> 标签",
    "不允许使用 <iframe> 标签",
    "不允许使用 <input> 标签",
    "不允许使用 onclick 事件属性",
  ]);
});

test("rejects dangerous resource URLs and CSS resource URLs", () => {
  const errors = validateArticleHtml(`<img src="data:image/svg+xml,boom" /><a href="javascript:alert(1)">x</a><div style="background: url(blob:https://example.com/id)">x</div>`);

  assert.deepEqual(errors, [
    "src 只允许站内路径或 http/https 地址",
    "href 只允许站内路径或 http/https/mailto/tel 地址",
    "style 属性不能包含危险的脚本或资源地址",
  ]);
});

test("sanitizer preserves allowed styling and strips bypassed executable content", () => {
  const tree: Root = {
    type: "root",
    children: [{
      type: "element",
      tagName: "div",
      properties: { className: ["note"], style: "color: crimson", onClick: "alert(1)" },
      children: [
        { type: "element", tagName: "script", properties: {}, children: [{ type: "text", value: "alert(1)" }] },
        { type: "element", tagName: "img", properties: { src: "data:image/svg+xml,boom", alt: "Unsafe" }, children: [] },
        { type: "element", tagName: "span", properties: { style: "background: url(blob:https://example.com/id)" }, children: [] },
      ],
    }],
  };

  const sanitized = unified().use(rehypeFilterUnsafeArticleStyles).use(rehypeSanitize, articleHtmlSchema).runSync(tree) as Root;
  const div = sanitized.children[0];
  assert.equal(div.type, "element");
  assert.deepEqual(div.properties, { className: ["note"], style: "color: crimson" });
  assert.deepEqual(div.children, [
    { type: "element", tagName: "img", properties: { alt: "Unsafe" }, children: [] },
    { type: "element", tagName: "span", properties: {}, children: [] },
  ]);
});
