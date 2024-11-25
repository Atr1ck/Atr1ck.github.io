import { useNavigate, useParams } from "react-router-dom";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { useQuery } from "@tanstack/react-query";

export function ArticleList(){
  const navigate = useNavigate();

  const {isLoading, data } = useQuery({
    queryKey:["artilces"],
    queryFn: async () => {
      const articleList = await fetch("https://blogbackend-ashy.vercel.app/api/articles")
      .then((response) => response.json());
      return articleList;
    }
  })

  if (isLoading) {
    return <div>Loading...</div>
  }
  
  if (!data || !data.articles) {
    return <div>Loading...</div>;
  }

  return (
      <div className="flex flex-grow flex-col items-center">
            {data.articles.map((article : {date:string, tags:string[], title:string}, index:number) => (
              <div className="p-6 w-3/5 h-60 my-6 rounded-ld shadow-md hover:bg-gray-200 hover:w-4/5 hover:h-72 transition-all duration-300 " key={index} onClick={() => navigate(`/articles/${article.title}`)} >
              <div className="prose">
              <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                {article.title}
              </Markdown>
              </div>
              </div>
            ))}
      </div>
  )
  }

export function ArticleContent(){
  const { title } = useParams<{ title : string }>();
  console.log(title);
  const {isLoading, data} = useQuery({
    queryKey:["artilces"],
    queryFn: async () => {
      const articleList = await fetch(`https://blogbackend-ashy.vercel.app/api/articles/${title}.md`)
      .then((response) => response.json());
      return articleList;
    }
  })

  if (isLoading) {
    return <div>is Loading</div>
  }

  console.log(data);
  return (
    <div className="flex-grow mx-24 my-8 border-2 p-8 border-slate-300 rounded-lg bg-slate-50 ">
      <div className="prose">
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{data.content}</Markdown>
      </div>
    </div>
  )
}
