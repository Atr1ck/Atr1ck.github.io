export interface AdminSession {
  authenticated: boolean;
  user?: { login: string; avatarUrl: string };
  csrfToken?: string;
}

export interface AdminArticleSummary {
  title: string;
  slug: string;
  category: string;
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

export interface AdminPicture {
  id: string;
  title: string;
  file: string;
  preview: string;
  category: string;
  tags: string[];
  date: string;
  published: boolean;
}

export interface AdminPictureList {
  manifestSha: string;
  pictures: AdminPicture[];
}

export interface PicturePublishResult {
  commitSha: string;
  commitUrl: string;
  manifestSha: string;
  pictureId: string;
  status: "submitted";
}

export interface CategoryPublishResult {
  categories: import("../types/content").CategoryConfig;
  categorySha: string;
  commitSha: string;
  commitUrl: string;
  status: "submitted";
}
