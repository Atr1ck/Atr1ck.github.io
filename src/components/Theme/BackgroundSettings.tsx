import { useEffect, useRef, useState } from "react";
import localforage from "localforage";
import { Image as ImageIcon, RotateCcw, Upload } from "lucide-react";

const BACKGROUND_ENABLED_KEY = "background-enabled";
const BACKGROUND_IMAGE_KEY = "custom-background-image";
const DEFAULT_BACKGROUND_URL = "/images/main-bg-com.webp";
const MAX_BACKGROUND_SIZE = 15 * 1024 * 1024;

function getInitialEnabled() {
  return localStorage.getItem(BACKGROUND_ENABLED_KEY) !== "false";
}

function applyBackground(url: string | null) {
  const background = document.getElementById("site-background");

  if (!background) return;

  if (url) {
    background.style.backgroundImage = `url("${url}")`;
  } else {
    background.style.removeProperty("background-image");
  }
}

export default function BackgroundSettings() {
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [enabled, setEnabled] = useState(getInitialEnabled);
  const [customUrl, setCustomUrl] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    document.documentElement.dataset.background = enabled ? "visible" : "hidden";
    localStorage.setItem(BACKGROUND_ENABLED_KEY, String(enabled));
  }, [enabled]);

  useEffect(() => {
    let active = true;

    localforage.getItem<Blob>(BACKGROUND_IMAGE_KEY).then((image) => {
      if (!active || !(image instanceof Blob)) return;

      const url = URL.createObjectURL(image);
      objectUrlRef.current = url;
      setCustomUrl(url);
      applyBackground(url);
    }).catch(() => {
      if (active) setStatus("自定义背景加载失败");
    });

    return () => {
      active = false;
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setStatus("请选择图片文件");
      return;
    }

    if (file.size > MAX_BACKGROUND_SIZE) {
      setStatus("图片不能超过 15MB");
      return;
    }

    try {
      await localforage.setItem(BACKGROUND_IMAGE_KEY, file);

      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);

      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;
      setCustomUrl(url);
      applyBackground(url);
      setEnabled(true);
      setStatus("背景已更新");
    } catch {
      setStatus("背景保存失败");
    }
  };

  const restoreDefault = async () => {
    try {
      await localforage.removeItem(BACKGROUND_IMAGE_KEY);

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      setCustomUrl(null);
      applyBackground(null);
      setEnabled(true);
      setStatus("已恢复默认背景");
    } catch {
      setStatus("恢复默认背景失败");
    }
  };

  return (
    <details className="background-menu dropdown dropdown-end relative z-[90]">
      <summary
        className="btn btn-ghost btn-square btn-sm md:btn-md list-none"
        aria-label="背景设置"
        title="背景设置"
      >
        <ImageIcon size={20} />
      </summary>

      <div className="dropdown-content z-[90] mt-3 w-64 rounded-lg border border-base-300 bg-base-100 p-4 text-base-content shadow-xl">
        <div
          className="mb-4 h-20 w-full rounded-md border border-base-300 bg-cover bg-center"
          style={{ backgroundImage: `url("${customUrl ?? DEFAULT_BACKGROUND_URL}")` }}
          aria-hidden="true"
        />

        <label className="flex items-center justify-between gap-4">
          <span className="font-medium">显示背景图</span>
          <input
            type="checkbox"
            className="toggle toggle-primary toggle-sm"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
        </label>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
        />

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="btn btn-primary btn-sm flex-1"
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={16} />
            上传图片
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square"
            aria-label="恢复默认背景"
            title="恢复默认背景"
            disabled={!customUrl}
            onClick={restoreDefault}
          >
            <RotateCcw size={16} />
          </button>
        </div>

        {status && <p className="mt-3 text-xs text-base-content/65" role="status">{status}</p>}
      </div>
    </details>
  );
}
