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
          className="
            flex flex-col sm:flex-row  // 小屏垂直排列，中屏+横向排列
            relative p-3 sm:p-5       // 响应式内边距
            w-5/6 sm:w-4/6           // 不同屏幕宽度
            h-48 sm:h-60             // 不同屏幕高度
            my-4 sm:my-6             // 响应式外边距
            rounded-lg shadow-md 
            bg-gray-950 hover:bg-gray-800 
            hover:scale-105
            transition-all duration-300 
            opacity-80
            cursor-pointer           // 添加指针效果
          " 
          key={index}
          onClick={() => navigate(`/articles/${title}`)}
        >
          <p className="
            w-full sm:w-9/12        // 小屏全宽，中屏+ 9/12
            sm:border-r-2          // 仅中屏+显示右边框
            text-xl sm:text-3xl     // 响应式字体大小
            text-white 
            font-light
            pb-2 sm:pb-0           // 小屏添加下边距
          ">
            {title}
          </p>
          
          <p className="
            absolute
            text-xs sm:text-sm    // 响应式字体大小
            text-white 
            bottom-2 sm:bottom-4  // 响应式定位
            left-2 sm:left-auto   // 调整小屏位置
            opacity-60
          ">
            {article.date}
          </p>
          
          <div className="
            flex flex-col 
            pl-0 sm:pl-4         // 响应式左内边距
            pt-2 sm:pt-0         // 小屏添加上边距
          ">
            {article.tags.map((tag: string, index: number) => (
              <p className="
                text-sm sm:text-md  // 响应式字体大小
                font-mono 
                hover:text-blue-400 
                transition-all duration-300 
                cursor-default
              " 
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
  