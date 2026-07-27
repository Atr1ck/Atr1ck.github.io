import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAppOrigin } from "../../server/config.js";
import { clearCookie, parseCookies, sendError, serializeCookie } from "../../server/http.js";
import { assertOAuthCallback, authenticateGitHubCode } from "../../server/oauth.js";
import {
  createRandomToken,
  createSessionToken,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  SESSION_DURATION_SECONDS,
} from "../../server/session.js";

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const code = typeof request.query.code === "string" ? request.query.code : "";
    const state = typeof request.query.state === "string" ? request.query.state : "";
    const expectedState = parseCookies(request)[OAUTH_STATE_COOKIE] ?? "";
    assertOAuthCallback(code, state, expectedState);
    const user = await authenticateGitHubCode(code);

    const sessionToken = await createSessionToken({
      login: user.login,
      avatarUrl: user.avatar_url,
      csrfToken: createRandomToken(),
    });
    response.setHeader("Set-Cookie", [
      serializeCookie(SESSION_COOKIE, sessionToken, { maxAge: SESSION_DURATION_SECONDS }),
      clearCookie(OAUTH_STATE_COOKIE),
    ]);
    response.redirect(302, new URL("/admin", getAppOrigin()).toString());
  } catch (error) {
    sendError(response, error);
  }
}
