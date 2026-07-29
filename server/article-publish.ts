import matter from "gray-matter";
import { getRepository, githubRequest } from "./github.js";
import type { GitHubRepository } from "./github.js";
import { HttpError } from "./http.js";
import {
  MAX_MARKDOWN_BYTES,
  MAX_PUBLISH_ASSET_BYTES,
  MAX_PUBLISH_REQUEST_BYTES,
  MAX_TOTAL_ASSET_BYTES,
} from "../shared/publish-limits.js";
import { normalizeTagList } from "../shared/tags.js";
import { validateArticleHtml } from "../shared/article-html.js";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA_PATTERN = /^[a-f0-9]{40}$/;

export interface PublishAsset {
  path: string;
  contentBase64: string;
  preserveOriginal?: boolean;
}

export interface PublishRequest {
  slug: string;
  markdown: string;
  expectedSha: string | null;
  assets: PublishAsset[];
}

interface GitRef {
  object: { sha: string };
}

interface GitCommit {
  tree: { sha: string };
}

interface GitBlob {
  sha: string;
}

interface GitTree {
  sha: string;
}

interface RepositoryContent {
  sha: string;
}

export type GitHubRequester = <T>(route: string, init?: RequestInit) => Promise<T>;

export interface PublishDependencies {
  request: GitHubRequester;
  repository: GitHubRepository;
}

function isValidDateValue(value: unknown): boolean {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value !== "string") return false;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isSafeImageName(name: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{0,119}\.(?:avif|gif|jpe?g|png|webp)$/.test(name);
}

function isArticleImagePath(path: string, slug: string, repositoryPath: boolean): boolean {
  const prefix = repositoryPath
    ? `public/articles/images/${slug}/`
    : `/articles/images/${slug}/`;
  return path.startsWith(prefix) && isSafeImageName(path.slice(prefix.length));
}

export function validatePublishRequest(value: unknown): PublishRequest {
  if (!value || typeof value !== "object") throw new HttpError(400, "Invalid request body");
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > MAX_PUBLISH_REQUEST_BYTES) {
    throw new HttpError(413, "Publish request must not exceed 4MB");
  }
  const body = value as Partial<PublishRequest>;
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const markdown = typeof body.markdown === "string" ? body.markdown : "";
  const assets = Array.isArray(body.assets) ? body.assets : [];

  if (!SLUG_PATTERN.test(slug)) throw new HttpError(400, "Invalid article slug");
  if (!markdown || Buffer.byteLength(markdown, "utf8") > MAX_MARKDOWN_BYTES) {
    throw new HttpError(400, "Markdown must be between 1 byte and 256KB");
  }
  if (body.expectedSha !== null && !SHA_PATTERN.test(body.expectedSha ?? "")) {
    throw new HttpError(400, "expectedSha must be null or a 40-character Git SHA");
  }

  const parsed = matter(markdown);
  if (parsed.data.slug !== slug) throw new HttpError(400, "Frontmatter slug does not match request slug");
  if (typeof parsed.data.title !== "string" || !parsed.data.title.trim()) {
    throw new HttpError(400, "Frontmatter title is required");
  }
  if (typeof parsed.data.published !== "boolean") {
    throw new HttpError(400, "Frontmatter published must be true or false");
  }
  if (parsed.data.summary != null && typeof parsed.data.summary !== "string") {
    throw new HttpError(400, "Frontmatter summary must be a string");
  }
  if (typeof parsed.data.summary === "string" && parsed.data.summary.trim().length > 240) {
    throw new HttpError(400, "Frontmatter summary must not exceed 240 characters");
  }
  if (!Array.isArray(parsed.data.tags)) throw new HttpError(400, "Frontmatter tags must be an array");
  const rawTags = parsed.data.tags.map(String);
  if (JSON.stringify(rawTags) !== JSON.stringify(normalizeTagList(rawTags))) {
    throw new HttpError(400, "Frontmatter tags must use title case and contain no duplicates");
  }
  if (!parsed.content.trim()) throw new HttpError(400, "Article content is required");
  const htmlErrors = validateArticleHtml(parsed.content);
  if (htmlErrors.length > 0) throw new HttpError(400, `Invalid article HTML: ${htmlErrors.join("; ")}`);
  if (
    !isValidDateValue(parsed.data.date) ||
    !isValidDateValue(parsed.data.updated)
  ) {
    throw new HttpError(400, "Frontmatter date and updated are required");
  }
  if (
    parsed.data.cover &&
    (
      typeof parsed.data.cover !== "string" ||
      !isArticleImagePath(parsed.data.cover, slug, false)
    )
  ) {
    throw new HttpError(400, "Frontmatter cover must be stored in the article image directory");
  }

  let totalAssetBytes = 0;
  const assetPaths = new Set<string>();
  const normalizedAssets = assets.map((asset, index) => {
    if (!asset || typeof asset !== "object") throw new HttpError(400, `Asset ${index + 1} is invalid`);
    if (
      typeof asset.path !== "string" ||
      !isArticleImagePath(asset.path, slug, true)
    ) {
      throw new HttpError(400, `Asset ${index + 1} has an invalid path`);
    }
    if (typeof asset.contentBase64 !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(asset.contentBase64)) {
      throw new HttpError(400, `Asset ${index + 1} is not valid base64`);
    }
    if (assetPaths.has(asset.path)) throw new HttpError(400, `Asset ${index + 1} has a duplicate path`);
    assetPaths.add(asset.path);

    const bytes = Buffer.byteLength(asset.contentBase64, "base64");
    if (bytes === 0 || bytes > MAX_PUBLISH_ASSET_BYTES) {
      throw new HttpError(400, `Asset ${index + 1} must be between 1 byte and 2.75MB`);
    }
    totalAssetBytes += bytes;

    return {
      path: asset.path,
      contentBase64: asset.contentBase64,
      preserveOriginal: asset.preserveOriginal === true,
    };
  });

  if (totalAssetBytes > MAX_TOTAL_ASSET_BYTES) {
    throw new HttpError(400, "Total asset size must not exceed 2.75MB");
  }

  return {
    slug,
    markdown,
    expectedSha: body.expectedSha ?? null,
    assets: normalizedAssets,
  };
}

