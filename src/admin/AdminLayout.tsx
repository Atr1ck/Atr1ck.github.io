import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Images, LogIn, LogOut, PenLine, Tags } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { getSession, logout } from "./api";
import type { AdminContext } from "./context";

export default function AdminLayout() {
  const queryClient = useQueryClient();
  const sessionQuery = useQuery({ queryKey: ["admin-session"], queryFn: getSession, retry: false });

  if (sessionQuery.isLoading) {
    return <main className="admin-shell grid min-h-screen place-items-center">正在验证身份...</main>;
  }

  if (sessionQuery.isError) {
    return (
      <main className="admin-shell grid min-h-screen place-items-center p-6 text-center">
        <div>
          <h1 className="text-xl font-semibold">后台暂时无法连接</h1>
          <p className="mt-2 text-sm text-base-content/65">请确认 Vercel Serverless Functions 与环境变量已经配置。</p>
          <p className="mt-2 text-sm text-error">{sessionQuery.error instanceof Error ? sessionQuery.error.message : "未知错误"}</p>
        </div>
      </main>
    );
  }

  const session = sessionQuery.data;
  if (!session?.authenticated || !session.csrfToken) {
    return (
      <main className="admin-shell grid min-h-screen place-items-center p-6">
        <section className="w-full max-w-sm border border-base-300 bg-base-100 p-7 text-center shadow-sm">
          <PenLine className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-semibold">Atr1ck Blog 管理后台</h1>
          <p className="mt-2 text-sm text-base-content/65">仅授权的 GitHub 账户可以访问。</p>
          <a className="btn btn-primary mt-6 w-full rounded-md" href="/api/auth/github">
            <LogIn className="h-4 w-4" /> 使用 GitHub 登录
          </a>
        </section>
      </main>
    );
  }

  const authenticatedSession = session as AdminContext["session"];
  return (
    <div className="admin-shell min-h-screen bg-base-200 text-base-content">
      <header className="sticky top-0 z-40 border-b border-base-300 bg-base-100/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-5">
            <Link to="/admin" className="hidden items-center gap-2 font-semibold sm:flex">
              <PenLine className="h-5 w-5 text-primary" /> 内容管理
            </Link>
            <nav className="flex items-center gap-1 text-sm" aria-label="后台内容导航">
              <NavLink end to="/admin" className={({ isActive }) => `btn btn-sm rounded-md ${isActive ? "btn-neutral" : "btn-ghost"}`}><PenLine className="h-4 w-4" />文章</NavLink>
              <NavLink to="/admin/pictures" className={({ isActive }) => `btn btn-sm rounded-md ${isActive ? "btn-neutral" : "btn-ghost"}`}><Images className="h-4 w-4" />照片</NavLink>
              <NavLink to="/admin/categories" className={({ isActive }) => `btn btn-sm rounded-md ${isActive ? "btn-neutral" : "btn-ghost"}`}><Tags className="h-4 w-4" />分类</NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <img className="h-7 w-7 rounded-full" src={session.user?.avatarUrl} alt="" />
            <span className="hidden sm:inline">{session.user?.login}</span>
            <button
              className="btn btn-ghost btn-sm rounded-md"
              title="退出登录"
              onClick={async () => {
                await logout(authenticatedSession.csrfToken);
                await queryClient.invalidateQueries({ queryKey: ["admin-session"] });
              }}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      <Outlet context={{ session: authenticatedSession } satisfies AdminContext} />
    </div>
  );
}
