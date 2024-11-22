import React from "react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const markdownFiles = import.meta.glob('./articles/*.md', { eager: true });

type Article = {
  path: string;
  Component: React.FC;
};

export function ArticleList(){
    const navigate = useNavigate();
    const [articles, setArticles] = useState<Article[]>([]);

    useEffect(() => {
      // 将 Markdown 文件转化为 React 组件数组
      const loadedArticles: Article[] = Object.keys(markdownFiles).map((path) => ({
        path: path.replace('./articles/', '').replace('.md', ''), // 提取文件名
        Component: (markdownFiles[path] as any).ReactComponent, // 获取 React 组件
      }));
  
      setArticles(loadedArticles);
    }, []);

    console.log(markdownFiles);
    return (
        <div className="flex flex-grow flex-col items-center">
            {articles.map(({ path, Component }) => (
              <div className="p-6 w-3/5 h-60 my-6 rounded-ld shadow-md hover:bg-gray-200 hover:w-4/5 hover:h-72 transition-all duration-300 " key={path} onClick={() => navigate(`/articles/${path}`)}>
                <h2>{path.replace('./articles/', '').replace('.md', '')}</h2>
                <Component></Component>
              </div>
            ))}
        </div>
    )
  }

export function ArticleContent(){
  const { name='' } = useParams<{ name: string}>();
  const [articles, setArticles] = useState<{ [key: string]: React.ComponentType } | null>(null);

  useEffect(() => {
    // 将 Markdown 文件转化为一个对象，路径为键，组件为值
    const loadedArticles: { [key: string]: React.ComponentType } = Object.keys(markdownFiles).reduce(
      (acc, path) => {
        const component = (markdownFiles[path] as any).ReactComponent;
        const pathName = path.replace('./articles/', '').replace('.md', ''); // 提取文件名作为路径
        acc[pathName] = component;
        return acc;
      },
      {} as { [key: string]: React.ComponentType }
    );

    setArticles(loadedArticles);
  }, []);


  if (!articles || !name || !articles[name]) {
    return <div>Loading...</div>;
  }

  const ArticleComponent = articles[name];

  return (
    <div className="flex-grow mx-24 my-8 border-2 p-8 border-slate-300 rounded-lg bg-slate-50">
      <ArticleComponent />
    </div>
  )
}