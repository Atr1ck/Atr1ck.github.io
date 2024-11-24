declare module "*.css";
interface ImportMeta {
    glob: (pattern: string, options?: { eager?: boolean }) => Record<string, {
      markdown: any; default: string 
}>;
}