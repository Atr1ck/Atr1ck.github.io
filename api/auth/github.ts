import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAppOrigin, requireEnv } from "../../server/config.js";
import { allowMethods, sendError, serializeCookie } from "../../server/http.js";
import { createRandomToken, OAUTH_STATE_COOKIE } from "../../server/session.js";

export default function handler(request: VercelRequest, response: VercelResponse) {
  if (!allowMethods(request, response, ["GET"])) return;

  try {
    const state = createRandomToken();
    const callback = new URL("/api/auth/callback", getAppOrigin()).toString();
    const authorization = new URL("https://github.com/login/oauth/authorize");
    authorization.searchParams.set("client_id", requireEnv("GITHUB_OAUTH_CLIENT_ID"));
    authorization.searchParams.set("redirect_uri", callback);
    authorization.searchParams.set("scope", "read:user");
    authorization.searchParams.set("state", state);

    response.setHeader("Set-Cookie", serializeCookie(OAUTH_STATE_COOKIE, state, { maxAge: 600 }));
    response.redirect(302, authorization.toString());
  } catch (error) {
    sendError(response, error);
  }
}
