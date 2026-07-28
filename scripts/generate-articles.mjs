import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ALIASES_OUTPUT,
  ARTICLES_DIRECTORY,
  ARTICLES_OUTPUT,
  parseArticle,
  validateArticle,
} from "./article-content.mjs";
import { loadCategories } from "./category-content.mjs";

async function generateArticles() {
  const categories = await loadCategories();
  const articleCategorySlugs = new Set(categories.articles.map((category) => category.slug));
  const entries = await readdir(ARTICLES_DIRECTORY, { withFileTypes: true });
  const markdownFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.join(ARTICLES_DIRECTORY, entry.name))
    .sort((first, second) => first.localeCompare(second, "zh-CN"));

  const errors = [];
  const articles = {};
  const aliases = {};

  for (const filePath of markdownFiles) {
    const source = await readFile(filePath, "utf8");
    const parsed = parseArticle(source, filePath);
    const result = validateArticle(parsed, articleCategorySlugs);
    errors.push(...result.errors);

    const article = result.value;
    if (!article.slug || result.errors.length > 0) continue;
    if (articles[article.slug]) {
      errors.push(`${parsed.fileName}: duplicate slug "${article.slug}"`);
      continue;
    }

    if (!article.published) continue;

    articles[article.slug] = article;
    for (const legacyTitle of article.legacyTitles) {
      if (aliases[legacyTitle] && aliases[legacyTitle] !== article.slug) {
        errors.push(`${parsed.fileName}: duplicate legacy title "${legacyTitle}"`);
      } else {
        aliases[legacyTitle] = article.slug;
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Article validation failed:\n- ${errors.join("\n- ")}`);
  }

  const sortedArticles = Object.fromEntries(
    Object.entries(articles).sort(([, first], [, second]) =>
      second.date.localeCompare(first.date) || first.title.localeCompare(second.title, "zh-CN"),
    ),
  );

  await mkdir(path.dirname(ARTICLES_OUTPUT), { recursive: true });
  await Promise.all([
    writeFile(ARTICLES_OUTPUT, `${JSON.stringify(sortedArticles, null, 2)}\n`, "utf8"),
    writeFile(ALIASES_OUTPUT, `${JSON.stringify(aliases, null, 2)}\n`, "utf8"),
  ]);

  console.log(`Generated ${Object.keys(sortedArticles).length} published articles.`);
}

generateArticles().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
