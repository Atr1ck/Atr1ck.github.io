const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_DIMENSION = 2400;
const WEBP_QUALITY = 0.82;
const COMPRESSIBLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export interface ProcessedImage {
  id: string;
  originalName: string;
  originalType: string;
  originalSize: number;
  originalBase64: string;
  compressedSize: number | null;
  compressedBase64: string | null;
  compressedName: string | null;
  preserveOriginal: boolean;
  warning: string | null;
  previewUrl: string;
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("读取图片失败"));
    reader.readAsDataURL(blob);
  });
}

function dataUrlBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("图片编码失败");
  return dataUrl.slice(comma + 1);
}

function safeBaseName(name: string): string {
  const withoutExtension = name.replace(/\.[^.]+$/, "");
  const normalized = withoutExtension
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return normalized || `image-${Date.now()}`;
}

function extensionFor(file: File): string {
  const extensions: Record<string, string> = {
    "image/avif": "avif",
    "image/gif": "gif",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return extensions[file.type] || "bin";
}

async function compressToWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器不支持图片处理");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("WebP 转换失败")),
    "image/webp",
    WEBP_QUALITY,
  ));
}

export async function processImage(file: File): Promise<ProcessedImage> {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} 不是图片`);
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) throw new Error(`${file.name} 必须小于 15MB`);
  if (file.type === "image/svg+xml") throw new Error("出于安全原因不支持 SVG，请转换为 PNG 或 WebP");

  const originalDataUrl = await readAsDataUrl(file);
  const base = safeBaseName(file.name);
  let compressedBase64: string | null = null;
  let compressedSize: number | null = null;
  let compressedName: string | null = null;
  let warning: string | null = null;

  if (COMPRESSIBLE_TYPES.has(file.type)) {
    const compressed = await compressToWebp(file);
    compressedBase64 = dataUrlBase64(await readAsDataUrl(compressed));
    compressedSize = compressed.size;
    compressedName = `${base}.webp`;
    if (compressed.size >= file.size) warning = "压缩后体积没有变小，可选择保留原图";
  } else if (file.type === "image/gif") {
    warning = "GIF 将保留动画和原始文件，不进行 WebP 转换";
  } else {
    throw new Error(`暂不支持 ${file.type || extensionFor(file)} 格式`);
  }

  return {
    id: crypto.randomUUID(),
    originalName: `${base}.${extensionFor(file)}`,
    originalType: file.type,
    originalSize: file.size,
    originalBase64: dataUrlBase64(originalDataUrl),
    compressedSize,
    compressedBase64,
    compressedName,
    preserveOriginal: !compressedBase64,
    warning,
    previewUrl: originalDataUrl,
  };
}

export function selectedImagePayload(image: ProcessedImage) {
  const compressed = !image.preserveOriginal && image.compressedBase64 && image.compressedName;
  return {
    name: compressed ? image.compressedName! : image.originalName,
    contentBase64: compressed ? image.compressedBase64! : image.originalBase64,
    size: compressed ? image.compressedSize! : image.originalSize,
    preserveOriginal: !compressed,
  };
}
