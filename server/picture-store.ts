import { getRepositoryCategories, readRepositoryJson } from "./category-store.js";
import type { CategoryStoreDependencies } from "./category-store.js";
import { HttpError } from "./http.js";

export interface PictureMetadata {
  id: string;
  title: string;
  file: string;
  preview: string;
  category: string;
  tags: string[];
  date: string;
  published: boolean;
}

export interface PictureManifest {
  version: 1;
  pictures: PictureMetadata[];
}

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ASSET_PATTERN = /^[^/\\]+(?:\/[^/\\]+)*\.(?:avif|gif|jpe?g|png|webp)$/i;

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parsePictureManifest(value: unknown, categorySlugs: ReadonlySet<string>): PictureManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(502, "Picture manifest is invalid");
  const record = value as Record<string, unknown>;
  if (record.version !== 1 || !Array.isArray(record.pictures)) throw new HttpError(502, "Picture manifest version is invalid");
  const ids = new Set<string>();
  const pictures = record.pictures.map((item, index) => {
    if (!item || typeof item !== "object") throw new HttpError(502, `Picture ${index + 1} is invalid`);
    const picture = item as Record<string, unknown>;
    const id = typeof picture.id === "string" ? picture.id : "";
    const title = typeof picture.title === "string" ? picture.title.trim() : "";
    const file = typeof picture.file === "string" ? picture.file : "";
    const preview = typeof picture.preview === "string" ? picture.preview : "";
    const category = typeof picture.category === "string" ? picture.category : "";
    if (!ID_PATTERN.test(id) || ids.has(id)) throw new HttpError(502, `Picture id ${id || index + 1} is invalid or duplicated`);
    if (!title || !ASSET_PATTERN.test(file) || !ASSET_PATTERN.test(preview) || file.includes("..") || preview.includes("..")) {
      throw new HttpError(502, `Picture ${id} metadata is invalid`);
    }
    if (!categorySlugs.has(category) || !Array.isArray(picture.tags) || !validDate(picture.date) || typeof picture.published !== "boolean") {
      throw new HttpError(502, `Picture ${id} classification is invalid`);
    }
    ids.add(id);
    return {
      id,
      title,
      file,
      preview,
      category,
      tags: [...new Set(picture.tags.map(String).map((tag) => tag.trim()).filter(Boolean))],
      date: picture.date,
      published: picture.published,
    };
  });
  return { version: 1, pictures };
}

export async function listAdminPictures(dependencies?: CategoryStoreDependencies) {
  const categories = await getRepositoryCategories(dependencies);
  const result = await readRepositoryJson<unknown>("content/pictures.json", dependencies);
  const manifest = parsePictureManifest(result.value, new Set(categories.pictures.map((category) => category.slug)));
  return {
    manifestSha: result.sha,
    pictures: manifest.pictures.sort((first, second) => second.date.localeCompare(first.date) || first.id.localeCompare(second.id)),
  };
}
