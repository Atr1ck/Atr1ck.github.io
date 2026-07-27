import { getAdminLogins, requireEnv } from "./config.js";
import { HttpError } from "./http.js";
import { safeEqual } from "./session.js";

export interface GitHubUser {
  login: string;
  avatar_url: string;
}

export function assertOAuthCallback(code: string, state: string, expectedState: string): void {
  if (!code || !state || !expectedState || !safeEqual(state, expectedState)) {
    throw new HttpError(400, "Invalid OAuth callback");
  }
}

export async function authenticateGitHubCode(
  code: string,
  fetcher: typeof fetch = fetch,
): Promise<GitHubUser> {
  const tokenResponse = await fetcher("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: requireEnv("GITHUB_OAUTH_CLIENT_ID"),
      client_secret: requireEnv("GITHUB_OAUTH_CLIENT_SECRET"),
      code,
    }),
  });
  const tokenBody = await tokenResponse.json() as { access_token?: string; error_description?: string };
  if (!tokenResponse.ok || !tokenBody.access_token) {
    throw new HttpError(502, tokenBody.error_description || "GitHub OAuth token exchange failed");
  }

  const userResponse = await fetcher("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${tokenBody.access_token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Atr1ck-blog-admin",
    },
  });
  if (!userResponse.ok) throw new HttpError(502, "Unable to read GitHub user profile");
  const user = await userResponse.json() as GitHubUser;
  if (!user.login || !getAdminLogins().has(user.login.toLowerCase())) {
    throw new HttpError(403, "This GitHub account is not an administrator");
  }
  return user;
}
