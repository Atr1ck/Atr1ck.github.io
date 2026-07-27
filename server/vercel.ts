import { requireEnv } from "./config.js";
import { HttpError } from "./http.js";

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const DEPLOYMENT_ID_PATTERN = /^dpl_[A-Za-z0-9]+$/;

interface VercelDeployment {
  uid: string;
  name: string;
  url: string;
  state?: string;
  readyState?: string;
  created: number;
  ready?: number;
  inspectorUrl?: string;
  meta?: Record<string, string>;
}

interface VercelDeploymentsResponse {
  deployments: VercelDeployment[];
}

interface VercelEvent {
  type?: string;
  text?: string;
  level?: string;
  created?: number;
  payload?: { text?: string };
}

interface VercelProject {
  link?: { productionBranch?: string };
}

export type VercelRequester = <T>(path: string, init?: RequestInit) => Promise<T>;

function appendTeam(path: string): string {
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  if (!teamId) return path;
  return `${path}${path.includes("?") ? "&" : "?"}teamId=${encodeURIComponent(teamId)}`;
}

export async function vercelRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`https://api.vercel.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireEnv("VERCEL_API_TOKEN")}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => null) as T | { error?: { message?: string } } | null;
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body
      ? body.error?.message
      : undefined;
    throw new HttpError(502, message || `Vercel API request failed (${response.status})`);
  }
  return body as T;
}

export async function getDeploymentForCommit(
  commitSha: string,
  request: VercelRequester = vercelRequest,
) {
  if (!SHA_PATTERN.test(commitSha)) throw new HttpError(400, "Invalid commit SHA");
  const projectId = requireEnv("VERCEL_PROJECT_ID");
  const query = appendTeam(`/v7/deployments?projectId=${encodeURIComponent(projectId)}&target=production&limit=20&sha=${commitSha}`);
  const result = await request<VercelDeploymentsResponse>(query);
  const deployment = result.deployments.find((item) => item.meta?.githubCommitSha === commitSha);
  if (!deployment) return { found: false as const, commitSha };
  const state = deployment.state || deployment.readyState || "QUEUED";

  let errorSummary: string | null = null;
  if (["ERROR", "CANCELED"].includes(state)) {
    const events = await request<VercelEvent[]>(
      appendTeam(`/v3/deployments/${encodeURIComponent(deployment.uid)}/events?direction=backward&limit=100`),
    );
    const lines = events
      .filter((event) => ["stderr", "fatal"].includes(event.type || "") || event.level === "error")
      .map((event) => (event.text || event.payload?.text || "").trim())
      .filter(Boolean)
      .slice(0, 12);
    errorSummary = lines.join("\n").slice(0, 4000) || null;
  }

  return {
    found: true as const,
    commitSha,
    deploymentId: deployment.uid,
    state,
    createdAt: new Date(deployment.created).toISOString(),
    readyAt: deployment.ready ? new Date(deployment.ready).toISOString() : null,
    durationMs: deployment.ready ? Math.max(0, deployment.ready - deployment.created) : null,
    deploymentUrl: `https://${deployment.url}`,
    inspectorUrl: deployment.inspectorUrl || null,
    errorSummary,
  };
}

export async function redeploy(
  deploymentId: string,
  request: VercelRequester = vercelRequest,
) {
  if (!DEPLOYMENT_ID_PATTERN.test(deploymentId)) throw new HttpError(400, "Invalid deployment ID");
  const projectName = requireEnv("VERCEL_PROJECT_NAME");
  const result = await request<VercelDeployment>(appendTeam("/v13/deployments"), {
    method: "POST",
    body: JSON.stringify({
      name: projectName,
      deploymentId,
      target: "production",
    }),
  });
  return {
    deploymentId: result.uid,
    state: result.state || result.readyState || "QUEUED",
    deploymentUrl: `https://${result.url}`,
  };
}

export async function assertProductionBranch(
  expectedBranch: string,
  request: VercelRequester = vercelRequest,
): Promise<void> {
  const projectId = requireEnv("VERCEL_PROJECT_ID");
  const project = await request<VercelProject>(
    appendTeam(`/v9/projects/${encodeURIComponent(projectId)}`),
  );
  const productionBranch = project.link?.productionBranch;
  if (!productionBranch) {
    throw new HttpError(503, "Vercel project is not connected to a Git production branch");
  }
  if (productionBranch !== expectedBranch) {
    throw new HttpError(
      503,
      `Vercel production branch is "${productionBranch}"; expected "${expectedBranch}"`,
    );
  }
}
