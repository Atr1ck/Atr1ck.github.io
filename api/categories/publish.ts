import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createCategory, validateCategoryCreateRequest } from "../../server/category-publish.js";
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
    const input = validateCategoryCreateRequest(request.body);
    response.status(202).json(await createCategory(input));
  } catch (error) {
    sendError(response, error);
  }
}
