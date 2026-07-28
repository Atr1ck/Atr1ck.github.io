import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImagePlus, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { listPictures } from "./api";

type Visibility = "all" | "published" | "hidden";

export default function PictureDashboard() {
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("all");
  const query = useQuery({ queryKey: ["admin-pictures"], queryFn: listPictures });
  const pictures = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (query.data?.pictures || []).filter((picture) => {
      const matchesVisibility = visibility === "all" || (visibility === "published" ? picture.published : !picture.published);
      const matchesSearch = !term || [picture.title, picture.id, ...picture.tags]
        .some((value) => value.toLowerCase().includes(term));
      return matchesVisibility && matchesSearch;
    });
  }, [query.data, search, visibility]);

  return (
    <main className="mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-2xl font-semibold">照片</h1><p className="mt-1 text-sm text-base-content/60">{query.data?.pictures.length || 0} 张内容</p></div>
        <Link className="btn btn-primary btn-sm rounded-md" to="/admin/pictures/new"><ImagePlus className="h-4 w-4" />上传照片</Link>
      </div>

      <div className="mt-6 flex flex-col gap-3 border-y border-base-300 py-4 sm:flex-row sm:items-center">
        <label className="input input-sm flex w-full max-w-md items-center gap-2 rounded-md bg-base-100"><Search className="h-4 w-4 opacity-55" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索标题、ID 或标签" /></label>
        <div className="join" aria-label="公开状态筛选">
          {(["all", "published", "hidden"] as const).map((value) => <button key={value} className={`btn btn-sm join-item rounded-md ${visibility === value ? "btn-neutral" : "btn-ghost"}`} onClick={() => setVisibility(value)}>{{ all: "全部", published: "公开", hidden: "已下线" }[value]}</button>)}
        </div>
      </div>

      {query.isLoading && <p className="py-12 text-center text-base-content/60">正在读取 GitHub 内容...</p>}
      {query.isError && <div className="py-12 text-center text-error"><p>照片列表加载失败</p><p className="mt-2 text-sm">{query.error instanceof Error ? query.error.message : "未知错误"}</p></div>}
      {!query.isLoading && !query.isError && (
        <div className="mt-4 overflow-x-auto border border-base-300 bg-base-100">
          <table className="table table-sm min-w-[780px]">
            <thead><tr><th>照片</th><th>标签</th><th>日期</th><th>状态</th><th className="text-right">操作</th></tr></thead>
            <tbody>
              {pictures.map((picture) => <tr key={picture.id}>
                <td><div className="flex items-center gap-3"><img className="h-12 w-12 shrink-0 object-cover" src={`/pictures/${picture.preview}`} alt="" loading="lazy" /><div className="min-w-0"><p className="max-w-64 truncate font-medium">{picture.title}</p><p className="max-w-64 truncate font-mono text-xs text-base-content/50">{picture.id}</p></div></div></td>
                <td><span className="block max-w-56 truncate">{picture.tags.join("、") || "-"}</span></td>
                <td>{picture.date}</td>
                <td><span className={`badge badge-sm rounded ${picture.published ? "badge-success" : "badge-ghost"}`}>{picture.published ? "公开" : "已下线"}</span></td>
                <td className="text-right"><Link className="btn btn-ghost btn-xs rounded" to={`/admin/pictures/${picture.id}`}>编辑</Link></td>
              </tr>)}
              {pictures.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-base-content/55">没有符合条件的照片</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
