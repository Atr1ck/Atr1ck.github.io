import { useEffect, useState, type ComponentPropsWithoutRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { articleHtmlSchema, rehypeFilterUnsafeArticleStyles } from "../../../shared/article-html-schema";

function imageStyle(style: CSSProperties | undefined, width: number | string | undefined, height: number | string | undefined): CSSProperties | undefined {
  if (!width && !height) return style;
  return {
    ...style,
    ...(width && style?.width == null ? { width: typeof width === "number" ? `${width}px` : width } : {}),
    ...(height && style?.height == null ? { height: typeof height === "number" ? `${height}px` : height } : {}),
  };
}

function MarkdownImage({ src, alt, className, style, width, height, loading, decoding, ...props }: ComponentPropsWithoutRef<"img">) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!src) return null;

  return (
    <>
      <img
        {...props}
        className={["markdown-content-image", className].filter(Boolean).join(" ")}
        src={src}
        alt={alt || ""}
        width={width}
        height={height}
        style={imageStyle(style, width, height)}
        loading={loading || "lazy"}
        decoding={decoding || "async"}
        role="button"
        tabIndex={0}
        aria-label={`放大查看${alt ? `：${alt}` : "图片"}`}
        onClick={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      />
      {open && createPortal(
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label={alt ? `查看原图：${alt}` : "查看原图"} onClick={() => setOpen(false)}>
          <div className="relative flex max-h-full max-w-full items-center justify-center" onClick={(event) => event.stopPropagation()}>
            <img className="max-h-[90vh] max-w-[94vw] rounded-md object-contain shadow-2xl" src={src} alt={alt || ""} />
            <button type="button" className="btn btn-circle btn-sm absolute right-2 top-2 border-0 bg-black/60 text-white hover:bg-black/80" aria-label="关闭原图预览" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, rehypeFilterUnsafeArticleStyles, [rehypeSanitize, articleHtmlSchema], rehypeHighlight]}
      components={{ img: ({ node, ...props }) => {
        void node;
        return <MarkdownImage {...props} />;
      } }}
    >
      {content}
    </Markdown>
  );
}
