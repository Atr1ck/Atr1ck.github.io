declare module "*.css";
interface ImportMeta {
    glob: (pattern: string, options?: { eager?: boolean }) => Record<string, {
      markdown: unknown; default: string
}>;
}
