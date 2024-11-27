import { useNavigate, useParams } from "react-router-dom";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { useQuery } from "@tanstack/react-query";

interface Article {
  content : string,
  data : string,
  tags : string[],
  title : string
}

export function ArticleList(){
  const navigate = useNavigate();

  const { isLoading, data } = useQuery<Record<string, Article>>({
    queryKey:["artilces"],
    queryFn: async () => {
      const articles = await fetch("/json/articles.json")
      .then((response) => response.json());
      return articles;
    }
  })

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
      <div className="flex flex-grow flex-col items-center">
            {Object.entries(data || {}).map(([title, article], index) => (
              <div className="flex flex-row p-5 w-3/5 h-60 my-6 rounded-lg shadow-md bg-gray-950 hover:bg-gray-800 hover:w-4/5 hover:h-72 transition-all duration-300 opacity-80" key={index} onClick={() => navigate(`/articles/${title}`)} >
              <p className="w-4/5 border-r-2  text-white text-3xl font-light">{title}</p>
              <div className="flex flex-col pl-4">
                {article.tags.map((tag : string, index: number) => (
                <p className="text-white text-lg font-mono" key={index}># {tag}</p>
              ))}
              </div>
              </div>
            ))}
      </div>
  );
  }

export function ArticleContent(){
  const { title } = useParams<{ title : string }>();
  const { isLoading, data } = useQuery({
    queryKey:["artilce"],
    queryFn: async () => {
      const articles = await fetch("/json/articles.json")
      .then((response) => response.json());
      return articles;
    }
  })

  if (isLoading) {
    return <div>is Loading</div>
  }

  console.log(data);
  return (
    <div className="flex-grow mx-24 my-8 border-2 p-8 border-slate-300 rounded-lg bg-slate-50 ">
      <div className="prose">
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{data[title || ""]["content"]}</Markdown>
      </div>
    </div>
  )
}
