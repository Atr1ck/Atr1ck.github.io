import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Search, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import type { CategoryConfig, PictureIndex, PictureItem } from "../../types/content";
import Loading from "../Load/Load";

function assetUrl(path: string) {
  return `/pictures/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function PictureCard({ picture, categoryName }: { picture: PictureItem; categoryName: string }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <article className="mb-4 inline-block w-full break-inside-avoid overflow-hidden rounded-lg border border-base-300 bg-base-100 text-base-content transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <button className="block w-full" onClick={() => setOpen(true)} aria-label={`预览 ${picture.title}`}>
        <img src={assetUrl(picture.preview)} className={`block h-auto w-full transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`} alt={picture.title} onLoad={() => setLoaded(true)} loading="lazy" decoding="async" />
      </button>
      <div className="px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="min-w-0 truncate text-sm font-medium" title={picture.title}>{picture.title}</h2>
          <span className="shrink-0 text-xs text-primary">{categoryName}</span>
        </div>
        {picture.tags.length > 0 && <div className="mt-1 flex flex-wrap gap-x-2">{picture.tags.map((tag) => <span key={tag} className="text-xs text-base-content/60">#{tag}</span>)}</div>}
      </div>
      {open && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className="relative max-h-full max-w-5xl rounded-lg bg-base-100 p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <img src={assetUrl(picture.file)} alt={picture.title} className="max-h-[78vh] max-w-full rounded-md object-contain" />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-sm">{picture.title}</span>
              <a href={assetUrl(picture.file)} download className="btn btn-primary btn-sm rounded-md"><Download className="h-4 w-4" />下载</a>
            </div>
            <button type="button" aria-label="关闭图片预览" className="btn btn-circle btn-sm absolute right-2 top-2 border-0 bg-black/60 text-white hover:bg-black/80" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </article>
  );
}

async function loadPictures() {
  const [picturesResponse, categoriesResponse] = await Promise.all([
    fetch("/json/pictures.json"),
    fetch("/json/categories.json"),
  ]);
  if (!picturesResponse.ok || !categoriesResponse.ok) throw new Error("Failed to load pictures");
  return {
    index: await picturesResponse.json() as PictureIndex,
    categories: await categoriesResponse.json() as CategoryConfig,
  };
}

export default function Imageshow() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useQuery({ queryKey: ["pictures"], queryFn: loadPictures });
  const category = searchParams.get("category") || "all";
  const tag = searchParams.get("tag") || "all";
  const search = searchParams.get("q") || "";
  const allPictures = useMemo(() => query.data?.index.pictures || [], [query.data]);
  const tags = useMemo(() => [...new Set(allPictures.flatMap((picture) => picture.tags))].sort((a, b) => a.localeCompare(b, "zh-CN")), [allPictures]);
  const pictures = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allPictures.filter((picture) =>
      (category === "all" || picture.category === category) &&
      (tag === "all" || picture.tags.includes(tag)) &&
      (!term || [picture.title, picture.category, ...picture.tags].some((value) => value.toLowerCase().includes(term))),
    );
  }, [allPictures, category, search, tag]);
  const categoryNames = new Map(query.data?.categories.pictures.map((item) => [item.slug, item.name]) || []);

  const updateFilter = (key: "category" | "tag" | "q", value: string) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    setSearchParams(next);
  };

  if (query.isLoading) return <Loading />;
  if (query.isError) return <div className="p-8 text-center">照片加载失败</div>;

  return (
    <main className="w-full">
      <div className="border-b border-base-300/70 bg-base-100/90 px-3 py-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-screen-2xl flex-col gap-2 sm:flex-row sm:items-center">
          <label className="input input-sm flex min-w-0 flex-1 items-center gap-2 rounded-md bg-base-100"><Search className="h-4 w-4 opacity-55" /><input value={search} onChange={(event) => updateFilter("q", event.target.value)} placeholder="搜索照片" /></label>
          <select className="select select-sm rounded-md" aria-label="照片分类" value={category} onChange={(event) => updateFilter("category", event.target.value)}><option value="all">全部分类</option>{query.data?.categories.pictures.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select>
          <select className="select select-sm rounded-md" aria-label="照片标签" value={tag} onChange={(event) => updateFilter("tag", event.target.value)}><option value="all">全部标签</option>{tags.map((item) => <option key={item} value={item}>#{item}</option>)}</select>
          <span className="shrink-0 text-xs text-base-content/55">{pictures.length} 张</span>
        </div>
      </div>
      <div className="columns-2 gap-3 px-2 pt-5 md:columns-3 md:gap-4 xl:columns-4">
        {pictures.map((picture) => <PictureCard key={picture.id} picture={picture} categoryName={categoryNames.get(picture.category) || "未分类"} />)}
      </div>
      {pictures.length === 0 && <p className="py-16 text-center text-sm text-base-content/55">没有符合条件的照片</p>}
    </main>
  );
}
