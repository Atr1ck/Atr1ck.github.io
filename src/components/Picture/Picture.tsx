import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import type { CategoryConfig, PictureIndex, PictureItem } from "../../types/content";
import ContentFilterPanel from "../Filters/ContentFilterPanel";
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
  const resetFilters = () => {
    const next = new URLSearchParams(searchParams);
    ["category", "tag", "q"].forEach((key) => next.delete(key));
    setSearchParams(next);
  };

  if (query.isLoading) return <Loading />;
  if (query.isError) return <div className="p-8 text-center">照片加载失败</div>;

  return (
    <main className="relative w-full px-2 py-4 sm:px-4 sm:py-6 lg:px-6">
      <div className="pointer-events-none fixed right-12 top-20 z-30 hidden w-64 lg:block">
        <div className="pointer-events-auto">
          <ContentFilterPanel
            category={category}
            categories={query.data?.categories.pictures || []}
            count={pictures.length}
            countLabel="张照片"
            search={search}
            searchPlaceholder="搜索照片"
            tag={tag}
            tags={tags}
            onChange={updateFilter}
            onReset={resetFilters}
            desktopClassName="w-full"
          />
        </div>
      </div>
      <div className="lg:hidden">
        <ContentFilterPanel
          category={category}
          categories={query.data?.categories.pictures || []}
          count={pictures.length}
          countLabel="张照片"
          search={search}
          searchPlaceholder="搜索照片"
          tag={tag}
          tags={tags}
          onChange={updateFilter}
          onReset={resetFilters}
        />
      </div>
      <div className="mx-auto min-w-0 max-w-4xl">
        <div className="columns-2 gap-3 md:columns-3 md:gap-4 xl:columns-4">
          {pictures.map((picture) => <PictureCard key={picture.id} picture={picture} categoryName={categoryNames.get(picture.category) || "未分类"} />)}
        </div>
        {pictures.length === 0 && <p className="py-16 text-center text-sm text-base-content/55">没有符合条件的照片</p>}
      </div>
    </main>
  );
}
