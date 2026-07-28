import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

function MarkdownImage({ src, alt }: { src?: string; alt?: string }) {
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
        className="markdown-content-image"
        src={src}
        alt={alt || ""}
        loading="lazy"
        decoding="async"
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
    <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={{ img: ({ src, alt }) => <MarkdownImage src={src} alt={alt} /> }}>
      {content}
    </Markdown>
  );
}
