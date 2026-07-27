import type { VercelRequest, VercelResponse } from "@vercel/node";
import { allowMethods, assertSameOrigin, sendError } from "../../server/http.js";
import { assertCsrf, requireSession } from "../../server/session.js";
import { redeploy } from "../../server/vercel.js";

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!allowMethods(request, response, ["POST"])) return;
  try {
    assertSameOrigin(request);
    const session = await requireSession(request);
    assertCsrf(request, session);
    const deploymentId = request.body && typeof request.body.deploymentId === "string"
      ? request.body.deploymentId
      : "";
    response.status(202).json(await redeploy(deploymentId));
  } catch (error) {
    sendError(response, error);
  }
}
