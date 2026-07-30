import { Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { ArticleAliases, ArticleIndex } from "../../types/article";
import { hasNanYueTag } from "../../../shared/tags";
import MarkdownRenderer from "./MarkdownRenderer";
import { ContentTag, NanYueMark } from "../Tags/NanYueTheme";
import { countArticleCharacters, formatArticleWordCount } from "../../../shared/article-word-count";

export default ArticleContent;

function ArticleContent() {
  const { slug } = useParams<{ slug: string }>();
  const { isLoading, isError, data } = useQuery<{
    articles: ArticleIndex;
    aliases: ArticleAliases;
  }>({
    queryKey: ["article-content-index"],
    queryFn: async () => {
      const [articlesResponse, aliasesResponse] = await Promise.all([
        fetch("/json/articles.json"),
        fetch("/json/article-aliases.json"),
      ]);

      if (!articlesResponse.ok || !aliasesResponse.ok) {
        throw new Error("Failed to load the article index");
      }

      return {
        articles: await articlesResponse.json(),
        aliases: await aliasesResponse.json(),
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
  const isNanYue = hasNanYueTag(article.tags);
  const wordCountLabel = formatArticleWordCount(countArticleCharacters(article.content));
  return (
    <div className="flex w-full justify-center">
      <article className={`article-markdown prose w-full max-w-4xl break-words bg-base-100/95 text-base-content border border-base-300/70 shadow-sm m-2 p-5 sm:p-8 rounded-lg transition-colors duration-300 ${isNanYue ? "nan-yue-surface nan-yue-article-detail" : ""}`}>
        {isNanYue && <NanYueMark className="nan-yue-detail-mark" />}
        <header className="not-prose mb-6 border-b border-base-300 pb-4">
          <h1 className={`text-2xl sm:text-3xl font-semibold ${isNanYue ? "nan-yue-title-space" : ""}`}>{article.title}</h1>
          <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-1 text-sm text-base-content/60">
            <time dateTime={article.date}>{article.date}</time>
            {article.tags.map((tag) => <ContentTag tag={tag} key={tag} />)}
          </div>
        </header>
        <MarkdownRenderer content={article.content} />
        <footer className="not-prose mt-6 flex justify-end text-xs tabular-nums text-base-content/55">{wordCountLabel}</footer>
      </article>
    </div>
  );
}
