import { useParams } from "react-router-dom";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { useQuery } from "@tanstack/react-query";
import "highlight.js/styles/github-dark.css";
import type { Article } from "../../types/article";

export default ArticleContent;

function ArticleContent() {
  const { title } = useParams<{ title: string }>();
  const { isLoading, isError, data } = useQuery<Record<string, Article>>({
    queryKey: ["articles"],
    queryFn: async () => {
      const response = await fetch("/json/articles.json");

      if (!response.ok) {
        throw new Error(`Failed to load articles: ${response.status}`);
      }

      return response.json();
    },
  });

  if (isLoading) {
    return <div>is Loading</div>;
  }

  const article = title ? data?.[title] : undefined;

  if (isError) {
    return <div className="p-8 text-center">文章加载失败</div>;
  }

  if (!article) {
    return <div className="p-8 text-center">文章不存在</div>;
  }

  return (
    <div className="flex w-full justify-center">
      <article className="article-markdown prose prose-invert w-full max-w-4xl break-words bg-base-300/95 m-2 p-5 sm:p-8 rounded-lg">
        <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
          {article.content}
        </Markdown>
      </article>
    </div>
  );
}
