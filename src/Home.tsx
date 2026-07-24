import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Outlet, useNavigate } from "react-router-dom"
import MusicPlayer from "./components/MusicPlayer/Musicplayer";
import { GithubOutlined } from "@ant-design/icons";
import ThemeToggle from "./components/Theme/ThemeToggle";
import BackgroundSettings from "./components/Theme/BackgroundSettings";

function TopNavi() {
  const navigate = useNavigate();

  return (
      <div className="navbar relative z-[80] min-h-16 bg-base-100/90 text-base-content border-b border-base-300/70 shadow-sm rounded-b-lg px-2 md:px-4 backdrop-blur-md transition-colors duration-300">
          <div className="navbar-start font-bold pl-1 text-lg md:text-2xl whitespace-nowrap">
            Atr1ck's Blog
          </div>
          <div className="navbar-center flex-row gap-x-0 sm:gap-x-2">
              <div>
                  <button className="btn btn-ghost btn-sm md:btn-md rounded-lg px-2 md:px-4" onClick={() => navigate('/')}>首页</button>
              </div>
              <div>
                  <button className="btn btn-ghost btn-sm md:btn-md rounded-lg px-2 md:px-4" onClick={() => navigate('/pictures')}>照片墙</button>
              </div>
              <div>
                  <button className="btn btn-ghost btn-sm md:btn-md rounded-lg px-2 md:px-4" onClick={() => navigate('/test')}>测试</button>
              </div>
          </div> 
          <div className="navbar-end h-full gap-x-1 sm:gap-x-3">
              <BackgroundSettings />
              <ThemeToggle />
              <a className="hidden sm:inline-flex" href="https://github.com/Atr1ck" target="_blank" rel="noreferrer" aria-label="GitHub">
              <GithubOutlined className="text-2xl"/>
              </a>
              <img src="/images/avatar.jpg" alt="Atr1ck" className="hidden sm:block h-10 w-10 object-cover mask mask-circle"></img>
          </div>
      </div>
  )
}

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen items-center text-base-content transition-colors duration-300">
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
