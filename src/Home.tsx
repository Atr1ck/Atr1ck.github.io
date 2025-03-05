import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Outlet, useNavigate } from "react-router-dom"
import MusicPlayer from "./components/Musicplayer";
import { GithubOutlined } from "@ant-design/icons";

function TopNavi() {
  const navigate = useNavigate();

  return (
      <div className="flex flex-row h-12 w-full rounded-lg text-white bg-black/60 shadow-md py-3 px-4 items-center justify-around">
          <a className="absolute right-6" href="https://github.com/Atr1ck" target="_blank">
          <GithubOutlined className="text-2xl"/>
          </a>
          <div>
              <button className="hover:bg-slate-600 px-2 py-1 transition-all duration-300 rounded-md" onClick={() => navigate('/')}>首页</button>
          </div>
          <div>
              <button className="hover:bg-slate-600 px-2 py-1 transition-all duration-300 rounded-md" onClick={() => navigate('/pictures')}>照片墙</button>
          </div>
          <div>
              33
          </div> 
      </div>
  )
}


export default function Home() {
  return (
    <div className="flex flex-col h-screen items-center">
      <TopNavi></TopNavi>
      <div className="flex grow flex-row w-10/12 ">
        <div className="flex flex-col items-center w-1/4">
        <MusicPlayer></MusicPlayer>
        </div>
        <QueryClientProvider client={new QueryClient} >
        <Outlet />
        </QueryClientProvider>
      </div>
    </div>
  )
}

