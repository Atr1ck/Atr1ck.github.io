import type { VercelRequest, VercelResponse } from "@vercel/node";
import { listAdminArticles } from "../../server/article-store.js";
import { allowMethods, sendError } from "../../server/http.js";
import { requireSession } from "../../server/session.js";

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!allowMethods(request, response, ["GET"])) return;

  try {
    await requireSession(request);
    response.setHeader("Cache-Control", "private, no-store");
    response.status(200).json({ articles: await listAdminArticles() });
  } catch (error) {
    sendError(response, error);
  }
}
