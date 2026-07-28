import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { ArticleIndex } from "../../types/article";
import type { CategoryConfig } from "../../types/content";
import ContentFilterPanel from "../Filters/ContentFilterPanel";
import Loading from "../Load/Load";

async function loadArticleList() {
  const [articlesResponse, categoriesResponse] = await Promise.all([
    fetch("/json/articles.json"),
    fetch("/json/categories.json"),
  ]);
  if (!articlesResponse.ok || !categoriesResponse.ok) throw new Error("Failed to load article categories");
  return {
    articles: await articlesResponse.json() as ArticleIndex,
    categories: await categoriesResponse.json() as CategoryConfig,
  };
}

export default function ArticleList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useQuery({ queryKey: ["article-list"], queryFn: loadArticleList });
  const category = searchParams.get("category") || "all";
  const tag = searchParams.get("tag") || "all";
  const search = searchParams.get("q") || "";

  const allArticles = useMemo(() => Object.values(query.data?.articles || {}), [query.data]);
  const tags = useMemo(
    () => [...new Set(allArticles.flatMap((article) => article.tags))].sort((first, second) => first.localeCompare(second, "zh-CN")),
    [allArticles],
  );
  const articles = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allArticles.filter((article) =>
      (category === "all" || article.category === category) &&
      (tag === "all" || article.tags.includes(tag)) &&
      (!term || [article.title, article.summary, article.category, ...article.tags].some((value) => value.toLowerCase().includes(term))),
    );
  }, [allArticles, category, search, tag]);
  const categoryNames = new Map(query.data?.categories.articles.map((item) => [item.slug, item.name]) || []);

  const updateFilter = (key: "category" | "tag" | "q", value: string) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    setSearchParams(next);
  };
  const resetFilters = () => {
    const next = new URLSearchParams(searchParams);
    ["category", "tag", "q"].forEach((key) => next.delete(key));
    setSearchParams(next);
  };

  if (query.isLoading) return <Loading />;
  if (query.isError) return <div className="p-8 text-center">文章列表加载失败</div>;

  return (
    <main className="relative w-full px-2 py-4 sm:px-4 sm:py-6 lg:px-6">
      <div className="pointer-events-none fixed left-4 top-20 z-30 hidden w-52 lg:block">
        <div className="pointer-events-auto">
          <ContentFilterPanel
            category={category}
            categories={query.data?.categories.articles || []}
            count={articles.length}
            countLabel="篇文章"
            search={search}
            searchPlaceholder="搜索文章"
            tag={tag}
            tags={tags}
            onChange={updateFilter}
            onReset={resetFilters}
            desktopClassName="w-full"
          />
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center">
        <div className="lg:hidden">
          <ContentFilterPanel
            category={category}
            categories={query.data?.categories.articles || []}
            count={articles.length}
            countLabel="篇文章"
            search={search}
            searchPlaceholder="搜索文章"
            tag={tag}
            tags={tags}
            onChange={updateFilter}
            onReset={resetFilters}
          />
        </div>
        {articles.map((article) => (
          <article
            className="mb-4 flex w-full max-w-4xl cursor-pointer flex-col rounded-lg border border-base-300/70 bg-base-100/95 p-4 text-base-content shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md sm:mb-5 sm:p-6"
            key={article.slug}
            onClick={() => navigate(`/articles/${article.slug}`)}
          >
            <div className="w-full">
              <div className="mb-2 text-xs font-medium text-primary">{categoryNames.get(article.category) || "未分类"}</div>
              <h2 className="text-xl font-semibold text-base-content sm:text-3xl">{article.title}</h2>
              <p className="mt-2 min-h-10 text-sm text-base-content/70 line-clamp-2 sm:min-h-12 sm:text-base">{article.summary}</p>
            </div>
            <div className="mt-5 flex min-h-6 items-end justify-between gap-3">
              <time className="shrink-0 text-xs text-base-content/60 sm:text-sm" dateTime={article.date}>{article.date}</time>
              <div className="flex flex-wrap justify-end gap-x-2 gap-y-1">
                {article.tags.map((item) => <span className="cursor-default font-mono text-xs text-base-content/70 sm:text-sm" key={item}>#{item}</span>)}
              </div>
            </div>
          </article>
        ))}
        {articles.length === 0 && <p className="py-16 text-sm text-base-content/55">没有符合条件的文章</p>}
      </div>
    </main>
  );
}
