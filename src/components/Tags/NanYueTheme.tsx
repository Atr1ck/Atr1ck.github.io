import type { HTMLAttributes } from "react";
import { isNanYueTag } from "../../../shared/tags";

export function NanYueMark({ className = "", ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={`nan-yue-mark ${className}`.trim()} aria-hidden="true" {...props}>
      <span className="nan-yue-heart nan-yue-heart-outline">♡</span>
      <span className="nan-yue-heart nan-yue-heart-solid">♥</span>
    </span>
  );
}

export function ContentTag({ tag, className = "" }: { tag: string; className?: string }) {
  const isNanYue = isNanYueTag(tag);

  return (
    <span className={`${className} ${isNanYue ? "nan-yue-tag" : ""}`.trim()}>
      {isNanYue && <span className="nan-yue-tag-heart" aria-hidden="true">♡</span>}
      #{tag.trim()}
    </span>
  );
}
