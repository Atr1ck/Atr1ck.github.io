import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import localforage from "localforage";
import { ArrowLeft, Check, CircleAlert, CloudUpload, ExternalLink, ImagePlus, LoaderCircle, RefreshCw } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  MAX_PUBLISH_ASSET_BYTES,
  MAX_PUBLISH_REQUEST_BYTES,
  MAX_TOTAL_ASSET_BYTES,
} from "../../shared/publish-limits";
import { getDeployment, listPictures, listTagSuggestions, publishPicture, redeploy } from "./api";
import { processImage } from "./image-processing";
import type { ProcessedImage } from "./image-processing";
import { useAdminContext } from "./context";
import type { AdminPicture } from "./types";
import TagInput from "./TagInput";
import { normalizeTagList } from "../../shared/tags";

interface PictureDraft { fields: AdminPicture; image: ProcessedImage | null; expectedManifestSha: string; }
interface PreparedAsset { path: string; contentBase64: string; preserveOriginal: boolean; size: number; }

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY_PICTURE: AdminPicture = { id: "", title: "", file: "", preview: "", tags: [], date: today(), published: true };

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function slugify(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}

export default function PictureEditor() {
  const { id: routeId } = useParams<{ id: string }>();
  const isNew = !routeId;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = useAdminContext();
  const [fields, setFields] = useState<AdminPicture>({ ...EMPTY_PICTURE });
  const [tags, setTags] = useState<string[]>([]);
  const [image, setImage] = useState<ProcessedImage | null>(null);
  const [expectedManifestSha, setExpectedManifestSha] = useState("");
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [commit, setCommit] = useState<{ sha: string; url: string } | null>(null);
  const initialized = useRef(false);
  const publishedSnapshot = useRef<string | null>(null);

  const picturesQuery = useQuery({ queryKey: ["admin-pictures"], queryFn: listPictures });
  const tagSuggestionsQuery = useQuery({ queryKey: ["tag-suggestions"], queryFn: listTagSuggestions });
  const draftKey = `atr1ck-picture-draft:${routeId || "new"}`;

  useEffect(() => {
    if (initialized.current || !picturesQuery.data) return;
    void (async () => {
      const draft = await localforage.getItem<PictureDraft>(draftKey);
      if (draft) {
        setFields(draft.fields);
        setTags(draft.fields.tags);
        setImage(draft.image);
        setExpectedManifestSha(draft.expectedManifestSha);
        setMessage("已恢复本地草稿");
      } else if (routeId) {
        const picture = picturesQuery.data.pictures.find((item) => item.id === routeId);
        if (picture) { setFields(picture); setTags(picture.tags); }
      }
      setExpectedManifestSha((current) => current || picturesQuery.data.manifestSha);
      initialized.current = true;
    })();
  }, [draftKey, picturesQuery.data, routeId]);

  useEffect(() => {
    if (!initialized.current) return;
    const draft = { fields: { ...fields, tags: normalizeTagList(tags) }, image, expectedManifestSha };
    if (publishedSnapshot.current === JSON.stringify(draft)) {
      void localforage.removeItem(draftKey);
      return;
    }
    const timer = window.setTimeout(() => void localforage.setItem<PictureDraft>(draftKey, draft), 500);
    return () => window.clearTimeout(timer);
  }, [draftKey, expectedManifestSha, fields, image, tags]);

  const prepared = useMemo(() => {
    if (!image || !fields.id) return { picture: { ...fields, tags: normalizeTagList(tags) }, assets: [] as PreparedAsset[] };
    const directory = fields.id;
    const hasCompressed = Boolean(image.compressedBase64 && image.compressedName && image.compressedSize != null);
    const compressedName = image.compressedName === image.originalName ? image.compressedName?.replace(/\.webp$/i, "-optimized.webp") : image.compressedName;
    const assets: PreparedAsset[] = [];
    if (image.preserveOriginal || !hasCompressed) assets.push({ path: `public/pictures/${directory}/${image.originalName}`, contentBase64: image.originalBase64, preserveOriginal: true, size: image.originalSize });
    if (hasCompressed) assets.push({ path: `public/pictures/${directory}/${compressedName}`, contentBase64: image.compressedBase64!, preserveOriginal: false, size: image.compressedSize! });
    const file = image.preserveOriginal || !hasCompressed ? `${directory}/${image.originalName}` : `${directory}/${compressedName}`;
    const preview = hasCompressed ? `${directory}/${compressedName}` : file;
    return { picture: { ...fields, file, preview, tags: normalizeTagList(tags) }, assets };
  }, [fields, image, tags]);
  const totalBytes = prepared.assets.reduce((sum, asset) => sum + asset.size, 0);
  const payload = useMemo(() => ({ picture: prepared.picture, expectedManifestSha, isNew, assets: prepared.assets.map((asset) => ({ path: asset.path, contentBase64: asset.contentBase64, preserveOriginal: asset.preserveOriginal })) }), [expectedManifestSha, isNew, prepared]);
  const requestBytes = useMemo(() => new TextEncoder().encode(JSON.stringify(payload)).byteLength, [payload]);
  const errors = useMemo(() => {
    const result: string[] = [];
    if (!fields.title.trim()) result.push("标题不能为空");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fields.id)) result.push("ID 只能包含小写字母、数字和连字符");
    if (isNew && picturesQuery.data?.pictures.some((picture) => picture.id === fields.id)) result.push("照片 ID 已存在");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.date)) result.push("请选择有效日期");
    if (!expectedManifestSha) result.push("照片清单尚未加载");
    if (isNew && !image) result.push("新照片必须上传图片");
    if (prepared.assets.some((asset) => asset.size > MAX_PUBLISH_ASSET_BYTES)) result.push("单个提交文件不能超过 2.75MB");
    if (totalBytes > MAX_TOTAL_ASSET_BYTES) result.push("提交文件总大小不能超过 2.75MB；保留原图时需确保原图与预览总和不超限");
    if (requestBytes > MAX_PUBLISH_REQUEST_BYTES) result.push("发布请求不能超过 4MB");
    return result;
  }, [expectedManifestSha, fields, image, isNew, picturesQuery.data, prepared.assets, requestBytes, totalBytes]);

  const publishMutation = useMutation({
    mutationFn: () => publishPicture(session.csrfToken, payload),
    onSuccess: async (result) => {
      await localforage.removeItem(draftKey);
      publishedSnapshot.current = JSON.stringify({ fields: prepared.picture, image: null, expectedManifestSha: result.manifestSha });
      setConfirming(false);
      setExpectedManifestSha(result.manifestSha);
      setCommit({ sha: result.commitSha, url: result.commitUrl });
      setImage(null);
      setFields(prepared.picture);
      setMessage("已提交，正在等待 Vercel 部署");
      await queryClient.invalidateQueries({ queryKey: ["admin-pictures"] });
      if (isNew) navigate(`/admin/pictures/${fields.id}`, { replace: true });
    },
    onError: (error) => { setConfirming(false); setMessage(error instanceof Error ? error.message : "发布失败"); },
  });
  const deploymentQuery = useQuery({ queryKey: ["deployment", commit?.sha], queryFn: () => getDeployment(commit!.sha), enabled: Boolean(commit), refetchInterval: (query) => query.state.data?.found && ["READY", "ERROR", "CANCELED"].includes(query.state.data.state || "") ? false : 4_000 });

  if (picturesQuery.isLoading) return <main className="grid min-h-[60vh] place-items-center">正在读取照片...</main>;
  if (picturesQuery.isError || (!isNew && !picturesQuery.data?.pictures.some((item) => item.id === routeId))) return <main className="p-8 text-center text-error">照片读取失败或不存在</main>;
  const update = <K extends keyof AdminPicture>(key: K, value: AdminPicture[K]) => setFields((current) => ({ ...current, [key]: value }));

  return <main className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-6 sm:py-6">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-base-300 pb-4">
      <div className="flex min-w-0 items-center gap-3"><Link className="btn btn-ghost btn-sm rounded-md" to="/admin/pictures" title="返回照片列表"><ArrowLeft className="h-4 w-4" /></Link><div className="min-w-0"><h1 className="truncate text-xl font-semibold">{isNew ? "上传照片" : fields.title || routeId}</h1><p className="mt-0.5 truncate font-mono text-xs text-base-content/50">{fields.id || "尚未设置 ID"}</p></div></div>
      <button className="btn btn-primary btn-sm rounded-md" disabled={errors.length > 0 || publishMutation.isPending} onClick={() => setConfirming(true)}>{publishMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}{fields.published ? "发布" : "下线"}</button>
    </div>
    {(message || errors.length > 0) && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm"><span className="text-base-content/65">{message}</span>{errors.map((error) => <span key={error} className="text-error">{error}</span>)}</div>}

    <section className="mt-5 grid gap-5 md:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]">
      <div>
        <label className="relative grid min-h-80 place-items-center overflow-hidden border border-dashed border-base-300 bg-base-100 text-center">
          {image || fields.preview ? <img className="max-h-[560px] w-full object-contain" src={image?.previewUrl || `/pictures/${fields.preview}`} alt="照片预览" /> : <span className="flex flex-col items-center gap-2 text-sm text-base-content/50"><ImagePlus className="h-8 w-8" />选择或拖入图片</span>}
          <input className="absolute inset-0 cursor-pointer opacity-0" type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { const processed = await processImage(file); setImage(processed); if (isNew) setFields((current) => ({ ...current, id: current.id || slugify(file.name.replace(/\.[^.]+$/, "")), title: current.title || file.name.replace(/\.[^.]+$/, "") })); setMessage("图片已处理"); } catch (error) { setMessage(error instanceof Error ? error.message : "图片处理失败"); } event.target.value = ""; }} />
        </label>
        <p className="mt-2 text-xs text-base-content/55">{image ? `原图 ${formatBytes(image.originalSize)}${image.compressedSize != null ? `，WebP ${formatBytes(image.compressedSize)}` : ""}` : "未替换图片"}</p>
        {image?.compressedBase64 && <label className="mt-3 flex items-center gap-2 text-sm"><input className="checkbox checkbox-sm" type="checkbox" checked={image.preserveOriginal} onChange={(event) => setImage({ ...image, preserveOriginal: event.target.checked })} />保留不压缩原图，并用 WebP 作为预览</label>}
      </div>
      <div className="grid content-start gap-4 sm:grid-cols-2">
        <label className="admin-field sm:col-span-2"><span>标题</span><input className="input input-sm w-full rounded-md" value={fields.title} onChange={(event) => update("title", event.target.value)} /></label>
        <label className="admin-field"><span>ID</span><input className="input input-sm w-full rounded-md font-mono" disabled={!isNew} value={fields.id} onChange={(event) => update("id", slugify(event.target.value))} /></label>
        <label className="admin-field"><span>日期</span><input className="input input-sm w-full rounded-md" type="date" value={fields.date} onChange={(event) => update("date", event.target.value)} /></label>
        <label className="admin-field"><span>可见性</span><span className="flex h-8 items-center gap-2"><input className="toggle toggle-sm" type="checkbox" checked={fields.published} onChange={(event) => update("published", event.target.checked)} />{fields.published ? "公开" : "下线"}</span></label>
        <label className="admin-field sm:col-span-2"><span>标签</span><TagInput value={tags} suggestions={tagSuggestionsQuery.data || []} onChange={setTags} /></label>
        <div className="sm:col-span-2 border-t border-base-300 pt-4 text-xs text-base-content/55"><p>提交文件 {prepared.assets.length} 个 / {formatBytes(totalBytes)}，请求 {formatBytes(requestBytes)} / 4 MB</p>{!isNew && !image && <p className="mt-1">仅编辑元数据时不会重复上传图片。</p>}</div>
      </div>
    </section>

    {commit && <section className="mt-6 border-t border-base-300 pt-5"><div className="flex flex-wrap items-center gap-3"><h2 className="font-semibold">部署状态</h2><a className="btn btn-ghost btn-xs rounded" href={commit.url} target="_blank" rel="noreferrer">Commit <ExternalLink className="h-3 w-3" /></a>{deploymentQuery.data?.found && <a className="btn btn-ghost btn-xs rounded" href={deploymentQuery.data.inspectorUrl || deploymentQuery.data.deploymentUrl} target="_blank" rel="noreferrer">Deployment <ExternalLink className="h-3 w-3" /></a>}</div>{deploymentQuery.isLoading || !deploymentQuery.data?.found ? <p className="mt-3 flex items-center gap-2 text-sm"><LoaderCircle className="h-4 w-4 animate-spin" />正在等待 Vercel 部署</p> : deploymentQuery.data.state === "READY" ? <p className="mt-3 flex items-center gap-2 text-sm text-success"><Check className="h-4 w-4" />发布成功 <a className="btn btn-success btn-xs rounded" href="/pictures" target="_blank">打开照片墙</a></p> : ["ERROR", "CANCELED"].includes(deploymentQuery.data.state || "") ? <div className="mt-3 text-sm text-error"><p className="flex items-center gap-2"><CircleAlert className="h-4 w-4" />部署失败</p><button className="btn btn-error btn-sm mt-3 rounded-md" onClick={() => deploymentQuery.data?.deploymentId && redeploy(session.csrfToken, deploymentQuery.data.deploymentId).then(() => deploymentQuery.refetch())}><RefreshCw className="h-4 w-4" />重新部署</button></div> : <p className="mt-3 flex items-center gap-2 text-sm"><LoaderCircle className="h-4 w-4 animate-spin" />{deploymentQuery.data.state || "部署中"}</p>}</section>}

    {confirming && <div className="fixed inset-0 z-[200] grid place-items-center bg-black/55 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-md bg-base-100 p-6 shadow-xl"><h2 className="text-lg font-semibold">确认{fields.published ? "发布" : "下线"}</h2><dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm"><dt className="text-base-content/55">照片</dt><dd>{fields.title}</dd><dt className="text-base-content/55">ID</dt><dd className="font-mono">{fields.id}</dd><dt className="text-base-content/55">文件</dt><dd>{prepared.assets.length} 个 / {formatBytes(totalBytes)}</dd><dt className="text-base-content/55">提交</dt><dd>直接写入生产分支</dd></dl>{image?.preserveOriginal && <p className="mt-4 text-sm text-warning">将同时提交原图和 WebP 预览。</p>}<div className="mt-6 flex justify-end gap-2"><button className="btn btn-ghost btn-sm rounded-md" onClick={() => setConfirming(false)}>取消</button><button className="btn btn-primary btn-sm rounded-md" onClick={() => publishMutation.mutate()}>确认提交</button></div></div></div>}
  </main>;
}
