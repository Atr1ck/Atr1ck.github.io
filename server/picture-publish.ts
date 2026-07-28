import { getRepository, githubRequest } from "./github.js";
import type { GitHubRepository } from "./github.js";
import { HttpError } from "./http.js";
import { parsePictureManifest } from "./picture-store.js";
import type { PictureManifest, PictureMetadata } from "./picture-store.js";
import type { GitHubRequester } from "./article-publish.js";
import {
  MAX_PUBLISH_ASSET_BYTES,
  MAX_PUBLISH_REQUEST_BYTES,
  MAX_TOTAL_ASSET_BYTES,
} from "../shared/publish-limits.js";

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PUBLIC_ASSET_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9][a-z0-9._-]{0,119}\.(?:avif|gif|jpe?g|png|webp)$/;
const LEGACY_PUBLIC_ASSET_PATTERN = /^[^/\\]+(?:\/[^/\\]+)*\.(?:avif|gif|jpe?g|png|webp)$/i;

interface PictureAsset {
  path: string;
  contentBase64: string;
  preserveOriginal?: boolean;
}

export interface PicturePublishRequest {
  picture: PictureMetadata;
  expectedManifestSha: string;
  isNew: boolean;
  assets: PictureAsset[];
}

interface GitRef { object: { sha: string } }
interface GitCommit { tree: { sha: string } }
interface GitBlob { sha: string }
interface GitTree { sha: string }
interface RepositoryFile { sha: string; content: string; encoding: string }

export interface PicturePublishDependencies {
  request: GitHubRequester;
  repository: GitHubRepository;
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validatePicturePublishRequest(value: unknown, categorySlugs: ReadonlySet<string>): PicturePublishRequest {
  if (!value || typeof value !== "object") throw new HttpError(400, "Invalid request body");
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > MAX_PUBLISH_REQUEST_BYTES) throw new HttpError(413, "Publish request must not exceed 4MB");
  const body = value as Partial<PicturePublishRequest>;
  if (!body.picture || typeof body.picture !== "object") throw new HttpError(400, "Picture metadata is required");
  const raw = body.picture as Partial<PictureMetadata>;
  const picture: PictureMetadata = {
    id: typeof raw.id === "string" ? raw.id.trim() : "",
    title: typeof raw.title === "string" ? raw.title.trim() : "",
    file: typeof raw.file === "string" ? raw.file.trim() : "",
    preview: typeof raw.preview === "string" ? raw.preview.trim() : "",
    category: typeof raw.category === "string" ? raw.category.trim() : "",
    tags: Array.isArray(raw.tags) ? [...new Set(raw.tags.map(String).map((tag) => tag.trim()).filter(Boolean))] : [],
    date: typeof raw.date === "string" ? raw.date : "",
    published: raw.published === true,
  };
  if (!ID_PATTERN.test(picture.id) || !picture.title) throw new HttpError(400, "Picture id and title are required");
  const assets = Array.isArray(body.assets) ? body.assets : [];
  const mayKeepLegacyPaths = body.isNew === false && assets.length === 0;
  const validAssetPath = (assetPath: string) => (
    PUBLIC_ASSET_PATTERN.test(assetPath)
    || (mayKeepLegacyPaths && LEGACY_PUBLIC_ASSET_PATTERN.test(assetPath) && !assetPath.includes(".."))
  );
  if (!validAssetPath(picture.file) || !validAssetPath(picture.preview)) throw new HttpError(400, "Picture asset paths are invalid");
  if (!mayKeepLegacyPaths && (!picture.file.startsWith(`${picture.id}/`) || !picture.preview.startsWith(`${picture.id}/`))) {
    throw new HttpError(400, "Picture assets must use their id directory");
  }
  if (!categorySlugs.has(picture.category)) throw new HttpError(400, "Picture category is invalid");
  if (!Array.isArray(raw.tags) || !validDate(picture.date) || typeof raw.published !== "boolean") throw new HttpError(400, "Picture classification is invalid");
  if (!SHA_PATTERN.test(body.expectedManifestSha || "")) throw new HttpError(400, "expectedManifestSha must be a 40-character Git SHA");
  if (typeof body.isNew !== "boolean") throw new HttpError(400, "isNew must be true or false");

