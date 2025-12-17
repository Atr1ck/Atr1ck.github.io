import { useParams } from "react-router-dom";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { useQuery } from "@tanstack/react-query";

export default ArticleContent;

function ArticleContent(){
  const { title } = useParams<{ title : string }>();
  const { isLoading, data } = useQuery({
    queryKey:["article"],
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
    <div className="flex w-full justify-center">
      <div className="max-w-full w-full md:w-2/3 prose bg-base-300/95 m-2 p-8 rounded-2xl">
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{data[title || ""]["content"]}</Markdown>
      </div>
    </div>
  )
}
