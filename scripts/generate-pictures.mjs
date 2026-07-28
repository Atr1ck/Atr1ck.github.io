import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadCategories } from "./category-content.mjs";
import {
  PICTURE_OUTPUT,
  loadPictureManifest,
  validatePictureAssets,
} from "./picture-content.mjs";

const categories = await loadCategories();
const manifest = await loadPictureManifest(categories);
const assetErrors = await validatePictureAssets(manifest);
if (assetErrors.length > 0) throw new Error(`Picture asset validation failed:\n- ${assetErrors.join("\n- ")}`);

const published = {
  version: 1,
  pictures: manifest.pictures.filter((picture) => picture.published),
};
await mkdir(path.dirname(PICTURE_OUTPUT), { recursive: true });
await writeFile(PICTURE_OUTPUT, `${JSON.stringify(published, null, 2)}\n`, "utf8");
console.log(`Generated ${published.pictures.length} published pictures.`);
