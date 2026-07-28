import type { VercelRequest, VercelResponse } from "@vercel/node";
import { publishArticle, validatePublishRequest } from "../../server/article-publish.js";
import { getRepository } from "../../server/github.js";
import { allowMethods, assertSameOrigin, sendError } from "../../server/http.js";
import { assertCsrf, requireSession } from "../../server/session.js";
import { assertProductionBranch } from "../../server/vercel.js";

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!allowMethods(request, response, ["POST"])) return;

  try {
    assertSameOrigin(request);
    const session = await requireSession(request);
    assertCsrf(request, session);
    await assertProductionBranch(getRepository().branch);
    const input = validatePublishRequest(request.body);
    const result = await publishArticle(input);
    response.status(202).json(result);
  } catch (error) {
    sendError(response, error);
  }
}
