import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const APPLY = process.argv.includes("--apply");
const ARTICLES_DIRECTORY = path.resolve("public/articles");
const PICTURES_DIRECTORY = path.resolve("public/pictures");
const LEGACY_PICTURES = path.resolve("public/json/pictures.json");
const MANIFEST_OUTPUT = path.resolve("content/pictures.json");
const DRAFT_OUTPUT = path.resolve("migration/categories-migration-draft.json");
const REPORT_OUTPUT = path.resolve("migration/categories-migration-report.md");

const ARTICLE_CATEGORIES = new Map([
  ["blog-building-log", "updates"],
  ["dairy-20260727", "life"],
  ["group-chat-reflection", "reviews"],
  ["job-search-notes", "life"],
  ["optional-chaining-bundle-size", "tech"],
  ["personal-notes", "life"],
  ["seed-of-song-review", "reviews"],
  ["test", "uncategorized"],
]);

function slugPart(value) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54) || "picture";
}

function pictureId(file) {
  const stem = file.replace(/\.[^.]+$/, "");
  const digest = createHash("sha256").update(file).digest("hex").slice(0, 7);
  return `${slugPart(stem)}-${digest}`;
}

function categoryFor(tags) {
  if (tags.includes("origin")) return "original";
  if (tags.includes("pjsk")) return "project-sekai";
  if (tags.includes("vtuber")) return "vtuber";
  if (tags.includes("HSR")) return "games";
  return "uncategorized";
}

function tagsFor(tags, category) {
  const categoryTokens = {
    original: ["origin"],
    "project-sekai": ["pjsk"],
    vtuber: ["vtuber"],
    games: [],
    uncategorized: [],
  }[category];
  return tags.filter((tag) => !categoryTokens.includes(tag));
}

function addedDate(file) {
  try {
    const value = execFileSync(
      "git",
      ["log", "--diff-filter=A", "-1", "--format=%cs", "--", path.join("public/pictures", file)],
      { encoding: "utf8" },
    ).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  } catch {
    // A deterministic fallback keeps the migration reviewable for untracked files.
  }
  return "2024-01-01";
}

function dateValue(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return value;
}

const articleEntries = await readdir(ARTICLES_DIRECTORY, { withFileTypes: true });
const articles = [];
for (const entry of articleEntries.filter((item) => item.isFile() && item.name.endsWith(".md"))) {
  const filePath = path.join(ARTICLES_DIRECTORY, entry.name);
  const source = await readFile(filePath, "utf8");
  const parsed = matter(source);
  const slug = typeof parsed.data.slug === "string" ? parsed.data.slug : "";
  articles.push({
    file: path.relative(process.cwd(), filePath),
    slug,
    title: typeof parsed.data.title === "string" ? parsed.data.title : entry.name,
    category: ARTICLE_CATEGORIES.get(slug) || "uncategorized",
  });
}
articles.sort((first, second) => first.slug.localeCompare(second.slug));

const legacyPictures = JSON.parse(await readFile(LEGACY_PICTURES, "utf8"));
const pictures = Object.entries(legacyPictures).map(([file, rawTags]) => {
  const tags = Array.isArray(rawTags) ? rawTags.map(String) : [];
  const category = categoryFor(tags);
  const preview = file.replace(/\.[^.]+$/, ".webp");
  return {
    id: pictureId(file),
    title: file.replace(/\.[^.]+$/, ""),
    file,
    preview,
    category,
    tags: tagsFor(tags, category),
    date: addedDate(file),
    published: true,
  };
}).sort((first, second) => second.date.localeCompare(first.date) || first.id.localeCompare(second.id));

const draft = {
  generatedAt: new Date().toISOString(),
  status: APPLY ? "applied" : "draft",
  articles,
  pictures,
};
await mkdir(path.dirname(DRAFT_OUTPUT), { recursive: true });
await writeFile(DRAFT_OUTPUT, `${JSON.stringify(draft, null, 2)}\n`, "utf8");

const articleRows = articles.map((item) => `| \`${item.slug}\` | ${item.title} | \`${item.category}\` |`).join("\n");
const pictureCounts = Object.entries(Object.groupBy(pictures, (picture) => picture.category))
  .sort(([first], [second]) => first.localeCompare(second))
  .map(([category, items]) => `| \`${category}\` | ${items.length} |`)
  .join("\n");
const report = `# 文章与照片分类迁移报告

- 状态：${APPLY ? "已应用" : "草案"}
- 文章：${articles.length} 篇
- 照片：${pictures.length} 张
- 原始图片 URL：全部保留

## 文章映射

| Slug | 标题 | 分类 |
| --- | --- | --- |
${articleRows}

## 照片分类统计

| 分类 | 数量 |
| --- | ---: |
${pictureCounts}

照片分类只在本次迁移中根据旧标签推断。迁移后以 \`content/pictures.json\` 为唯一元数据来源，文件名不再承担分类职责。
`;
await writeFile(REPORT_OUTPUT, report, "utf8");

if (APPLY) {
  for (const article of articles) {
    const filePath = path.resolve(article.file);
    const parsed = matter(await readFile(filePath, "utf8"));
    const { title, slug, date, updated, ...rest } = parsed.data;
    const data = {
      title,
      slug,
      category: article.category,
      date: dateValue(date),
      updated: dateValue(updated),
      ...rest,
    };
    await writeFile(filePath, matter.stringify(parsed.content.trimStart(), data), "utf8");
  }
  await mkdir(path.dirname(MANIFEST_OUTPUT), { recursive: true });
  await writeFile(MANIFEST_OUTPUT, `${JSON.stringify({ version: 1, pictures }, null, 2)}\n`, "utf8");
}

console.log(`${APPLY ? "Applied" : "Generated"} category migration for ${articles.length} articles and ${pictures.length} pictures.`);
