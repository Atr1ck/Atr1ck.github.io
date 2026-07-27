import type { VercelRequest, VercelResponse } from "@vercel/node";
import { allowMethods, sendError } from "../../server/http.js";
import { requireSession } from "../../server/session.js";
import { getDeploymentForCommit } from "../../server/vercel.js";

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!allowMethods(request, response, ["GET"])) return;
  try {
    await requireSession(request);
    const commitSha = typeof request.query.commitSha === "string" ? request.query.commitSha : "";
    response.setHeader("Cache-Control", "private, no-store");
    response.status(200).json(await getDeploymentForCommit(commitSha));
  } catch (error) {
    sendError(response, error);
  }
}
