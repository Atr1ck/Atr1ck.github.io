import type { VercelRequest, VercelResponse } from "@vercel/node";
import { allowMethods, assertSameOrigin, clearCookie, sendError } from "../../server/http.js";
import { assertCsrf, requireSession, SESSION_COOKIE } from "../../server/session.js";

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!allowMethods(request, response, ["POST"])) return;

  try {
    assertSameOrigin(request);
    const session = await requireSession(request);
    assertCsrf(request, session);
    response.setHeader("Set-Cookie", clearCookie(SESSION_COOKIE));
    response.status(204).end();
  } catch (error) {
    sendError(response, error);
  }
}
