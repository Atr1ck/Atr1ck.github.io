import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { ArticleIndex } from "../../types/article";
import type { CategoryConfig } from "../../types/content";
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

  if (query.isLoading) return <Loading />;
  if (query.isError) return <div className="p-8 text-center">文章列表加载失败</div>;

  return (
    <main className="w-full">
      <div className="border-b border-base-300/70 bg-base-100/90 px-3 py-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center">
          <label className="input input-sm flex min-w-0 flex-1 items-center gap-2 rounded-md bg-base-100">
            <Search className="h-4 w-4 opacity-55" />
            <input value={search} onChange={(event) => updateFilter("q", event.target.value)} placeholder="搜索文章" />
          </label>
          <select className="select select-sm rounded-md" aria-label="文章分类" value={category} onChange={(event) => updateFilter("category", event.target.value)}>
            <option value="all">全部分类</option>
            {query.data?.categories.articles.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
          </select>
          <select className="select select-sm rounded-md" aria-label="文章标签" value={tag} onChange={(event) => updateFilter("tag", event.target.value)}>
            <option value="all">全部标签</option>
            {tags.map((item) => <option key={item} value={item}>#{item}</option>)}
          </select>
          <span className="shrink-0 text-xs text-base-content/55">{articles.length} 篇</span>
        </div>
      </div>

      <div className="flex flex-col items-center">
        {articles.map((article) => (
          <article
            className="my-3 flex w-[calc(100%_-_1rem)] max-w-4xl cursor-pointer flex-col rounded-lg border border-base-300/70 bg-base-100/95 p-4 text-base-content shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md sm:my-4 sm:p-6"
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