  const paths = new Set<string>();
  let totalBytes = 0;
  const normalizedAssets = assets.map((asset, index) => {
    if (!asset || typeof asset !== "object" || typeof asset.path !== "string" || !asset.path.startsWith(`public/pictures/${picture.id}/`)) {
      throw new HttpError(400, `Asset ${index + 1} path is invalid`);
    }
    const publicPath = asset.path.slice("public/pictures/".length);
    if (!PUBLIC_ASSET_PATTERN.test(publicPath) || paths.has(asset.path)) throw new HttpError(400, `Asset ${index + 1} path is invalid or duplicated`);
    if (typeof asset.contentBase64 !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(asset.contentBase64)) throw new HttpError(400, `Asset ${index + 1} is not valid base64`);
    const bytes = Buffer.byteLength(asset.contentBase64, "base64");
    if (bytes === 0 || bytes > MAX_PUBLISH_ASSET_BYTES) throw new HttpError(400, `Asset ${index + 1} must be between 1 byte and 2.75MB`);
    paths.add(asset.path);
    totalBytes += bytes;
    return { path: asset.path, contentBase64: asset.contentBase64, preserveOriginal: asset.preserveOriginal === true };
  });
  if (totalBytes > MAX_TOTAL_ASSET_BYTES) throw new HttpError(400, "Total asset size must not exceed 2.75MB");
  if (body.isNew && normalizedAssets.length === 0) throw new HttpError(400, "A new picture requires an image asset");
  if (normalizedAssets.length > 0) {
    const uploaded = new Set(normalizedAssets.map((asset) => asset.path.slice("public/pictures/".length)));
    if (!uploaded.has(picture.file) || !uploaded.has(picture.preview)) throw new HttpError(400, "Uploaded assets must include the picture file and preview");
  }
  return { picture, expectedManifestSha: body.expectedManifestSha!, isNew: body.isNew, assets: normalizedAssets };
}

export async function publishPicture(
  input: PicturePublishRequest,
  categorySlugs: ReadonlySet<string>,
  dependencies: PicturePublishDependencies = { request: githubRequest, repository: getRepository() },
) {
  const { owner, repo, branch } = dependencies.repository;
  const encodedBranch = encodeURIComponent(branch);
  const ref = await dependencies.request<GitRef>(`/repos/${owner}/${repo}/git/ref/heads/${encodedBranch}`);
  const baseCommitSha = ref.object.sha;
  const manifestFile = await dependencies.request<RepositoryFile>(`/repos/${owner}/${repo}/contents/content/pictures.json?ref=${encodeURIComponent(baseCommitSha)}`);
  if (manifestFile.sha !== input.expectedManifestSha) throw new HttpError(409, "Picture manifest changed in GitHub; reload before publishing");
  if (manifestFile.encoding !== "base64") throw new HttpError(502, "Unsupported picture manifest encoding");
  const manifest = parsePictureManifest(
    JSON.parse(Buffer.from(manifestFile.content.replace(/\s/g, ""), "base64").toString("utf8")) as PictureManifest,
    categorySlugs,
  );
  const existingIndex = manifest.pictures.findIndex((picture) => picture.id === input.picture.id);
  if (input.isNew && existingIndex >= 0) throw new HttpError(409, "Picture already exists; reload before editing");
  if (!input.isNew && existingIndex < 0) throw new HttpError(409, "Picture no longer exists; reload the list");
  if (!input.isNew && input.assets.length === 0) {
    const existing = manifest.pictures[existingIndex];
    if (input.picture.file !== existing.file || input.picture.preview !== existing.preview) {
      throw new HttpError(400, "Picture asset paths cannot change without uploading replacements");
    }
  }
  if (existingIndex >= 0) manifest.pictures[existingIndex] = input.picture;
  else manifest.pictures.push(input.picture);
  manifest.pictures.sort((first, second) => second.date.localeCompare(first.date) || first.id.localeCompare(second.id));

  const manifestContent = `${JSON.stringify(manifest, null, 2)}\n`;
  const files = [
    { path: "content/pictures.json", content: manifestContent, encoding: "utf-8" },
    ...input.assets.map((asset) => ({ path: asset.path, content: asset.contentBase64, encoding: "base64" })),
  ];
  const baseCommit = await dependencies.request<GitCommit>(`/repos/${owner}/${repo}/git/commits/${baseCommitSha}`);
  const blobs = await Promise.all(files.map((file) => dependencies.request<GitBlob>(`/repos/${owner}/${repo}/git/blobs`, {
    method: "POST",
    body: JSON.stringify({ content: file.content, encoding: file.encoding }),
  })));
  const tree = await dependencies.request<GitTree>(`/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      base_tree: baseCommit.tree.sha,
      tree: files.map((file, index) => ({ path: file.path, mode: "100644", type: "blob", sha: blobs[index].sha })),
    }),
  });
  const commit = await dependencies.request<{ sha: string; html_url: string }>(`/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message: `media: publish ${input.picture.id}`, tree: tree.sha, parents: [baseCommitSha] }),
  });
  try {
    await dependencies.request(`/repos/${owner}/${repo}/git/refs/heads/${encodedBranch}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });
  } catch (error) {
    if (error instanceof HttpError) throw new HttpError(409, "The branch changed during picture publishing; retry from the latest version");
    throw error;
  }
  return {
    commitSha: commit.sha,
    commitUrl: commit.html_url,
    manifestSha: blobs[0].sha,
    pictureId: input.picture.id,
    status: "submitted" as const,
  };
}
