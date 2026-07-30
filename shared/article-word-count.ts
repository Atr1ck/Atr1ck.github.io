import { unified } from "unified";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";

interface MarkdownNode {
  type: string;
  value?: string;
  url?: string;
  children?: MarkdownNode[];
}

const HTML_EXCLUDED_TAGS = new Set(["img", "pre", "script", "style"]);

function visibleHtmlText(html: string): string {
  if (typeof DOMParser === "undefined") {
    return html
      .replace(/<!--[^]*?-->/gu, "")
      .replace(/<(pre|script|style)\b[^>]*>[^]*?<\/\1\s*>/giu, "")
      .replace(/<[^>]+>/gu, "");
  }

  const document = new DOMParser().parseFromString(html, "text/html");

  function readNode(node: Node): string {
    if (node.nodeType === 3) return node.textContent || "";
    if (node.nodeType === 1 && HTML_EXCLUDED_TAGS.has((node as Element).tagName.toLowerCase())) return "";
    return Array.from(node.childNodes).map(readNode).join("");
  }

  return readNode(document.body);
}

function nodeText(node: MarkdownNode): string {
  if (node.type === "text" || node.type === "inlineCode") return node.value || "";
  if (node.type === "html") return visibleHtmlText(node.value || "");
  if (["code", "image", "imageReference", "definition"].includes(node.type)) return "";

  const childText = node.children?.map(nodeText).join("") || "";
  if (node.type === "link") {
    const label = childText.trim();
    const url = node.url || "";
    if (label === url || `mailto:${label}` === url) return "";
  }
  return childText;
}

export function countArticleCharacters(markdown: string): number {
  if (!markdown) return 0;
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown) as MarkdownNode;
  return Array.from(nodeText(tree).replace(/\s/gu, "")).length;
}

export function formatArticleWordCount(count: number): string {
  return `${count.toLocaleString("zh-CN")} 字`;
}
