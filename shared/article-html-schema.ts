import { defaultSchema, type Options as SanitizeSchema } from "rehype-sanitize";
import type { Root, RootContent } from "hast";
import type { Plugin } from "unified";

export const ARTICLE_HTML_TAGS = [
  "a", "address", "article", "aside", "audio", "b", "blockquote", "br", "caption", "cite", "code", "col", "colgroup", "data", "dd", "del", "details", "div", "dl", "dt", "em", "figcaption", "figure", "footer", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "i", "img", "ins", "kbd", "li", "main", "mark", "nav", "ol", "p", "picture", "pre", "q", "rp", "rt", "ruby", "s", "samp", "section", "small", "source", "span", "strike", "strong", "sub", "summary", "sup", "table", "tbody", "td", "tfoot", "th", "thead", "time", "tr", "track", "tt", "u", "ul", "var", "video",
] as const;

export const articleHtmlSchema: SanitizeSchema = {
  ...defaultSchema,
  allowComments: true,
  tagNames: [...ARTICLE_HTML_TAGS, "input"],
  attributes: {
    "*": ["align", "className", "dir", "height", "hidden", "lang", "role", "style", "title", "width"],
    a: ["download", "href", "hrefLang", "rel", "target", "type"],
    audio: ["autoPlay", "controls", "loop", "muted", "preload", "src"],
    blockquote: ["cite"],
    col: ["span"],
    data: ["value"],
    del: ["cite", "dateTime"],
    details: ["name", "open"],
    img: ["alt", "decoding", "loading", "src"],
    input: [["type", "checkbox"], "checked", "disabled"],
    ins: ["cite", "dateTime"],
    li: ["value"],
    ol: ["reversed", "start", "type"],
    q: ["cite"],
    source: ["media", "sizes", "src", "srcSet", "type"],
    td: ["abbr", "colSpan", "headers", "rowSpan"],
    th: ["abbr", "colSpan", "headers", "rowSpan", "scope"],
    time: ["dateTime"],
    track: ["default", "kind", "label", "src", "srcLang"],
    video: ["autoPlay", "controls", "loop", "muted", "playsInline", "poster", "preload", "src"],
  },
  protocols: {
    cite: ["http", "https"],
    href: ["http", "https", "mailto", "tel"],
    poster: ["http", "https"],
    src: ["http", "https"],
    srcSet: ["http", "https"],
  },
  required: {
    input: { disabled: true, type: "checkbox" },
  },
  strip: ["canvas", "embed", "form", "iframe", "math", "object", "script", "style", "svg", "template"],
};

export function isSafeArticleStyle(value: string): boolean {
  return !/(?:expression\s*\(|@import\b|behavior\s*:|url\s*\(\s*["']?\s*(?:javascript|data|blob)\s*:)/i.test(value);
}

/** Removes unsafe CSS values even when content bypasses the admin publisher. */
export const rehypeFilterUnsafeArticleStyles: Plugin<[], Root> = () => (tree) => {
  const visit = (node: Root | RootContent) => {
    if (node.type === "element") {
      const style = node.properties.style;
      if (typeof style === "string" && !isSafeArticleStyle(style)) delete node.properties.style;
    }
    if ("children" in node) node.children.forEach(visit);
  };
  visit(tree);
};
