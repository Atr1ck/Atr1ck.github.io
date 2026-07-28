import type {
  AdminArticle,
  AdminArticleSummary,
  AdminPictureList,
  AdminSession,
  DeploymentStatus,
  PicturePublishResult,
  PublishResult,
} from "./types";

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(`${message}（HTTP ${status}）`);
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => null) as {
    error?: string;
    details?: { hint?: string };
  } | T | null;
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body
      ? body.error || "请求失败"
      : "请求失败";
    const hint = body && typeof body === "object" && "details" in body
      ? body.details?.hint
      : undefined;
    throw new ApiError(response.status, hint ? `${message}：${hint}` : message);
  }
  return body as T;
}

export function getSession() {
  return requestJson<AdminSession>("/api/auth/session");
}

export async function logout(csrfToken: string) {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    headers: { "x-csrf-token": csrfToken },
  });
  if (!response.ok) throw new ApiError(response.status, "退出失败");
}

export async function listArticles() {
  const result = await requestJson<{ articles: AdminArticleSummary[] }>("/api/articles");
  return result.articles;
}

export function listPictures() {
  return requestJson<AdminPictureList>("/api/pictures");
}

export async function listTagSuggestions() {
  const [articlesResponse, picturesResponse] = await Promise.all([fetch("/json/articles.json"), fetch("/json/pictures.json")]);
  if (!articlesResponse.ok || !picturesResponse.ok) return [];
  const articles = await articlesResponse.json() as Record<string, { tags: string[] }>;
  const pictures = await picturesResponse.json() as { pictures: Array<{ tags: string[] }> };
  return [...new Set([...Object.values(articles).flatMap((article) => article.tags), ...pictures.pictures.flatMap((picture) => picture.tags)])].sort((first, second) => first.localeCompare(second, "zh-CN"));
}

export async function getArticle(slug: string) {
  const result = await requestJson<{ article: AdminArticle }>(`/api/article?slug=${encodeURIComponent(slug)}`);
  return result.article;
}

export function publishArticle(
  csrfToken: string,
  payload: { slug: string; markdown: string; expectedSha: string | null; assets: Array<{ path: string; contentBase64: string; preserveOriginal: boolean }> },
) {
  return requestJson<PublishResult>("/api/articles/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
    body: JSON.stringify(payload),
  });
}

export function publishPicture(
  csrfToken: string,
  payload: {
    picture: AdminPictureList["pictures"][number];
    expectedManifestSha: string;
    isNew: boolean;
    assets: Array<{ path: string; contentBase64: string; preserveOriginal: boolean }>;
  },
) {
  return requestJson<PicturePublishResult>("/api/pictures/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
    body: JSON.stringify(payload),
  });
}

export function getDeployment(commitSha: string) {
  return requestJson<DeploymentStatus>(`/api/deployment?commitSha=${encodeURIComponent(commitSha)}`);
}

export function redeploy(csrfToken: string, deploymentId: string) {
  return requestJson<{ deploymentId: string; state: string; deploymentUrl: string }>("/api/deployments/redeploy", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
    body: JSON.stringify({ deploymentId }),
  });
}
