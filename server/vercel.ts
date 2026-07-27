import { requireEnv } from "./config.js";
import { HttpError } from "./http.js";

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const DEPLOYMENT_ID_PATTERN = /^dpl_[A-Za-z0-9]+$/;

interface VercelDeployment {
  uid: string;
  name: string;
  url: string;
  state: string;
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
  created?: number;
}

export type VercelRequester = <T>(path: string, init?: RequestInit) => Promise<T>;

function teamQuery(): string {
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  return teamId ? `&teamId=${encodeURIComponent(teamId)}` : "";
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
  const query = `/v6/deployments?projectId=${encodeURIComponent(projectId)}&limit=20&meta-githubCommitSha=${commitSha}${teamQuery()}`;
  const result = await request<VercelDeploymentsResponse>(query);
  const deployment = result.deployments.find((item) => item.meta?.githubCommitSha === commitSha);
  if (!deployment) return { found: false as const, commitSha };

  let errorSummary: string | null = null;
  if (["ERROR", "CANCELED"].includes(deployment.state)) {
    const events = await request<VercelEvent[]>(
      `/v3/deployments/${encodeURIComponent(deployment.uid)}/events?direction=backward&limit=100${teamQuery()}`,
    );
    const lines = events
      .filter((event) => event.type === "stderr" && event.text)
      .map((event) => event.text!.trim())
      .filter(Boolean)
      .slice(0, 12);
    errorSummary = lines.join("\n").slice(0, 4000) || null;
  }

  return {
    found: true as const,
    commitSha,
    deploymentId: deployment.uid,
    state: deployment.state,
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
  const result = await request<VercelDeployment>(`/v13/deployments?${teamQuery().slice(1)}`, {
    method: "POST",
    body: JSON.stringify({
      name: projectName,
      deploymentId,
      target: "production",
    }),
  });
  return {
    deploymentId: result.uid,
    state: result.state,
    deploymentUrl: `https://${result.url}`,
  };
}
