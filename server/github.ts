import { createAppAuth } from "@octokit/auth-app";
import { requireEnv } from "./config.js";
import { HttpError } from "./http.js";

interface GitHubErrorBody {
  message?: string;
  documentation_url?: string;
}

interface InstallationAuthentication {
  token: string;
  expiresAt: string;
  permissions: Record<string, string | undefined>;
}

let cachedInstallation: (InstallationAuthentication & { cacheKey: string }) | null = null;

export interface GitHubRepository {
  owner: string;
  repo: string;
  branch: string;
}

export function getRepository(): GitHubRepository {
  return {
    owner: requireEnv("GITHUB_REPOSITORY_OWNER"),
    repo: requireEnv("GITHUB_REPOSITORY_NAME"),
    branch: requireEnv("GITHUB_BRANCH"),
  };
}

export function assertInstallationPermissions(
  permissions: Record<string, string | undefined>,
): void {
  if (permissions.contents === "write") return;
  throw new HttpError(
    503,
    "GitHub App installation must grant Contents: Read and write",
    {
      code: "GITHUB_APP_CONTENTS_PERMISSION_REQUIRED",
      granted: permissions.contents || "none",
      hint: "Set Repository permissions > Contents to Read and write in the GitHub App, accept the updated permission for the installation, then redeploy Vercel.",
    },
  );
}

function authenticationError(error: unknown): HttpError {
  const status = error && typeof error === "object" && "status" in error
    ? Number(error.status)
    : 0;
  if (status === 404) {
    return new HttpError(503, "GitHub App installation was not found", {
      code: "GITHUB_APP_INSTALLATION_NOT_FOUND",
      hint: "Verify that GITHUB_APP_INSTALLATION_ID is the numeric ID from the installed GitHub App URL, not GITHUB_APP_ID.",
    });
  }
  if (status === 401 || status === 403) {
    return new HttpError(503, "GitHub App credentials were rejected", {
      code: "GITHUB_APP_CREDENTIALS_REJECTED",
      hint: "Verify GITHUB_APP_ID and the complete GITHUB_APP_PRIVATE_KEY in Vercel.",
    });
  }
  return new HttpError(502, "Unable to create a GitHub App installation token", {
    code: "GITHUB_APP_AUTHENTICATION_FAILED",
  });
}

async function getInstallationToken(): Promise<string> {
  const appId = requireEnv("GITHUB_APP_ID");
  const privateKey = requireEnv("GITHUB_APP_PRIVATE_KEY").replace(/\\n/g, "\n");
  const installationId = requireEnv("GITHUB_APP_INSTALLATION_ID");
  const cacheKey = `${appId}:${installationId}`;
  if (
    cachedInstallation?.cacheKey === cacheKey &&
    Date.parse(cachedInstallation.expiresAt) - Date.now() > 60_000
  ) {
    return cachedInstallation.token;
  }

  const auth = createAppAuth({
    appId,
    privateKey,
    installationId,
  });
  try {
    const authentication = await auth({ type: "installation" }) as InstallationAuthentication;
    assertInstallationPermissions(authentication.permissions);
    cachedInstallation = { ...authentication, cacheKey };
    return authentication.token;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw authenticationError(error);
  }
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
