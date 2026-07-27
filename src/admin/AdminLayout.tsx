import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogIn, LogOut, PenLine } from "lucide-react";
import { Link, Outlet } from "react-router-dom";
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
          <Link to="/admin" className="flex items-center gap-2 font-semibold">
            <PenLine className="h-5 w-5 text-primary" /> 文章管理
          </Link>
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
