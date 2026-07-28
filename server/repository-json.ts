import { getRepository, githubRequest } from "./github.js";
import type { GitHubRepository } from "./github.js";
import type { GitHubRequester } from "./article-publish.js";
import { HttpError } from "./http.js";

interface RepositoryFile { content: string; encoding: string; sha: string; }
export interface RepositoryJsonDependencies { request: GitHubRequester; repository: GitHubRepository; }

export async function readRepositoryJson<T>(path: string, dependencies: RepositoryJsonDependencies = { request: githubRequest, repository: getRepository() }): Promise<{ value: T; sha: string }> {
  const { owner, repo, branch } = dependencies.repository;
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const file = await dependencies.request<RepositoryFile>(`/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`);
  if (file.encoding !== "base64") throw new HttpError(502, `Unsupported encoding for ${path}`);
  try {
    return { value: JSON.parse(Buffer.from(file.content.replace(/\s/g, ""), "base64").toString("utf8")) as T, sha: file.sha };
  } catch {
    throw new HttpError(502, `${path} contains invalid JSON`);
  }
}
