import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CloudUpload, ExternalLink, LoaderCircle, Plus, Tags } from "lucide-react";
import { createCategory, getCategoryState } from "./api";
import DeploymentBadge from "./DeploymentBadge";
import { useAdminContext } from "./context";
import type { CategoryDefinition } from "../types/content";

type CategoryGroup = "articles" | "pictures";

function slugify(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}

function CategorySection({
  title,
  group,
  categories,
  onCreate,
  pending,
}: {
  title: string;
  group: CategoryGroup;
  categories: CategoryDefinition[];
  onCreate: (group: CategoryGroup, slug: string, name: string) => void;
  pending: boolean;
}) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const errors = [
    ...(slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? ["Slug 只能包含小写字母、数字和连字符"] : []),
    ...(categories.some((category) => category.slug === slug) ? ["Slug 已存在"] : []),
    ...(categories.some((category) => category.name === name.trim()) ? ["名称已存在"] : []),
  ];

  return <section className="min-w-0">
    <div className="flex items-center justify-between gap-3 border-b border-base-300 pb-3"><h2 className="text-lg font-semibold">{title}</h2><span className="text-xs text-base-content/55">{categories.length} 个</span></div>
    <div className="mt-3 overflow-x-auto border border-base-300 bg-base-100">
      <table className="table table-sm min-w-[420px]"><thead><tr><th>名称</th><th>Slug</th><th className="text-right">排序</th></tr></thead><tbody>{categories.map((category) => <tr key={category.slug}><td className="font-medium">{category.name}</td><td className="font-mono text-xs">{category.slug}</td><td className="text-right tabular-nums">{category.order}</td></tr>)}</tbody></table>
    </div>
    <form className="mt-4 grid gap-3 border-t border-base-300 pt-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); if (errors.length === 0) onCreate(group, slug, name.trim()); }}>
      <label className="admin-field"><span>名称</span><input className="input input-sm w-full rounded-md" maxLength={40} value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label className="admin-field"><span>Slug</span><input className="input input-sm w-full rounded-md font-mono" maxLength={64} value={slug} onChange={(event) => setSlug(slugify(event.target.value))} /></label>
      <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1 sm:col-span-2"><button className="btn btn-primary btn-sm rounded-md" type="submit" disabled={pending || !slug || !name.trim() || errors.length > 0}>{pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}创建分类</button>{errors.map((error) => <span key={error} className="text-xs text-error">{error}</span>)}</div>
    </form>
  </section>;
}

export default function CategoryDashboard() {
  const { session } = useAdminContext();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin-category-state"], queryFn: getCategoryState });
  const [message, setMessage] = useState("");
  const [commit, setCommit] = useState<{ sha: string; url: string } | null>(null);
  const mutation = useMutation({
    mutationFn: ({ group, slug, name }: { group: CategoryGroup; slug: string; name: string }) => createCategory(session.csrfToken, { group, category: { slug, name }, expectedSha: query.data!.sha }),
    onSuccess: (result) => {
      queryClient.setQueryData(["admin-category-state"], { categories: result.categories, sha: result.categorySha });
      queryClient.setQueryData(["categories"], result.categories);
      setCommit({ sha: result.commitSha, url: result.commitUrl });
      setMessage("分类已提交");
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "分类创建失败"),
  });

  if (query.isLoading) return <main className="grid min-h-[60vh] place-items-center">正在读取分类...</main>;
  if (query.isError || !query.data) return <main className="p-8 text-center text-error">分类读取失败：{query.error instanceof Error ? query.error.message : "未知错误"}</main>;
  const create = (group: CategoryGroup, slug: string, name: string) => { setMessage(""); mutation.mutate({ group, slug, name }); };

  return <main className="mx-auto w-full max-w-screen-xl px-4 py-6 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="flex items-center gap-2 text-2xl font-semibold"><Tags className="h-5 w-5 text-primary" />分类</h1><p className="mt-1 text-sm text-base-content/60">文章 {query.data.categories.articles.length} 个 · 照片 {query.data.categories.pictures.length} 个</p></div>{commit && <div className="flex items-center gap-2"><a className="btn btn-ghost btn-xs rounded" href={commit.url} target="_blank" rel="noreferrer">Commit <ExternalLink className="h-3 w-3" /></a><DeploymentBadge commitSha={commit.sha} /></div>}</div>
    {message && <p className={`mt-3 text-sm ${mutation.isError ? "text-error" : "text-base-content/65"}`}>{message}</p>}
    <div className="mt-6 grid gap-8 lg:grid-cols-2">
      <CategorySection key={`articles-${query.data.categories.articles.length}`} title="文章分类" group="articles" categories={query.data.categories.articles} onCreate={create} pending={mutation.isPending} />
      <CategorySection key={`pictures-${query.data.categories.pictures.length}`} title="照片分类" group="pictures" categories={query.data.categories.pictures} onCreate={create} pending={mutation.isPending} />
    </div>
    {mutation.isPending && <p className="mt-5 flex items-center gap-2 text-sm text-base-content/65"><CloudUpload className="h-4 w-4" />正在提交到生产分支</p>}
  </main>;
}
