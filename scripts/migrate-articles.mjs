import { access, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import {
  ARTICLES_DIRECTORY,
  extractSummary,
  getGitUpdatedDate,
  normalizeDate,
  parseArticle,
  suggestSlug,
} from "./article-content.mjs";

const REPORT_DIRECTORY = path.resolve("migration");
const JSON_REPORT = path.join(REPORT_DIRECTORY, "articles-migration-draft.json");
const MARKDOWN_REPORT = path.join(REPORT_DIRECTORY, "articles-migration-report.md");

async function applyConfirmedMigration() {
  const draft = JSON.parse(await readFile(JSON_REPORT, "utf8"));
  const unconfirmed = draft.filter((article) => article.status !== "confirmed");

  if (unconfirmed.length > 0) {
    throw new Error(
      `Migration not applied: ${unconfirmed.length} article(s) still require confirmation:\n- ${unconfirmed.map((article) => article.file).join("\n- ")}`,
    );
  }

  for (const article of draft) {
    const legacyPath = path.resolve(article.file);
    const targetPath = path.join(ARTICLES_DIRECTORY, `${article.slug}.md`);
    const filePath = await access(legacyPath).then(() => legacyPath).catch(() => targetPath);
    const parsed = matter(await readFile(filePath, "utf8"));
    const migrated = matter.stringify(parsed.content.trimStart(), {
      title: article.title,
      slug: article.slug,
      date: article.date,
      updated: article.updated,
      tags: article.tags,
      summary: article.summary,
      cover: article.cover,
      published: article.published,
    });

    await writeFile(filePath, migrated, "utf8");
    if (filePath !== targetPath) await rename(filePath, targetPath);
  }

  console.log(`Applied confirmed migration to ${draft.length} articles.`);
}

async function createMigrationDraft() {
  const entries = await readdir(ARTICLES_DIRECTORY, { withFileTypes: true });
  const markdownFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.join(ARTICLES_DIRECTORY, entry.name))
    .sort((first, second) => first.localeCompare(second, "zh-CN"));

  const draft = [];
  const slugOwners = new Map();

  for (const filePath of markdownFiles) {
    const parsed = parseArticle(await readFile(filePath, "utf8"), filePath);
    const dateErrors = [];
    const date = normalizeDate(parsed.data.date, "date", parsed.fileName, dateErrors);
    const title = typeof parsed.data.title === "string"
      ? parsed.data.title.trim()
      : path.basename(parsed.fileName, ".md").replace(/^Hide/, "");
    const slug = typeof parsed.data.slug === "string" && parsed.data.slug.trim()
      ? parsed.data.slug.trim()
      : suggestSlug(title, date);
    const published = typeof parsed.data.published === "boolean"
      ? parsed.data.published
      : !parsed.fileName.startsWith("Hide");
    const summary = typeof parsed.data.summary === "string" && parsed.data.summary.trim()
      ? parsed.data.summary.trim()
      : extractSummary(parsed.content);
    const updated = parsed.data.updated
      ? normalizeDate(parsed.data.updated, "updated", parsed.fileName, dateErrors)
      : getGitUpdatedDate(filePath);

    const warnings = [...dateErrors];
    if (slugOwners.has(slug)) {
      warnings.push(`slug conflicts with ${slugOwners.get(slug)}`);
    } else {
      slugOwners.set(slug, parsed.fileName);
    }
    if (summary.endsWith("...")) warnings.push("summary was truncated and should be reviewed");
    if (parsed.fileName.startsWith("Hide")) warnings.push("converted Hide filename convention to published:false");

    draft.push({
      file: path.relative(process.cwd(), filePath),
      title,
      slug,
      date,
      updated,
      tags: Array.isArray(parsed.data.tags) ? parsed.data.tags.map(String) : [],
      summary,
      cover: typeof parsed.data.cover === "string" ? parsed.data.cover : null,
      published,
      status: "pending-confirmation",
      warnings,
    });
  }

  const markdown = [
    "# Article Migration Report",
    "",
    "This report is a proposal only. Source Markdown files were not modified.",
    "Set each entry to `confirmed` in the JSON draft after reviewing its slug, summary, dates, and visibility.",
    "",
    "| File | Proposed slug | Published | Summary | Warnings |",
    "| --- | --- | --- | --- | --- |",
    ...draft.map((article) =>
      `| ${article.file} | \`${article.slug}\` | ${article.published} | ${article.summary.replace(/\|/g, "\\|")} | ${article.warnings.join("; ") || "-"} |`,
    ),
    "",
  ].join("\n");

  await mkdir(REPORT_DIRECTORY, { recursive: true });
  await Promise.all([
    writeFile(JSON_REPORT, `${JSON.stringify(draft, null, 2)}\n`, "utf8"),
    writeFile(MARKDOWN_REPORT, markdown, "utf8"),
  ]);

  console.log(`Created migration draft for ${draft.length} articles.`);
  console.log(path.relative(process.cwd(), MARKDOWN_REPORT));
}

const command = process.argv.includes("--apply")
  ? applyConfirmedMigration
  : createMigrationDraft;

command().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
