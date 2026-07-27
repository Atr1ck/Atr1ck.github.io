import { createAppAuth } from "@octokit/auth-app";
import { requireEnv } from "./config.js";
import { HttpError } from "./http.js";

interface GitHubErrorBody {
  message?: string;
  documentation_url?: string;
}

export interface GitHubRepository {
  owner: string;
  repo: string;
  branch: string;
}

export function getRepository(): GitHubRepository {
  return {
    owner: requireEnv("GITHUB_REPOSITORY_OWNER"),
    repo: requireEnv("GITHUB_REPOSITORY_NAME"),
    branch: process.env.GITHUB_BRANCH?.trim() || "main",
  };
}

async function getInstallationToken(): Promise<string> {
  const auth = createAppAuth({
    appId: requireEnv("GITHUB_APP_ID"),
    privateKey: requireEnv("GITHUB_APP_PRIVATE_KEY").replace(/\\n/g, "\n"),
    installationId: requireEnv("GITHUB_APP_INSTALLATION_ID"),
  });
  const authentication = await auth({ type: "installation" });
  return authentication.token;
}

export async function githubRequest<T>(
  route: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getInstallationToken();
  const response = await fetch(`https://api.github.com${route}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Atr1ck-blog-admin",
      ...init.headers,
    },
  });

  const body = response.status === 204
    ? null
    : await response.json().catch(() => null) as GitHubErrorBody | T | null;

  if (!response.ok) {
    const message = body && typeof body === "object" && "message" in body && body.message
      ? body.message
      : `GitHub API request failed (${response.status})`;
    throw new HttpError(response.status === 404 ? 404 : 502, message, body);
  }

  return body as T;
}
