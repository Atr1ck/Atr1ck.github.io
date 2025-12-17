import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Outlet, useNavigate } from "react-router-dom"
import MusicPlayer from "./components/MusicPlayer/Musicplayer";
import { GithubOutlined } from "@ant-design/icons";

function TopNavi() {
  const navigate = useNavigate();

  return (
      <div className="navbar max-h-16 bg-black/60 shadow-sm rounded-b-2xl">
          <div className="navbar-start font-bold pl-2 text-lg md:text-2xl">
            Atr1ck's Blog
          </div>
          <div className="navbar-center flex-row gap-x-5">
              <div>
                  <button className="btn btn-ghost rounded-xl" onClick={() => navigate('/')}>首页</button>
              </div>
              <div>
                  <button className="btn btn-ghost rounded-xl" onClick={() => navigate('/pictures')}>照片墙</button>
              </div>
              <div>
                  <button className="btn btn-ghost rounded-xl" onClick={() => navigate('/test')}>测试</button>
              </div>
          </div> 
          <div className="navbar-end h-full gap-x-3">
              <a className="" href="https://github.com/Atr1ck" target="_blank">
              <GithubOutlined className="text-2xl"/>
              </a>
              <img src="/images/avatar.jpg" className="h-5/6 w-auto mask mask-circle"></img>
          </div>
      </div>
  )
}

export default function Home() {
  return (
    <div className="flex flex-col h-screen items-center">
      <TopNavi></TopNavi>
      <MusicPlayer></MusicPlayer>
      <div className="flex flex-col grow w-full md:w-2/3">
        <QueryClientProvider client={new QueryClient} >
        <Outlet />
        </QueryClientProvider>
      </div>
    </div>
  )
}

