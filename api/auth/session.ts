import type { VercelRequest, VercelResponse } from "@vercel/node";
import { allowMethods, parseCookies } from "../../server/http.js";
import { readSessionToken, SESSION_COOKIE } from "../../server/session.js";

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!allowMethods(request, response, ["GET"])) return;

  const token = parseCookies(request)[SESSION_COOKIE];
  const session = token ? await readSessionToken(token) : null;
  response.setHeader("Cache-Control", "private, no-store");

  if (!session) {
    response.status(200).json({ authenticated: false });
    return;
  }

  response.status(200).json({
    authenticated: true,
    user: { login: session.login, avatarUrl: session.avatarUrl },
    csrfToken: session.csrfToken,
  });
}
