interface Article {
  title: string;
  slug: string;
  category: string;
  date: string;
  updated: string;
  tags: string[];
  summary: string;
  cover: string | null;
  published: boolean;
  content: string;
  legacyTitles: string[];
}

type ArticleIndex = Record<string, Article>;
type ArticleAliases = Record<string, string>;

export type { Article, ArticleAliases, ArticleIndex };
