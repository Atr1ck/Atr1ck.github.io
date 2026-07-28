import { readFile } from "node:fs/promises";
import path from "node:path";

export const CATEGORY_SOURCE = path.resolve("content/categories.json");
export const CATEGORY_OUTPUT = path.resolve("public/json/categories.json");
export const CATEGORY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validateGroup(value, group, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${group} categories must be an array`);
    return [];
  }

  const slugs = new Set();
  return value.map((item, index) => {
    const prefix = `${group}[${index}]`;
    const slug = typeof item?.slug === "string" ? item.slug.trim() : "";
    const name = typeof item?.name === "string" ? item.name.trim() : "";
    const order = Number(item?.order);
    if (!CATEGORY_SLUG_PATTERN.test(slug)) errors.push(`${prefix}.slug is invalid`);
    if (!name) errors.push(`${prefix}.name is required`);
    if (!Number.isInteger(order) || order < 0) errors.push(`${prefix}.order must be a non-negative integer`);
    if (slugs.has(slug)) errors.push(`${group} has duplicate category slug "${slug}"`);
    slugs.add(slug);
    return { slug, name, order };
  }).sort((first, second) => first.order - second.order || first.slug.localeCompare(second.slug));
}

export function validateCategories(value) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { errors: ["category config must be an object"], value: null };
  }
  if (value.version !== 1) errors.push("category config version must be 1");
  const articles = validateGroup(value.articles, "articles", errors);
  const pictures = validateGroup(value.pictures, "pictures", errors);
  if (!articles.some((category) => category.slug === "uncategorized")) {
    errors.push("articles categories must include uncategorized");
  }
  if (!pictures.some((category) => category.slug === "uncategorized")) {
    errors.push("pictures categories must include uncategorized");
  }
  return { errors, value: { version: 1, articles, pictures } };
}

export async function loadCategories() {
  const source = JSON.parse(await readFile(CATEGORY_SOURCE, "utf8"));
  const result = validateCategories(source);
  if (result.errors.length > 0 || !result.value) {
    throw new Error(`Category validation failed:\n- ${result.errors.join("\n- ")}`);
  }
  return result.value;
}
