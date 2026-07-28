import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { CATEGORY_SLUG_PATTERN } from "./category-content.mjs";

export const PICTURE_SOURCE = path.resolve("content/pictures.json");
export const PICTURE_OUTPUT = path.resolve("public/json/pictures.json");
export const PICTURE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SAFE_PATH_PATTERN = /^[^/\\]+(?:\/[^/\\]+)*\.(?:avif|gif|jpe?g|png|webp)$/i;

function validDate(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizePicture(item, index, categorySlugs, errors) {
  const prefix = `pictures[${index}]`;
  const id = typeof item?.id === "string" ? item.id.trim() : "";
  const title = typeof item?.title === "string" ? item.title.trim() : "";
  const file = typeof item?.file === "string" ? item.file.trim() : "";
  const preview = typeof item?.preview === "string" ? item.preview.trim() : "";
  const category = typeof item?.category === "string" ? item.category.trim() : "";
  const tags = Array.isArray(item?.tags)
    ? [...new Set(item.tags.map((tag) => String(tag).trim()).filter(Boolean))]
    : [];

  if (!PICTURE_ID_PATTERN.test(id)) errors.push(`${prefix}.id is invalid`);
  if (!title) errors.push(`${prefix}.title is required`);
  if (!SAFE_PATH_PATTERN.test(file) || file.includes("..")) errors.push(`${prefix}.file is invalid`);
  if (!SAFE_PATH_PATTERN.test(preview) || preview.includes("..")) errors.push(`${prefix}.preview is invalid`);
  if (!CATEGORY_SLUG_PATTERN.test(category) || !categorySlugs.has(category)) {
    errors.push(`${prefix}.category "${category}" does not exist`);
  }
  if (!Array.isArray(item?.tags)) errors.push(`${prefix}.tags must be an array`);
  if (!validDate(item?.date)) errors.push(`${prefix}.date must be a valid YYYY-MM-DD date`);
  if (typeof item?.published !== "boolean") errors.push(`${prefix}.published must be true or false`);

  return { id, title, file, preview, category, tags, date: item?.date || "", published: item?.published === true };
}

export function validatePictureManifest(value, categorySlugs) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { errors: ["picture manifest must be an object"], value: null };
  }
  if (value.version !== 1) errors.push("picture manifest version must be 1");
  if (!Array.isArray(value.pictures)) {
    return { errors: [...errors, "pictures must be an array"], value: null };
  }
  const pictures = value.pictures.map((item, index) => normalizePicture(item, index, categorySlugs, errors));
  const ids = new Set();
  const files = new Set();
  for (const picture of pictures) {
    if (ids.has(picture.id)) errors.push(`duplicate picture id "${picture.id}"`);
    ids.add(picture.id);
    for (const asset of [picture.file, picture.preview]) {
      if (files.has(asset) && picture.file !== picture.preview) errors.push(`duplicate picture asset "${asset}"`);
      files.add(asset);
    }
  }
  pictures.sort((first, second) => second.date.localeCompare(first.date) || first.id.localeCompare(second.id));
  return { errors, value: { version: 1, pictures } };
}

export async function loadPictureManifest(categories) {
  const source = JSON.parse(await readFile(PICTURE_SOURCE, "utf8"));
  const result = validatePictureManifest(source, new Set(categories.pictures.map((category) => category.slug)));
  if (result.errors.length > 0 || !result.value) {
    throw new Error(`Picture validation failed:\n- ${result.errors.join("\n- ")}`);
  }
  return result.value;
}

export async function validatePictureAssets(manifest) {
  const errors = [];
  for (const picture of manifest.pictures) {
    for (const asset of new Set([picture.file, picture.preview])) {
      await access(path.resolve("public/pictures", asset)).catch(() => {
        errors.push(`${picture.id}: public/pictures/${asset} does not exist`);
      });
    }
  }
  return errors;
}
