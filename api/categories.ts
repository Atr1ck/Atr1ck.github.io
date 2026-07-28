import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createCategory, validateCategoryCreateRequest } from "../server/category-publish.js";
import { getRepositoryCategoryState } from "../server/category-store.js";
import { getRepository } from "../server/github.js";
import { allowMethods, assertSameOrigin, sendError } from "../server/http.js";
import { assertCsrf, requireSession } from "../server/session.js";
import { assertProductionBranch } from "../server/vercel.js";

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!allowMethods(request, response, ["GET", "POST"])) return;
  try {
    if (request.method === "POST") assertSameOrigin(request);
    const session = await requireSession(request);
    if (request.method === "POST") {
      assertCsrf(request, session);
      await assertProductionBranch(getRepository().branch);
      const input = validateCategoryCreateRequest(request.body);
      response.status(202).json(await createCategory(input));
      return;
    }
    response.setHeader("Cache-Control", "private, no-store");
    response.status(200).json(await getRepositoryCategoryState());
  } catch (error) {
    sendError(response, error);
  }
}
