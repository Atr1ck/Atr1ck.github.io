import { getRepository, githubRequest } from "./github.js";
import type { GitHubRepository } from "./github.js";
import { HttpError } from "./http.js";
import { parseCategoryConfig } from "./category-store.js";
import type { CategoryConfig } from "./category-store.js";
import type { GitHubRequester } from "./article-publish.js";

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_CATEGORIES_PER_GROUP = 100;

export interface CategoryCreateRequest {
  group: "articles" | "pictures";
  category: { slug: string; name: string };
  expectedSha: string;
}

export interface CategoryPublishDependencies {
  request: GitHubRequester;
  repository: GitHubRepository;
}

interface GitRef { object: { sha: string } }
interface GitCommit { tree: { sha: string } }
interface RepositoryFile { sha: string; content: string; encoding: string }

export function validateCategoryCreateRequest(value: unknown): CategoryCreateRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "Invalid request body");
  const body = value as Partial<CategoryCreateRequest>;
  if (body.group !== "articles" && body.group !== "pictures") throw new HttpError(400, "Category group is invalid");
  if (!body.category || typeof body.category !== "object") throw new HttpError(400, "Category is required");
  const slug = typeof body.category.slug === "string" ? body.category.slug.trim() : "";
  const name = typeof body.category.name === "string" ? body.category.name.trim() : "";
  if (!SLUG_PATTERN.test(slug) || slug.length > 64 || slug === "uncategorized") {
    throw new HttpError(400, "Category slug is invalid or reserved");
  }
  if (!name || name.length > 40) throw new HttpError(400, "Category name must be between 1 and 40 characters");
  if (!SHA_PATTERN.test(body.expectedSha || "")) throw new HttpError(400, "expectedSha must be a 40-character Git SHA");
  return { group: body.group, category: { slug, name }, expectedSha: body.expectedSha! };
}

function appendCategory(categories: CategoryConfig, input: CategoryCreateRequest): CategoryConfig {
  const group = categories[input.group];
  if (group.length >= MAX_CATEGORIES_PER_GROUP) throw new HttpError(400, "Category limit reached");
  if (group.some((category) => category.slug === input.category.slug)) throw new HttpError(409, "Category slug already exists");
  if (group.some((category) => category.name === input.category.name)) throw new HttpError(409, "Category name already exists");
  const normalOrders = group.filter((category) => category.slug !== "uncategorized").map((category) => category.order);
  const nextOrder = Math.max(0, ...normalOrders) + 10;
  if (nextOrder >= 999) throw new HttpError(400, "Category order space is exhausted");
  const nextGroup = [...group, { ...input.category, order: nextOrder }]
    .sort((first, second) => first.order - second.order || first.slug.localeCompare(second.slug));
  return { ...categories, [input.group]: nextGroup };
}

export async function createCategory(
  input: CategoryCreateRequest,
  dependencies: CategoryPublishDependencies = { request: githubRequest, repository: getRepository() },
) {
  const { owner, repo, branch } = dependencies.repository;
  const encodedBranch = encodeURIComponent(branch);
  const ref = await dependencies.request<GitRef>(`/repos/${owner}/${repo}/git/ref/heads/${encodedBranch}`);
  const baseCommitSha = ref.object.sha;
  const file = await dependencies.request<RepositoryFile>(`/repos/${owner}/${repo}/contents/content/categories.json?ref=${encodeURIComponent(baseCommitSha)}`);
  if (file.sha !== input.expectedSha) throw new HttpError(409, "Categories changed in GitHub; reload before creating a category");
  if (file.encoding !== "base64") throw new HttpError(502, "Unsupported category config encoding");
  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.from(file.content.replace(/\s/g, ""), "base64").toString("utf8"));
  } catch {
    throw new HttpError(502, "Category config contains invalid JSON");
  }
  const categories = appendCategory(parseCategoryConfig(raw), input);
  const content = `${JSON.stringify(categories, null, 2)}\n`;
  const baseCommit = await dependencies.request<GitCommit>(`/repos/${owner}/${repo}/git/commits/${baseCommitSha}`);
  const blob = await dependencies.request<{ sha: string }>(`/repos/${owner}/${repo}/git/blobs`, {
    method: "POST",
    body: JSON.stringify({ content, encoding: "utf-8" }),
  });
  const tree = await dependencies.request<{ sha: string }>(`/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      base_tree: baseCommit.tree.sha,
      tree: [{ path: "content/categories.json", mode: "100644", type: "blob", sha: blob.sha }],
    }),
  });
  const commit = await dependencies.request<{ sha: string; html_url: string }>(`/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message: `content: add ${input.group} category ${input.category.slug}`, tree: tree.sha, parents: [baseCommitSha] }),
  });
  try {
    await dependencies.request(`/repos/${owner}/${repo}/git/refs/heads/${encodedBranch}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });
  } catch (error) {
    if (error instanceof HttpError) throw new HttpError(409, "The branch changed while creating the category; retry from the latest version");
    throw error;
  }
  return { categories, categorySha: blob.sha, commitSha: commit.sha, commitUrl: commit.html_url, status: "submitted" as const };
}
