import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Loading from "../Load/Load";
import type { Article } from "../../types/article";


export default function ArticleList(){
    const navigate = useNavigate();

    const { isLoading, data } = useQuery<Record<string, Article>>({
      queryKey:["articles"],
      queryFn: async () => {
        const articles = await fetch("/json/articles.json")
        .then((response) => response.json());
        return articles;
      }
    })

    if (isLoading) {
      return <Loading />
    }
  
    return (
      <div className="flex flex-col items-center">
      {Object.entries(data || {}).map(([title, article], index) => (
        <div 
          className="flex flex-col sm:flex-row relative p-4 sm:p-6 w-[calc(100%_-_1rem)] max-w-4xl min-h-40 sm:min-h-48 my-4 sm:my-5 rounded-lg border border-base-300/70 shadow-sm bg-base-100/95 text-base-content hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer"
          key={index}
          onClick={() => navigate(`/articles/${title}`)}
        >
          <p className="w-full sm:w-9/12 sm:border-r border-base-300 text-xl sm:text-3xl text-base-content font-semibold pb-2 sm:pb-0 pr-3">
            {title}
          </p>
          
          <p className="absolute text-xs sm:text-sm text-base-content/60 bottom-3 sm:bottom-5 left-4 sm:left-6">
            {article.date}
          </p>
          
          <div className="flex flex-col pl-0 sm:pl-4 pt-2 sm:pt-0">
            {article.tags.map((tag: string, index: number) => (
              <p className="text-sm sm:text-base text-base-content/70 font-mono hover:text-primary transition-colors duration-300 cursor-default"
                key={index}
              >
                #{tag}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
    );
    }
