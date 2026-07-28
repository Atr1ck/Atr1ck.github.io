import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { CATEGORY_OUTPUT, loadCategories } from "./category-content.mjs";

const categories = await loadCategories();
await mkdir(path.dirname(CATEGORY_OUTPUT), { recursive: true });
await writeFile(CATEGORY_OUTPUT, `${JSON.stringify(categories, null, 2)}\n`, "utf8");
console.log(`Generated ${categories.articles.length + categories.pictures.length} categories.`);
