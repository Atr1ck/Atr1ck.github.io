import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import localforage from "localforage";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  CloudUpload,
  ExternalLink,
  FileInput,
  ImagePlus,
  LoaderCircle,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import MarkdownRenderer from "../components/Articles/MarkdownRenderer";
import { getArticle, getCategories, getDeployment, publishArticle, redeploy } from "./api";
import { processImage, selectedImagePayload } from "./image-processing";
import type { ProcessedImage } from "./image-processing";
import { useAdminContext } from "./context";
import { parseFrontmatter, stringifyFrontmatter } from "./frontmatter";
import {
  MAX_MARKDOWN_BYTES,
  MAX_PUBLISH_ASSET_BYTES,
  MAX_PUBLISH_REQUEST_BYTES,
  MAX_TOTAL_ASSET_BYTES,
} from "../../shared/publish-limits";

interface EditorFields {
  title: string;
  slug: string;
  category: string;
  date: string;
  updated: string;
  tags: string;
  summary: string;
  cover: string;
  published: boolean;
  content: string;
}

interface EditorDraft {
  fields: EditorFields;
  expectedSha: string | null;
  images: ProcessedImage[];
}

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY_FIELDS: EditorFields = {
  title: "",
  slug: "",
  category: "uncategorized",
  date: today(),
  updated: today(),
  tags: "",
  summary: "",
  cover: "",
  published: true,
  content: "",
};

function dateString(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return typeof value === "string" ? value : "";
}

function fieldsFromMarkdown(markdown: string): EditorFields {
  const parsed = parseFrontmatter(markdown);
  return {
    title: typeof parsed.data.title === "string" ? parsed.data.title : "",
    slug: typeof parsed.data.slug === "string" ? parsed.data.slug : "",
    category: typeof parsed.data.category === "string" ? parsed.data.category : "uncategorized",
    date: dateString(parsed.data.date) || today(),
    updated: dateString(parsed.data.updated) || today(),
    tags: Array.isArray(parsed.data.tags) ? parsed.data.tags.join(", ") : "",
    summary: typeof parsed.data.summary === "string" ? parsed.data.summary : "",
    cover: typeof parsed.data.cover === "string" ? parsed.data.cover : "",
    published: parsed.data.published !== false,
    content: parsed.content.trimStart(),
  };
}

