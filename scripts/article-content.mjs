import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export const ARTICLES_DIRECTORY = path.resolve("public/articles");
export const ARTICLES_OUTPUT = path.resolve("public/json/articles.json");
export const ALIASES_OUTPUT = path.resolve("public/json/article-aliases.json");
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalizeTags(values) {
  const tags = values.map(String).map((value) => value.trim().split(/\s+/).map((word) => {
    if (!word || /[\u4e00-\u9fff]/.test(word) || (word.length > 1 && word === word.toUpperCase())) return word;
    return `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}`;
  }).join(" ")).filter(Boolean);
  return tags.filter((tag, index) => tags.findIndex((item) => item.toLocaleLowerCase("zh-CN") === tag.toLocaleLowerCase("zh-CN")) === index);
}

export function parseArticle(source, filePath) {
  const parsed = matter(source);
  return {
    filePath,
    fileName: path.basename(filePath),
    data: parsed.data,
    content: parsed.content.trim(),
  };
}

export function normalizeDate(value, field, fileName, errors) {
  if (!value) {
    errors.push(`${fileName}: ${field} must be a valid date`);
    return "";
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      errors.push(`${fileName}: ${field} must be a valid date`);
      return "";
    }
    return value.toISOString().slice(0, 10);
  }

  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) {
    errors.push(`${fileName}: ${field} must use YYYY-MM-DD format`);
    return "";
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    errors.push(`${fileName}: ${field} must be a valid calendar date`);
    return "";
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function validateArticle(article) {
  const { data, content, fileName } = article;
  const errors = [];
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const slug = typeof data.slug === "string" ? data.slug.trim() : "";
  const summary = typeof data.summary === "string" ? data.summary.trim() : "";
  const cover = typeof data.cover === "string" ? data.cover.trim() : "";
  const tags = Array.isArray(data.tags)
    ? normalizeTags(data.tags)
    : [];

  if (!title) errors.push(`${fileName}: title is required`);
  if (!slug) {
    errors.push(`${fileName}: slug is required`);
  } else if (!SLUG_PATTERN.test(slug)) {
    errors.push(`${fileName}: slug must contain only lowercase letters, numbers, and hyphens`);
  }
  if (typeof data.published !== "boolean") {
    errors.push(`${fileName}: published must be true or false`);
  }
  if (data.summary != null && typeof data.summary !== "string") {
    errors.push(`${fileName}: summary must be a string`);
  }
  if (summary.length > 240) errors.push(`${fileName}: summary must not exceed 240 characters`);
  if (!Array.isArray(data.tags)) errors.push(`${fileName}: tags must be an array`);
  if (!content) errors.push(`${fileName}: article content is empty`);
  if (cover && !cover.startsWith(`/articles/images/${slug}/`)) {
    errors.push(`${fileName}: cover must be stored under /articles/images/${slug}/`);
  }

  const date = normalizeDate(data.date, "date", fileName, errors);
  const updated = normalizeDate(data.updated, "updated", fileName, errors);

  return {
    errors,
    value: {
      title,
      slug,
      date,
      updated,
      tags,
      summary,
      cover: cover || null,
      published: data.published === true,
      content,
      legacyTitles: [title],
    },
  };
}

export function extractSummary(content, maxLength = 120) {
  const plainText = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*>+]\s+/gm, "")
    .replace(/[`*_~|]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (plainText.length <= maxLength) return plainText;
  return `${plainText.slice(0, maxLength).trimEnd()}...`;
}

export function suggestSlug(title, date) {
  const knownSlugs = new Map([
    ["个人Blog绝赞手搓中", "blog-building-log"],
    ["播种之谣短评", "seed-of-song-review"],
    ["关于消除可选链", "optional-chaining-bundle-size"],
    ["碎碎念", "job-search-notes"],
    ["群内小事一则", "group-chat-reflection"],
    ["自己的碎碎念", "personal-notes"],
  ]);
  if (knownSlugs.has(title)) return knownSlugs.get(title);

  const asciiSlug = title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (asciiSlug) return asciiSlug;

  const digest = createHash("sha256").update(title).digest("hex").slice(0, 8);
  return `post-${date || "undated"}-${digest}`;
}

export function getGitUpdatedDate(filePath) {
  try {
    const output = execFileSync(
      "git",
      ["log", "-1", "--format=%cs", "--", filePath],
      { encoding: "utf8" },
    ).trim();
    if (output) return output;
  } catch {
    // Fall through to the filesystem timestamp for untracked files.
  }

  return statSync(filePath).mtime.toISOString().slice(0, 10);
}
