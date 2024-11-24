import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";


type Article = {
  name: string; // 文件路径
  content: string; // Markdown 原始内容
};

const markdownFiles = import.meta.glob('./articles/*.md', { eager: true });

export function ArticleList(){
  const [articles, setArticles] = useState<Article[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const loadedArticles: Article[] = Object.keys(markdownFiles).map((path) => {
    const file = markdownFiles[path] as unknown as {markdown:string};
      return {
        name: path.replace('./articles/', '').replace('.md', ''), // 提取文件名
        content: file.markdown, // Markdown 文件内容
      };
    });

    setArticles(loadedArticles);
  }, []);
  console.log(articles);
  return (
      <div className="flex flex-grow flex-col items-center">
            {articles.map(({ name, content }) => (
              <div className="p-6 w-3/5 h-60 my-6 rounded-ld shadow-md hover:bg-gray-200 hover:w-4/5 hover:h-72 transition-all duration-300 " key={name} onClick={() => navigate(`/articles/${name}`)} >
              <div className="prose">
              <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                {content}
              </Markdown>
              </div>
              </div>
            ))}
      </div>
  )
  }

export function ArticleContent(){
  const { name='' } = useParams<{ name: string}>();
  const [articles, setArticles] = useState<Article[]>([]);

  useEffect(() => {
    const loadedArticles: Article[] = Object.keys(markdownFiles).map((path) => {
    const file = markdownFiles[path] as unknown as {markdown:string};
      return {
        name: path.replace('./articles/', '').replace('.md', ''), // 提取文件名
        content: file.markdown, // Markdown 文件内容
      };
    });

    setArticles(loadedArticles);
  }, []);

  return (
    <div className="flex-grow mx-24 my-8 border-2 p-8 border-slate-300 rounded-lg bg-slate-50 ">
      <div className="prose">
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{articles.find(article => article.name === name)?.content}</Markdown>
      </div>
    </div>
  )
}
