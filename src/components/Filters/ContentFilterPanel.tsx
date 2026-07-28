import { useEffect, useState } from "react";
import { RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";

interface FilterOption {
  slug: string;
  name: string;
}

interface ContentFilterPanelProps {
  category: string;
  categories: FilterOption[];
  count: number;
  countLabel: string;
  search: string;
  searchPlaceholder: string;
  tag: string;
  tags: string[];
  onChange: (key: "category" | "tag" | "q", value: string) => void;
  onReset: () => void;
  desktopClassName?: string;
}

export default function ContentFilterPanel({
  category,
  categories,
  count,
  countLabel,
  search,
  searchPlaceholder,
  tag,
  tags,
  onChange,
  onReset,
  desktopClassName = "",
}: ContentFilterPanelProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeCount = Number(Boolean(search.trim())) + Number(category !== "all") + Number(tag !== "all");

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileOpen]);

  const panel = (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">筛选</h2>
          <p className="mt-0.5 text-xs text-base-content/55">共 {count} {countLabel}</p>
        </div>
        {activeCount > 0 && (
          <button type="button" className="btn btn-ghost btn-xs rounded" onClick={onReset}>
            <RotateCcw className="h-3.5 w-3.5" />重置
          </button>
        )}
      </div>

      <label className="admin-field">
        <span>搜索</span>
        <span className="input input-sm flex w-full items-center gap-2 rounded-md bg-base-100">
          <Search className="h-4 w-4 shrink-0 opacity-55" />
          <input className="min-w-0" value={search} onChange={(event) => onChange("q", event.target.value)} placeholder={searchPlaceholder} />
        </span>
      </label>

      <label className="admin-field">
        <span>分类</span>
        <select className="select select-sm w-full rounded-md" value={category} onChange={(event) => onChange("category", event.target.value)}>
          <option value="all">全部分类</option>
          {categories.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
        </select>
      </label>

      <label className="admin-field">
        <span>标签</span>
        <select className="select select-sm w-full rounded-md" value={tag} onChange={(event) => onChange("tag", event.target.value)}>
          <option value="all">全部标签</option>
          {tags.map((item) => <option key={item} value={item}>#{item}</option>)}
        </select>
      </label>
    </div>
  );

  return (
    <>
      <aside className={`hidden lg:block ${desktopClassName}`}>
        <div className="sticky top-20 rounded-lg border border-base-300/70 bg-base-100/95 p-5 text-base-content shadow-sm backdrop-blur-md">
          {panel}
        </div>
      </aside>

      <button
        type="button"
        className="btn btn-primary fixed bottom-4 right-4 z-[70] rounded-md shadow-lg lg:hidden"
        aria-label="打开筛选"
        onClick={() => setMobileOpen(true)}
      >
        <SlidersHorizontal className="h-4 w-4" />筛选
        {activeCount > 0 && <span className="badge badge-sm border-0 bg-primary-content text-primary">{activeCount}</span>}
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-[95] flex items-end bg-black/45 lg:hidden" role="dialog" aria-modal="true" aria-label="内容筛选" onClick={() => setMobileOpen(false)}>
          <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-lg bg-base-100 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex justify-end">
              <button type="button" className="btn btn-circle btn-ghost btn-sm" aria-label="关闭筛选" onClick={() => setMobileOpen(false)}><X className="h-4 w-4" /></button>
            </div>
            {panel}
            <button type="button" className="btn btn-primary mt-6 w-full rounded-md" onClick={() => setMobileOpen(false)}>查看结果</button>
          </div>
        </div>
      )}
    </>
  );
}
