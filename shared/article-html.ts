import { Parser } from "htmlparser2";
import { unified } from "unified";
import remarkParse from "remark-parse";
import { ARTICLE_HTML_TAGS, isSafeArticleStyle } from "./article-html-schema.js";

const ARTICLE_HTML_TAG_SET = new Set<string>(ARTICLE_HTML_TAGS);
const GLOBAL_ATTRIBUTES = new Set(["align", "class", "dir", "height", "hidden", "lang", "role", "style", "title", "width"]);
const TAG_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(["download", "href", "hreflang", "rel", "target", "type"]),
  audio: new Set(["autoplay", "controls", "loop", "muted", "preload", "src"]),
  blockquote: new Set(["cite"]),
  col: new Set(["span"]),
  data: new Set(["value"]),
  del: new Set(["cite", "datetime"]),
  details: new Set(["name", "open"]),
  img: new Set(["alt", "decoding", "loading", "src"]),
  ins: new Set(["cite", "datetime"]),
  li: new Set(["value"]),
  ol: new Set(["reversed", "start", "type"]),
  q: new Set(["cite"]),
  source: new Set(["media", "sizes", "src", "srcset", "type"]),
  td: new Set(["abbr", "colspan", "headers", "rowspan"]),
  th: new Set(["abbr", "colspan", "headers", "rowspan", "scope"]),
  time: new Set(["datetime"]),
  track: new Set(["default", "kind", "label", "src", "srclang"]),
  video: new Set(["autoplay", "controls", "loop", "muted", "playsinline", "poster", "preload", "src"]),
};

const URL_ATTRIBUTES: Record<string, readonly string[]> = {
  href: ["http", "https", "mailto", "tel"],
  src: ["http", "https"],
  srcset: ["http", "https"],
  poster: ["http", "https"],
  cite: ["http", "https"],
};

interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
}

function collectHtmlFragments(node: MarkdownNode, fragments: string[]) {
  if (node.type === "html" && node.value) fragments.push(node.value);
  node.children?.forEach((child) => collectHtmlFragments(child, fragments));
}

function isAllowedUrl(value: string, protocols: readonly string[]): boolean {
  const normalized = [...value.trim()].filter((character) => {
    const code = character.charCodeAt(0);
    return code > 31 && code !== 127 && !/\s/.test(character);
  }).join("");
  if (!normalized || normalized.startsWith("#") || normalized.startsWith("/") || normalized.startsWith("?") || normalized.startsWith(".")) return true;
  const match = normalized.match(/^([a-z][a-z0-9+.-]*):/i);
  return Boolean(match && protocols.includes(match[1].toLowerCase()));
}

function validateSrcSet(value: string): boolean {
  return value.split(",").every((candidate) => {
    const source = candidate.trim().split(/\s+/, 1)[0] || "";
    return isAllowedUrl(source, URL_ATTRIBUTES.srcset);
  });
}

function validateAttribute(tag: string, attribute: string, value: string, errors: Set<string>) {
  if (attribute.startsWith("on")) {
    errors.add(`不允许使用 ${attribute} 事件属性`);
    return;
  }
  if (!GLOBAL_ATTRIBUTES.has(attribute) && !TAG_ATTRIBUTES[tag]?.has(attribute)) {
    errors.add(`不允许在 <${tag}> 上使用 ${attribute} 属性`);
    return;
  }
  if (attribute === "style" && !isSafeArticleStyle(value)) {
    errors.add("style 属性不能包含危险的脚本或资源地址");
    return;
  }
  if (attribute === "srcset") {
    if (!validateSrcSet(value)) errors.add("srcset 只允许站内路径或 http/https 地址");
    return;
  }
  const protocols = URL_ATTRIBUTES[attribute];
  if (protocols && !isAllowedUrl(value, protocols)) {
    errors.add(`${attribute} 只允许站内路径或 ${protocols.join("/")} 地址`);
  }
}

/** Returns publish-blocking messages for raw HTML in an article body. */
export function validateArticleHtml(markdown: string): string[] {
  const tree = unified().use(remarkParse).parse(markdown) as MarkdownNode;
  const fragments: string[] = [];
  collectHtmlFragments(tree, fragments);
  if (fragments.length === 0) return [];

  const errors = new Set<string>();
  const parser = new Parser({
    onopentag(tag, attributes) {
      if (!ARTICLE_HTML_TAG_SET.has(tag)) {
        errors.add(`不允许使用 <${tag}> 标签`);
        return;
      }
      Object.entries(attributes).forEach(([attribute, value]) => validateAttribute(tag, attribute, value, errors));
    },
    onprocessinginstruction() {
      errors.add("不允许使用文档声明或处理指令");
    },
  }, { lowerCaseAttributeNames: true, lowerCaseTags: true, recognizeSelfClosing: true });

  for (const fragment of fragments) {
    if (/<!doctype\b/i.test(fragment)) errors.add("不允许使用文档声明或处理指令");
    parser.write(fragment);
  }
  parser.end();
  return [...errors];
}
