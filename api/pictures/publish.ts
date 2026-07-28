import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getRepositoryCategories } from "../../server/category-store.js";
import { getRepository } from "../../server/github.js";
import { allowMethods, assertSameOrigin, sendError } from "../../server/http.js";
import { publishPicture, validatePicturePublishRequest } from "../../server/picture-publish.js";
import { assertCsrf, requireSession } from "../../server/session.js";
import { assertProductionBranch } from "../../server/vercel.js";

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!allowMethods(request, response, ["POST"])) return;
  try {
    assertSameOrigin(request);
    const session = await requireSession(request);
    assertCsrf(request, session);
    await assertProductionBranch(getRepository().branch);
    const categories = await getRepositoryCategories();
    const categorySlugs = new Set(categories.pictures.map((category) => category.slug));
    const input = validatePicturePublishRequest(request.body, categorySlugs);
    response.status(202).json(await publishPicture(input, categorySlugs));
  } catch (error) {
    sendError(response, error);
  }
}
