export interface AdminSession {
  authenticated: boolean;
  user?: { login: string; avatarUrl: string };
  csrfToken?: string;
}

export interface AdminArticleSummary {
  title: string;
  slug: string;
  date: string;
  updated: string;
  tags: string[];
  summary: string;
  cover: string | null;
  published: boolean;
  sha: string;
  path: string;
  lastCommitSha: string;
  lastCommitUrl: string;
}

export interface AdminArticle extends AdminArticleSummary {
  markdown: string;
}

export interface DeploymentStatus {
  found: boolean;
  commitSha: string;
  deploymentId?: string;
  state?: string;
  createdAt?: string;
  readyAt?: string | null;
  durationMs?: number | null;
  deploymentUrl?: string;
  inspectorUrl?: string | null;
  errorSummary?: string | null;
}

export interface PublishResult {
  commitSha: string;
  commitUrl: string;
  articleSha: string;
  articlePath: string;
  status: "submitted";
}
