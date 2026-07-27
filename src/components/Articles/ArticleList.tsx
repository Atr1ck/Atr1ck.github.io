import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Loading from "../Load/Load";
import type { ArticleIndex } from "../../types/article";


export default function ArticleList(){
    const navigate = useNavigate();

    const { isLoading, isError, data } = useQuery<ArticleIndex>({
      queryKey:["articles"],
      queryFn: async () => {
        const response = await fetch("/json/articles.json");
        if (!response.ok) throw new Error(`Failed to load articles: ${response.status}`);
        return response.json();
      }
    })

    if (isLoading) {
      return <Loading />
    }

    if (isError) {
      return <div className="p-8 text-center">文章列表加载失败</div>;
    }
  
    return (
      <div className="flex flex-col items-center">
      {Object.values(data || {}).map((article) => (
        <div 
          className="flex flex-col p-4 sm:p-6 w-[calc(100%_-_1rem)] max-w-4xl my-3 sm:my-4 rounded-lg border border-base-300/70 shadow-sm bg-base-100/95 text-base-content hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer"
          key={article.slug}
          onClick={() => navigate(`/articles/${article.slug}`)}
        >
          <div className="w-full">
            <h2 className="text-xl sm:text-3xl text-base-content font-semibold">{article.title}</h2>
            <p className="mt-2 text-sm sm:text-base text-base-content/70 line-clamp-2">{article.summary}</p>
          </div>

          <div className="mt-5 flex min-h-6 items-end justify-between gap-3">
            <time className="shrink-0 text-xs sm:text-sm text-base-content/60" dateTime={article.date}>{article.date}</time>
            <div className="flex flex-wrap justify-end gap-x-2 gap-y-1">
            {article.tags.map((tag) => (
              <span className="text-xs sm:text-sm text-base-content/70 font-mono hover:text-primary transition-colors duration-300 cursor-default"
                key={tag}
              >
                #{tag}
              </span>
            ))}
            </div>
          </div>
        </div>
      ))}
    </div>
    );
    }
