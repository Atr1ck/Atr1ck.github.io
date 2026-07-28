import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FilePlus2, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { listArticles } from "./api";
import DeploymentBadge from "./DeploymentBadge";

type Visibility = "all" | "published" | "hidden";

export default function AdminDashboard() {
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("all");
  const query = useQuery({ queryKey: ["admin-articles"], queryFn: listArticles });
  const articles = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (query.data || []).filter((article) => {
      const matchesVisibility = visibility === "all" || (visibility === "published" ? article.published : !article.published);
      const matchesSearch = !term || [article.title, article.slug, article.summary, ...article.tags]
        .some((value) => value.toLowerCase().includes(term));
      return matchesVisibility && matchesSearch;
    });
  }, [query.data, search, visibility]);

  return (
    <main className="mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">文章</h1>
          <p className="mt-1 text-sm text-base-content/60">{query.data?.length || 0} 篇内容</p>
        </div>
        <Link className="btn btn-primary btn-sm rounded-md" to="/admin/articles/new">
          <FilePlus2 className="h-4 w-4" /> 新建文章
        </Link>
      </div>

      <div className="mt-6 flex flex-col gap-3 border-y border-base-300 py-4 sm:flex-row sm:items-center">
        <label className="input input-sm flex w-full max-w-md items-center gap-2 rounded-md bg-base-100">
          <Search className="h-4 w-4 opacity-55" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索标题、slug 或标签" />
        </label>
        <div className="join" aria-label="公开状态筛选">
          {(["all", "published", "hidden"] as const).map((value) => (
            <button
              key={value}
              className={`btn btn-sm join-item rounded-md ${visibility === value ? "btn-neutral" : "btn-ghost"}`}
              onClick={() => setVisibility(value)}
            >
              {{ all: "全部", published: "公开", hidden: "已下线" }[value]}
            </button>
          ))}
        </div>
      </div>

      {query.isLoading && <p className="py-12 text-center text-base-content/60">正在读取 GitHub 内容...</p>}
      {query.isError && (
        <div className="py-12 text-center text-error">
          <p>文章列表加载失败</p>
          <p className="mt-2 text-sm">{query.error instanceof Error ? query.error.message : "未知错误"}</p>
        </div>
      )}
      {!query.isLoading && !query.isError && (
        <div className="mt-4 overflow-x-auto border border-base-300 bg-base-100">
          <table className="table table-sm min-w-[920px]">
            <thead><tr><th>文章</th><th>标签</th><th>状态</th><th>日期</th><th>最后更新</th><th>部署</th><th className="text-right">操作</th></tr></thead>
            <tbody>
              {articles.map((article) => (
                <tr key={article.slug}>
                  <td className="max-w-sm">
                    <Link className="font-medium hover:text-primary" to={`/admin/articles/${article.slug}`}>{article.title}</Link>
                    <div className="mt-1 truncate font-mono text-xs text-base-content/50">{article.slug}</div>
                  </td>
                  <td><span className="block max-w-56 truncate">{article.tags.join("、") || "-"}</span></td>
                  <td><span className={`admin-status ${article.published ? "admin-status-ready" : ""}`}>{article.published ? "公开" : "已下线"}</span></td>
                  <td>{article.date}</td>
                  <td>{article.updated}</td>
                  <td><DeploymentBadge commitSha={article.lastCommitSha} /></td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1">
                      {article.lastCommitUrl && <a className="btn btn-ghost btn-xs rounded" href={article.lastCommitUrl} target="_blank" rel="noreferrer" title="查看 commit"><ExternalLink className="h-3.5 w-3.5" /></a>}
                      <Link className="btn btn-ghost btn-xs rounded" to={`/admin/articles/${article.slug}`}>编辑</Link>
                    </div>
                  </td>
                </tr>
              ))}
              {articles.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-base-content/55">没有符合条件的文章</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