async function getCurrentContentSha(
  path: string,
  ref: string,
  dependencies: PublishDependencies,
): Promise<string | null> {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  try {
    const content = await dependencies.request<RepositoryContent>(
      `/repos/${dependencies.repository.owner}/${dependencies.repository.repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`,
    );
    return content.sha;
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  }
}

export async function publishArticle(
  input: PublishRequest,
  dependencies: PublishDependencies = {
    request: githubRequest,
    repository: getRepository(),
  },
) {
  const { repository, request } = dependencies;
  const articlePath = `public/articles/${input.slug}.md`;
  const encodedBranch = encodeURIComponent(repository.branch);
  const ref = await request<GitRef>(
    `/repos/${repository.owner}/${repository.repo}/git/ref/heads/${encodedBranch}`,
  );
  const baseCommitSha = ref.object.sha;
  const existingSha = await getCurrentContentSha(articlePath, baseCommitSha, dependencies);

  if (input.expectedSha === null && existingSha !== null) {
    throw new HttpError(409, "Article already exists; reload it before editing");
  }
  if (input.expectedSha !== null && existingSha !== input.expectedSha) {
    throw new HttpError(409, "Article changed in GitHub; reload before publishing");
  }

  const baseCommit = await request<GitCommit>(
    `/repos/${repository.owner}/${repository.repo}/git/commits/${baseCommitSha}`,
  );
  const files = [
    { path: articlePath, content: input.markdown, encoding: "utf-8" },
    ...input.assets.map((asset) => ({
      path: asset.path,
      content: asset.contentBase64,
      encoding: "base64",
    })),
  ];
  const blobs = await Promise.all(files.map((file) =>
    request<GitBlob>(`/repos/${repository.owner}/${repository.repo}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({ content: file.content, encoding: file.encoding }),
    }),
  ));
  const tree = await request<GitTree>(
    `/repos/${repository.owner}/${repository.repo}/git/trees`,
    {
      method: "POST",
      body: JSON.stringify({
        base_tree: baseCommit.tree.sha,
        tree: files.map((file, index) => ({
          path: file.path,
          mode: "100644",
          type: "blob",
          sha: blobs[index].sha,
        })),
      }),
    },
  );
  const commit = await request<{ sha: string; html_url: string }>(
    `/repos/${repository.owner}/${repository.repo}/git/commits`,
    {
      method: "POST",
      body: JSON.stringify({
        message: `content: publish ${input.slug}`,
        tree: tree.sha,
        parents: [baseCommitSha],
      }),
    },
  );

  try {
    await request(
      `/repos/${repository.owner}/${repository.repo}/git/refs/heads/${encodedBranch}`,
      {
        method: "PATCH",
        body: JSON.stringify({ sha: commit.sha, force: false }),
      },
    );
  } catch (error) {
    if (error instanceof HttpError) {
      throw new HttpError(409, "The branch changed during publishing; retry from the latest version");
    }
    throw error;
  }

  return {
    commitSha: commit.sha,
    commitUrl: commit.html_url,
    articleSha: blobs[0].sha,
    articlePath,
    status: "submitted" as const,
  };
}
