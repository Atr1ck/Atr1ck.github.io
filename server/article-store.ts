import matter from "gray-matter";
import { getRepository, githubRequest } from "./github.js";
import type { GitHubRepository } from "./github.js";
import { HttpError } from "./http.js";
import type { GitHubRequester } from "./article-publish.js";

interface RepositoryEntry {
  name: string;
  path: string;
  sha: string;
  type: "file" | "dir" | string;
}

interface GitBlob {
  content: string;
  encoding: string;
}

interface RepositoryCommit {
  sha: string;
  html_url: string;
}

export interface AdminArticleSummary {
  title: string;
  slug: string;
  date: string;
  updated: string;
  tags: string[];
  summary: string;
  cover: string | null;
  published: boolean;
  sha: string;
  path: string;
  lastCommitSha: string;
  lastCommitUrl: string;
}

export interface AdminArticle extends AdminArticleSummary {
  markdown: string;
}

export interface ArticleStoreDependencies {
  request: GitHubRequester;
  repository: GitHubRepository;
}

function defaultDependencies(): ArticleStoreDependencies {
  return { request: githubRequest, repository: getRepository() };
}

function normalizeDate(value: unknown, field: string, path: string): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  throw new HttpError(502, `${path} has invalid ${field} frontmatter`);
}

function parseAdminArticle(markdown: string, entry: RepositoryEntry): AdminArticle {
  const parsed = matter(markdown);
  const title = typeof parsed.data.title === "string" ? parsed.data.title.trim() : "";
  const slug = typeof parsed.data.slug === "string" ? parsed.data.slug.trim() : "";
  const summary = typeof parsed.data.summary === "string" ? parsed.data.summary.trim() : "";
  if (!title || !slug || !summary || typeof parsed.data.published !== "boolean") {
    throw new HttpError(502, `${entry.path} has incomplete frontmatter`);
  }

  return {
    title,
    slug,
    date: normalizeDate(parsed.data.date, "date", entry.path),
    updated: normalizeDate(parsed.data.updated, "updated", entry.path),
    tags: Array.isArray(parsed.data.tags) ? parsed.data.tags.map(String) : [],
    summary,
    cover: typeof parsed.data.cover === "string" && parsed.data.cover ? parsed.data.cover : null,
    published: parsed.data.published,
    sha: entry.sha,
    path: entry.path,
    lastCommitSha: "",
    lastCommitUrl: "",
    markdown,
  };
}

async function readBlob(entry: RepositoryEntry, dependencies: ArticleStoreDependencies): Promise<string> {
  const { owner, repo } = dependencies.repository;
  const blob = await dependencies.request<GitBlob>(
    `/repos/${owner}/${repo}/git/blobs/${entry.sha}`,
  );
  if (blob.encoding !== "base64") throw new HttpError(502, `Unsupported encoding for ${entry.path}`);
  return Buffer.from(blob.content.replace(/\s/g, ""), "base64").toString("utf8");
}

export async function listAdminArticles(
  dependencies: ArticleStoreDependencies = defaultDependencies(),
): Promise<AdminArticleSummary[]> {
  const { owner, repo, branch } = dependencies.repository;
  const entries = await dependencies.request<RepositoryEntry[]>(
    `/repos/${owner}/${repo}/contents/public/articles?ref=${encodeURIComponent(branch)}`,
  );
  const markdownEntries = entries.filter((entry) => entry.type === "file" && entry.name.endsWith(".md"));
  const articles = await Promise.all(markdownEntries.map(async (entry) => {
    const article = parseAdminArticle(
      await readBlob(entry, dependencies),
      entry,
    );
    const commits = await dependencies.request<RepositoryCommit[]>(
      `/repos/${owner}/${repo}/commits?path=${encodeURIComponent(entry.path)}&sha=${encodeURIComponent(branch)}&per_page=1`,
    );
    const lastCommit = commits[0];
    return {
      title: article.title,
      slug: article.slug,
      date: article.date,
      updated: article.updated,
      tags: article.tags,
      summary: article.summary,
      cover: article.cover,
      published: article.published,
      sha: article.sha,
      path: article.path,
      lastCommitSha: lastCommit?.sha || "",
      lastCommitUrl: lastCommit?.html_url || "",
    };
  }));

  return articles.sort((first, second) =>
    second.updated.localeCompare(first.updated) || first.title.localeCompare(second.title, "zh-CN"),
  );
}

export async function readAdminArticle(
  slug: string,
  dependencies: ArticleStoreDependencies = defaultDependencies(),
): Promise<AdminArticle> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new HttpError(400, "Invalid article slug");
  const { owner, repo, branch } = dependencies.repository;
  const path = `public/articles/${slug}.md`;
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const entry = await dependencies.request<RepositoryEntry>(
    `/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
  );
  if (entry.type !== "file") throw new HttpError(404, "Article not found");
  const article = parseAdminArticle(await readBlob(entry, dependencies), entry);
  const commits = await dependencies.request<RepositoryCommit[]>(
    `/repos/${owner}/${repo}/commits?path=${encodeURIComponent(path)}&sha=${encodeURIComponent(branch)}&per_page=1`,
  );
  return {
    ...article,
    lastCommitSha: commits[0]?.sha || "",
    lastCommitUrl: commits[0]?.html_url || "",
  };
}
