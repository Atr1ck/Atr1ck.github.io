import { Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { ArticleAliases, ArticleIndex } from "../../types/article";
import type { CategoryConfig } from "../../types/content";
import MarkdownRenderer from "./MarkdownRenderer";

export default ArticleContent;

function ArticleContent() {
  const { slug } = useParams<{ slug: string }>();
  const { isLoading, isError, data } = useQuery<{
    articles: ArticleIndex;
    aliases: ArticleAliases;
    categories: CategoryConfig;
  }>({
    queryKey: ["article-content-index"],
    queryFn: async () => {
      const [articlesResponse, aliasesResponse, categoriesResponse] = await Promise.all([
        fetch("/json/articles.json"),
        fetch("/json/article-aliases.json"),
        fetch("/json/categories.json"),
      ]);

      if (!articlesResponse.ok || !aliasesResponse.ok || !categoriesResponse.ok) {
        throw new Error("Failed to load the article index");
      }

      return {
        articles: await articlesResponse.json(),
        aliases: await aliasesResponse.json(),
        categories: await categoriesResponse.json(),
      };
    },
  });

  if (isLoading) {
    return <div>is Loading</div>;
  }

  if (isError) {
    return <div className="p-8 text-center">文章加载失败</div>;
  }

  const canonicalSlug = slug ? data?.aliases[slug] : undefined;
  if (canonicalSlug) {
    return <Navigate to={`/articles/${canonicalSlug}`} replace />;
  }

  const article = slug ? data?.articles[slug] : undefined;

  if (!article) {
    return <div className="p-8 text-center">文章不存在</div>;
  }
  const categoryName = data?.categories.articles.find((item) => item.slug === article.category)?.name || "未分类";

  return (
    <div className="flex w-full justify-center">
      <article className="article-markdown prose w-full max-w-4xl break-words bg-base-100/95 text-base-content border border-base-300/70 shadow-sm m-2 p-5 sm:p-8 rounded-lg transition-colors duration-300">
        <header className="not-prose mb-6 border-b border-base-300 pb-4">
          <h1 className="text-2xl sm:text-3xl font-semibold">{article.title}</h1>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-base-content/60">
            <time dateTime={article.date}>{article.date}</time>
            <span className="text-primary">{categoryName}</span>
            {article.tags.map((tag) => <span key={tag}>#{tag}</span>)}
          </div>
        </header>
        <MarkdownRenderer content={article.content} />
      </article>
    </div>
  );
}