function createMarkdown(fields: EditorFields): string {
  return stringifyFrontmatter(fields.content.trimStart(), {
    title: fields.title.trim(),
    slug: fields.slug.trim(),
    category: fields.category,
    date: fields.date,
    updated: fields.updated,
    tags: fields.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
    summary: fields.summary.trim(),
    cover: fields.cover.trim() || null,
    published: fields.published,
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function uniqueName(name: string, existing: Set<string>): string {
  if (!existing.has(name)) return name;
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : "";
  let index = 2;
  while (existing.has(`${base}-${index}${extension}`)) index += 1;
  return `${base}-${index}${extension}`;
}

export default function ArticleEditor() {
  const { slug: routeSlug } = useParams<{ slug: string }>();
  const isNew = !routeSlug;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = useAdminContext();
  const [fields, setFields] = useState<EditorFields>(EMPTY_FIELDS);
  const [expectedSha, setExpectedSha] = useState<string | null>(null);
  const [images, setImages] = useState<ProcessedImage[]>([]);
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [commit, setCommit] = useState<{ sha: string; url: string } | null>(null);
  const [mobileMode, setMobileMode] = useState<"source" | "preview">("source");
  const initialized = useRef(false);
  const publishedSnapshot = useRef<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const articleQuery = useQuery({
    queryKey: ["admin-article", routeSlug],
    queryFn: () => getArticle(routeSlug!),
    enabled: !isNew,
  });
  const categoriesQuery = useQuery({ queryKey: ["categories"], queryFn: getCategories });

  const draftKey = `atr1ck-admin-draft:${routeSlug || "new"}`;
  useEffect(() => {
    if (initialized.current || (!isNew && !articleQuery.data)) return;
    void (async () => {
      const indexedDraft = await localforage.getItem<EditorDraft>(draftKey);
      const legacyDraft = localStorage.getItem(draftKey);
      if (indexedDraft) {
        setFields(indexedDraft.fields);
        setExpectedSha(indexedDraft.expectedSha);
        setImages(indexedDraft.images || []);
        setMessage("已恢复本地草稿");
      } else if (legacyDraft) {
        try {
          const parsed = JSON.parse(legacyDraft) as EditorDraft;
          setFields(parsed.fields);
          setExpectedSha(parsed.expectedSha);
          setImages(parsed.images || []);
          setMessage("已恢复本地草稿");
          localStorage.removeItem(draftKey);
        } catch {
          localStorage.removeItem(draftKey);
        }
      } else if (articleQuery.data) {
        setFields(fieldsFromMarkdown(articleQuery.data.markdown));
        setExpectedSha(articleQuery.data.sha);
      } else {
        setFields({ ...EMPTY_FIELDS, date: today(), updated: today() });
      }
      initialized.current = true;
    })();
  }, [articleQuery.data, draftKey, isNew]);

  useEffect(() => {
    if (!initialized.current) return;
    if (publishedSnapshot.current === JSON.stringify(fields)) {
      localStorage.removeItem(draftKey);
      void localforage.removeItem(draftKey);
      return;
    }
    const timer = window.setTimeout(() => {
      void localforage.setItem<EditorDraft>(draftKey, { fields, expectedSha, images });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [draftKey, expectedSha, fields, images]);

  const addFiles = useCallback(async (files: File[], insertMarkdown = true) => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fields.slug)) {
      setMessage("请先设置有效的 slug，再添加图片");
      return;
    }
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    setMessage("正在处理图片...");
    try {
      const processed = await Promise.all(imageFiles.map(processImage));
      setImages((current) => {
        const names = new Set(current.flatMap((image) => [image.originalName, image.compressedName].filter(Boolean) as string[]));
        const renamed = processed.map((image) => {
          const originalName = uniqueName(image.originalName, names);
          names.add(originalName);
          const compressedName = image.compressedName ? uniqueName(image.compressedName, names) : null;
          if (compressedName) names.add(compressedName);
          return { ...image, originalName, compressedName };
        });
        if (insertMarkdown && fields.slug) {
          const markdown = renamed.map((image) => {
            const payload = selectedImagePayload(image);
            return `![${image.originalName}](/articles/images/${fields.slug}/${payload.name})`;
          }).join("\n");
          setFields((value) => ({ ...value, content: `${value.content}${value.content.endsWith("\n") || !value.content ? "" : "\n"}${markdown}\n` }));
        }
        return [...current, ...renamed];
      });
      setMessage(`${processed.length} 张图片已处理`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "图片处理失败");
    }
  }, [fields.slug]);

  const selectedImages = useMemo(
    () => images.map((image) => ({ image, payload: selectedImagePayload(image) })),
    [images],
  );
  const totalImageBytes = selectedImages.reduce((total, item) => total + item.payload.size, 0);
  const publishMarkdown = useMemo(
    () => createMarkdown({ ...fields, updated: today() }),
    [fields],
  );
  const publishPayload = useMemo(() => ({
    slug: fields.slug,
    markdown: publishMarkdown,
    expectedSha,
    assets: selectedImages.map(({ payload }) => ({
      path: `public/articles/images/${fields.slug}/${payload.name}`,
      contentBase64: payload.contentBase64,
      preserveOriginal: payload.preserveOriginal,
    })),
  }), [expectedSha, fields.slug, publishMarkdown, selectedImages]);
  const publishRequestBytes = useMemo(
    () => new TextEncoder().encode(JSON.stringify(publishPayload)).byteLength,
    [publishPayload],
  );
  const errors = useMemo(() => {
    const result: string[] = [];
    if (!fields.title.trim()) result.push("标题不能为空");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fields.slug)) result.push("slug 只能包含小写字母、数字和连字符");
    if (!categoriesQuery.data?.articles.some((category) => category.slug === fields.category)) result.push("请选择有效的文章分类");
    if (fields.summary.trim().length > 240) result.push("摘要不能超过 240 字符");
    if (!fields.content.trim()) result.push("正文不能为空");
    if (new TextEncoder().encode(publishMarkdown).byteLength > MAX_MARKDOWN_BYTES) result.push("Markdown 不能超过 256KB");
    if (selectedImages.some(({ payload }) => payload.size > MAX_PUBLISH_ASSET_BYTES)) result.push("单张提交图片不能超过 2.75MB");
    if (totalImageBytes > MAX_TOTAL_ASSET_BYTES) result.push("单次发布图片总大小不能超过 2.75MB");
    if (publishRequestBytes > MAX_PUBLISH_REQUEST_BYTES) result.push("发布请求不能超过 4MB，请压缩或移除图片");
    if (fields.cover && !fields.cover.startsWith(`/articles/images/${fields.slug}/`)) result.push("封面必须使用当前文章图片目录");
    return result;
  }, [categoriesQuery.data, fields, publishMarkdown, publishRequestBytes, selectedImages, totalImageBytes]);

  const publishMutation = useMutation({
    mutationFn: () => publishArticle(session.csrfToken, publishPayload),
    onSuccess: async (result) => {
      publishedSnapshot.current = JSON.stringify(fields);
      localStorage.removeItem(draftKey);
      await localforage.removeItem(draftKey);
      setConfirming(false);
      setCommit({ sha: result.commitSha, url: result.commitUrl });
      setMessage("已提交，正在等待 Vercel 部署");
      setExpectedSha(result.articleSha);
      await queryClient.invalidateQueries({ queryKey: ["admin-articles"] });
      if (isNew) navigate(`/admin/articles/${fields.slug}`, { replace: true });
    },
    onError: (error) => {
      setConfirming(false);
      setMessage(error instanceof Error ? error.message : "发布失败");
    },
  });

  const deploymentQuery = useQuery({
    queryKey: ["deployment", commit?.sha],
    queryFn: () => getDeployment(commit!.sha),
    enabled: Boolean(commit),
    refetchInterval: (query) => query.state.data?.found && ["READY", "ERROR", "CANCELED"].includes(query.state.data.state || "") ? false : 4_000,
  });

  if (!isNew && articleQuery.isLoading) return <main className="grid min-h-[60vh] place-items-center">正在读取文章...</main>;
  if (!isNew && articleQuery.isError) {
    return (
      <main className="p-8 text-center text-error">
        <p>文章读取失败或已发生权限变化</p>
        <p className="mt-2 text-sm">{articleQuery.error instanceof Error ? articleQuery.error.message : "未知错误"}</p>
      </main>
    );
  }

  const update = <K extends keyof EditorFields>(key: K, value: EditorFields[K]) => {
    publishedSnapshot.current = null;
    setFields((current) => ({ ...current, [key]: value }));
  };

  const changeSlug = (slug: string) => {
    const previousSlug = fields.slug;
    update("slug", slug);
    if (previousSlug && previousSlug !== slug) {
      setFields((current) => ({
        ...current,
        content: current.content.split(`/articles/images/${previousSlug}/`).join(`/articles/images/${slug}/`),
        cover: current.cover.replace(`/articles/images/${previousSlug}/`, `/articles/images/${slug}/`),
      }));
    }
  };

  const toggleOriginal = (image: ProcessedImage, preserveOriginal: boolean) => {
    const oldPayload = selectedImagePayload(image);
    const changed = { ...image, preserveOriginal };
    const newPayload = selectedImagePayload(changed);
    setImages((all) => all.map((item) => item.id === image.id ? changed : item));
    if (fields.slug && oldPayload.name !== newPayload.name) {
      const oldPath = `/articles/images/${fields.slug}/${oldPayload.name}`;
      const newPath = `/articles/images/${fields.slug}/${newPayload.name}`;
      setFields((current) => ({
        ...current,
        content: current.content.split(oldPath).join(newPath),
        cover: current.cover === oldPath ? newPath : current.cover,
      }));
    }
  };

  const removeImage = (image: ProcessedImage) => {
    const path = fields.slug ? `/articles/images/${fields.slug}/${selectedImagePayload(image).name}` : "";
    setImages((all) => all.filter((item) => item.id !== image.id));
    if (path) {
      setFields((current) => ({
        ...current,
        content: current.content.replace(new RegExp(`^!?\\[[^\\]]*\\]\\(${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)\\n?`, "gm"), ""),
        cover: current.cover === path ? "" : current.cover,
      }));
    }
  };

  return (
    <main className="mx-auto w-full max-w-screen-2xl px-3 py-4 sm:px-6 sm:py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-base-300 pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link className="btn btn-ghost btn-sm rounded-md" to="/admin" title="返回文章列表"><ArrowLeft className="h-4 w-4" /></Link>
          <div className="min-w-0"><h1 className="truncate text-xl font-semibold">{isNew ? "新建文章" : fields.title || routeSlug}</h1><p className="mt-0.5 truncate font-mono text-xs text-base-content/50">{fields.slug || "尚未设置 slug"}</p></div>
        </div>
        <div className="flex items-center gap-2">
          <input ref={importRef} className="hidden" type="file" accept=".md,text/markdown" onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
              const imported = fieldsFromMarkdown(await file.text());
              setFields({ ...imported, slug: routeSlug || imported.slug });
              setImages([]);
              publishedSnapshot.current = null;
              setMessage(`已导入 ${file.name}${routeSlug && imported.slug !== routeSlug ? "，已保留原 slug" : ""}`);
            } catch {
              setMessage("Markdown Frontmatter 解析失败");
            }
            event.target.value = "";
          }} />
          <button className="btn btn-ghost btn-sm rounded-md" aria-label="导入 Markdown" title="导入 Markdown" onClick={() => importRef.current?.click()}><FileInput className="h-4 w-4" /> <span className="hidden sm:inline">导入 MD</span></button>
          <button className="btn btn-primary btn-sm rounded-md" disabled={errors.length > 0 || publishMutation.isPending} onClick={() => setConfirming(true)}>
            {publishMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />} {fields.published ? "发布" : "下线"}
          </button>
        </div>
      </div>

      {(message || errors.length > 0) && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm"><span className="text-base-content/65">{message}</span>{errors.map((error) => <span key={error} className="text-error">{error}</span>)}</div>}

      <section className="mt-4 grid gap-4 border-b border-base-300 pb-5 md:grid-cols-2 xl:grid-cols-4">
        <label className="admin-field"><span>标题</span><input className="input input-sm w-full rounded-md" value={fields.title} onChange={(event) => update("title", event.target.value)} /></label>
        <label className="admin-field"><span>Slug</span><input className="input input-sm w-full rounded-md font-mono" disabled={!isNew} value={fields.slug} onChange={(event) => changeSlug(event.target.value.toLowerCase())} /></label>
        <label className="admin-field"><span>发布日期</span><input className="input input-sm w-full rounded-md" type="date" value={fields.date} onChange={(event) => update("date", event.target.value)} /></label>
        <label className="admin-field"><span>分类</span><select className="select select-sm w-full rounded-md" value={fields.category} onChange={(event) => update("category", event.target.value)}>{categoriesQuery.data?.articles.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}</select></label>
        <label className="admin-field"><span>可见性</span><span className="flex h-8 items-center gap-2"><input className="toggle toggle-sm" type="checkbox" checked={fields.published} onChange={(event) => update("published", event.target.checked)} />{fields.published ? "公开" : "下线"}</span></label>
        <label className="admin-field md:col-span-2"><span>标签（逗号分隔）</span><input className="input input-sm w-full rounded-md" value={fields.tags} onChange={(event) => update("tags", event.target.value)} /></label>
        <label className="admin-field md:col-span-2"><span>摘要（可选） <small>{fields.summary.length}/240</small></span><input className="input input-sm w-full rounded-md" maxLength={240} value={fields.summary} onChange={(event) => update("summary", event.target.value)} /></label>
        <label className="admin-field md:col-span-2 xl:col-span-4"><span>封面路径（可选）</span><input className="input input-sm w-full rounded-md font-mono" placeholder={`/articles/images/${fields.slug || "slug"}/cover.webp`} value={fields.cover} onChange={(event) => update("cover", event.target.value)} /></label>
      </section>

      <div className="mt-4 flex md:hidden"><div className="join w-full">{(["source", "preview"] as const).map((mode) => <button key={mode} className={`btn btn-sm join-item flex-1 rounded-md ${mobileMode === mode ? "btn-neutral" : "btn-ghost"}`} onClick={() => setMobileMode(mode)}>{mode === "source" ? "源码" : "预览"}</button>)}</div></div>
      <section className="mt-3 grid h-[clamp(560px,calc(100vh-12rem),780px)] border border-base-300 bg-base-100 md:grid-cols-2">
        <div className={`${mobileMode === "preview" ? "hidden" : "flex"} min-w-0 flex-col overflow-hidden border-r border-base-300 md:flex`}>
          <div className="border-b border-base-300 px-3 py-2 text-xs font-medium text-base-content/55">MARKDOWN</div>
          <textarea
            className="min-h-0 grow resize-none bg-transparent p-4 font-mono text-sm leading-6 outline-none"
            value={fields.content}
            onChange={(event) => update("content", event.target.value)}
            onPaste={(event) => { const files = Array.from(event.clipboardData.files); if (files.length) { event.preventDefault(); void addFiles(files); } }}
            onDrop={(event) => { const files = Array.from(event.dataTransfer.files); if (files.some((file) => file.type.startsWith("image/"))) { event.preventDefault(); void addFiles(files); } }}
            onDragOver={(event) => event.preventDefault()}
          />
        </div>
        <div className={`${mobileMode === "source" ? "hidden" : "block"} min-w-0 overflow-auto md:block`}>
          <div className="sticky top-0 z-10 border-b border-base-300 bg-base-100 px-3 py-2 text-xs font-medium text-base-content/55">实时预览</div>
          <article className="article-markdown prose max-w-none p-4 sm:p-6"><MarkdownRenderer content={fields.content} /></article>
        </div>
      </section>

      <section className="mt-5 border-t border-base-300 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">文章图片</h2><p className="mt-1 text-xs text-base-content/55">图片 {formatBytes(totalImageBytes)} / 2.75 MB · 请求 {formatBytes(publishRequestBytes)} / 4 MB</p></div><label className="btn btn-ghost btn-sm rounded-md"><ImagePlus className="h-4 w-4" /> 添加图片<input className="hidden" type="file" accept="image/*" multiple onChange={(event) => { void addFiles(Array.from(event.target.files || [])); event.target.value = ""; }} /></label></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {images.map((image) => {
            const payload = selectedImagePayload(image);
            const publicPath = fields.slug ? `/articles/images/${fields.slug}/${payload.name}` : "";
            return <div key={image.id} className="flex gap-3 border border-base-300 bg-base-100 p-3">
              <img className="h-20 w-20 shrink-0 object-cover" src={image.previewUrl} alt="" />
              <div className="min-w-0 grow"><p className="truncate text-sm font-medium" title={payload.name}>{payload.name}</p><p className="mt-1 text-xs text-base-content/55">{formatBytes(image.originalSize)} → {formatBytes(payload.size)}</p>{image.warning && <p className="mt-1 text-xs text-warning">{image.warning}</p>}{payload.size > MAX_PUBLISH_ASSET_BYTES && <p className="mt-1 text-xs text-error">当前版本超过 2.75MB，无法经 Vercel 发布</p>}<div className="mt-2 flex flex-wrap items-center gap-2"><label className="flex items-center gap-1 text-xs"><input type="checkbox" className="checkbox checkbox-xs" checked={image.preserveOriginal} disabled={!image.compressedBase64} onChange={(event) => toggleOriginal(image, event.target.checked)} />保留原图</label><button className="btn btn-ghost btn-xs rounded" disabled={!publicPath} onClick={() => update("cover", publicPath)}>{fields.cover === publicPath ? <Check className="h-3 w-3" /> : null}封面</button><button className="btn btn-ghost btn-xs rounded" title="移除" onClick={() => removeImage(image)}><Trash2 className="h-3 w-3" /></button></div></div>
            </div>;
          })}
          {images.length === 0 && <div className="border border-dashed border-base-300 px-4 py-8 text-center text-sm text-base-content/50 sm:col-span-2 xl:col-span-3" onDrop={(event) => { event.preventDefault(); void addFiles(Array.from(event.dataTransfer.files)); }} onDragOver={(event) => event.preventDefault()}>拖拽、粘贴或选择图片</div>}
        </div>
      </section>

      {commit && (
        <section className="mt-5 border-t border-base-300 pt-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-semibold">部署状态</h2>
            <a className="btn btn-ghost btn-xs rounded" href={commit.url} target="_blank" rel="noreferrer">Commit <ExternalLink className="h-3 w-3" /></a>
            {deploymentQuery.data?.found && (
              <a className="btn btn-ghost btn-xs rounded" href={deploymentQuery.data.inspectorUrl || deploymentQuery.data.deploymentUrl} target="_blank" rel="noreferrer">Deployment <ExternalLink className="h-3 w-3" /></a>
            )}
            {deploymentQuery.data?.durationMs != null && <span className="text-xs text-base-content/55">{(deploymentQuery.data.durationMs / 1000).toFixed(1)} 秒</span>}
          </div>
          {deploymentQuery.isLoading || !deploymentQuery.data?.found ? (
            <p className="mt-3 flex items-center gap-2 text-sm"><LoaderCircle className="h-4 w-4 animate-spin" /> 已提交，正在等待 Vercel 部署</p>
          ) : deploymentQuery.data.state === "READY" ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-success"><Check className="h-4 w-4" /> 发布成功 <a className="btn btn-success btn-xs rounded" href={`/articles/${fields.slug}`} target="_blank">打开文章</a></div>
          ) : ["ERROR", "CANCELED"].includes(deploymentQuery.data.state || "") ? (
            <div className="mt-3 text-sm text-error">
              <p className="flex items-center gap-2"><CircleAlert className="h-4 w-4" />部署失败</p>
              {deploymentQuery.data.errorSummary && <pre className="mt-2 max-h-48 overflow-auto bg-neutral p-3 text-xs text-neutral-content">{deploymentQuery.data.errorSummary}</pre>}
              <button className="btn btn-error btn-sm mt-3 rounded-md" onClick={() => deploymentQuery.data?.deploymentId && redeploy(session.csrfToken, deploymentQuery.data.deploymentId).then(() => deploymentQuery.refetch())}><RefreshCw className="h-4 w-4" />重新部署</button>
            </div>
          ) : (
            <p className="mt-3 flex items-center gap-2 text-sm"><LoaderCircle className="h-4 w-4 animate-spin" />{deploymentQuery.data.state || "部署中"}</p>
          )}
        </section>
      )}

      {confirming && <div className="fixed inset-0 z-[200] grid place-items-center bg-black/55 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-md bg-base-100 p-6 shadow-xl"><h2 className="text-lg font-semibold">确认{fields.published ? "发布" : "下线"}</h2><dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm"><dt className="text-base-content/55">文章</dt><dd>{fields.title}</dd><dt className="text-base-content/55">Slug</dt><dd className="font-mono">{fields.slug}</dd><dt className="text-base-content/55">图片</dt><dd>{images.length} 张 / {formatBytes(totalImageBytes)}</dd><dt className="text-base-content/55">请求体</dt><dd>{formatBytes(publishRequestBytes)}</dd><dt className="text-base-content/55">提交</dt><dd>直接写入生产分支</dd></dl>{images.some((image) => image.preserveOriginal) && <p className="mt-4 text-sm text-warning">包含未压缩原图，请确认体积可接受。</p>}<div className="mt-6 flex justify-end gap-2"><button className="btn btn-ghost btn-sm rounded-md" onClick={() => setConfirming(false)}>取消</button><button className="btn btn-primary btn-sm rounded-md" onClick={() => publishMutation.mutate()}>确认提交</button></div></div></div>}
    </main>
  );
}
