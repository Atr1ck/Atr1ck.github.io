import { getRepository, githubRequest } from "./github.js";
import type { GitHubRepository } from "./github.js";
import { HttpError } from "./http.js";
import type { GitHubRequester } from "./article-publish.js";

interface RepositoryFile {
  content: string;
  encoding: string;
  sha: string;
}

export interface CategoryDefinition {
  slug: string;
  name: string;
  order: number;
}

export interface CategoryConfig {
  version: 1;
  articles: CategoryDefinition[];
  pictures: CategoryDefinition[];
}

export interface CategoryStoreDependencies {
  request: GitHubRequester;
  repository: GitHubRepository;
}

function defaultDependencies(): CategoryStoreDependencies {
  return { request: githubRequest, repository: getRepository() };
}

function parseGroup(value: unknown, name: string): CategoryDefinition[] {
  if (!Array.isArray(value)) throw new HttpError(502, `${name} categories are invalid`);
  const slugs = new Set<string>();
  return value.map((item) => {
    if (!item || typeof item !== "object") throw new HttpError(502, `${name} category is invalid`);
    const record = item as Record<string, unknown>;
    const slug = typeof record.slug === "string" ? record.slug : "";
    const label = typeof record.name === "string" ? record.name.trim() : "";
    const order = Number(record.order);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !label || !Number.isInteger(order) || order < 0) {
      throw new HttpError(502, `${name} category ${slug || "entry"} is invalid`);
    }
    if (slugs.has(slug)) throw new HttpError(502, `${name} category ${slug} is duplicated`);
    slugs.add(slug);
    return { slug, name: label, order };
  }).sort((first, second) => first.order - second.order || first.slug.localeCompare(second.slug));
}

export function parseCategoryConfig(value: unknown): CategoryConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(502, "Category config is invalid");
  const record = value as Record<string, unknown>;
  if (record.version !== 1) throw new HttpError(502, "Category config version is invalid");
  const articles = parseGroup(record.articles, "article");
  const pictures = parseGroup(record.pictures, "picture");
  if (!articles.some((category) => category.slug === "uncategorized")) throw new HttpError(502, "Article categories must include uncategorized");
  if (!pictures.some((category) => category.slug === "uncategorized")) throw new HttpError(502, "Picture categories must include uncategorized");
  return { version: 1, articles, pictures };
}

export async function readRepositoryJson<T>(
  path: string,
  dependencies: CategoryStoreDependencies = defaultDependencies(),
): Promise<{ value: T; sha: string }> {
  const { owner, repo, branch } = dependencies.repository;
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const file = await dependencies.request<RepositoryFile>(
    `/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
  );
  if (file.encoding !== "base64") throw new HttpError(502, `Unsupported encoding for ${path}`);
  try {
    return {
      value: JSON.parse(Buffer.from(file.content.replace(/\s/g, ""), "base64").toString("utf8")) as T,
      sha: file.sha,
    };
  } catch {
    throw new HttpError(502, `${path} contains invalid JSON`);
  }
}

export async function getRepositoryCategories(
  dependencies: CategoryStoreDependencies = defaultDependencies(),
): Promise<CategoryConfig> {
  return (await getRepositoryCategoryState(dependencies)).categories;
}

export async function getRepositoryCategoryState(
  dependencies: CategoryStoreDependencies = defaultDependencies(),
): Promise<{ categories: CategoryConfig; sha: string }> {
  const { value, sha } = await readRepositoryJson<unknown>("content/categories.json", dependencies);
  return { categories: parseCategoryConfig(value), sha };
}
