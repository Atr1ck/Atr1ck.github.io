import { Outlet } from "react-router-dom"

function TopNavi() {
  return (
      <div className="flex flex-row h-12 w-full rounded-lg bg-slate-50 shadow-md py-3 px-4 justify-around">
          <div>
              11
          </div>
          <div>
              22
          </div>
          <div>
              33
          </div> 
      </div>
  )
}

function Information(){
  return (
  <div>
    <div className="mt-6 w-48 shadow-md rounded-lg">
      <img className="w-48 h-48 rounded-t-lg" src="https://i.postimg.cc/ydtfJvBq/20240528-194839-1.jpg" alt="image" />
      <a className="w-48 h-10 p-1 flex justify-center items-center bg-gray-100 border-b hover:bg-gray-200 transition-all duration-300" href="https://github.com/Atr1ck" target="_blank">Bilibili</a>
      <a className="w-48 h-10 p-1 flex justify-center items-center bg-gray-100 hover:bg-gray-200 transition-all duration-300" href="https://github.com/Atr1ck" target="_blank">Github</a>
    </div>
  </div>
  )
}



export default function Home() {
  return (
    <div className="flex flex-col h-screen">
      <TopNavi></TopNavi>
      <div className="flex flex-grow flex-row mx-24">
        <Information></Information>
        <Outlet />
      </div>
    </div>
  )
}

