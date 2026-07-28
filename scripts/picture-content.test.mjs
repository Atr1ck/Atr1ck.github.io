import assert from "node:assert/strict";
import test from "node:test";
import { validatePictureManifest } from "./picture-content.mjs";

const categories = new Set(["original", "uncategorized"]);
const picture = { id: "sample-photo", title: "Sample", file: "legacy photo.jpg", preview: "legacy photo.webp", category: "original", tags: ["one", "one"], date: "2026-07-28", published: true };

test("normalizes a valid manifest while preserving legacy asset URLs", () => {
  const result = validatePictureManifest({ version: 1, pictures: [picture] }, categories);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.value.pictures[0].tags, ["one"]);
  assert.equal(result.value.pictures[0].file, "legacy photo.jpg");
});

test("rejects invalid categories, traversal, dates, and duplicate ids", () => {
  const result = validatePictureManifest({ version: 1, pictures: [picture, { ...picture, file: "../secret.jpg", category: "missing", date: "2026-02-30" }] }, categories);
  assert.ok(result.errors.some((error) => error.includes("duplicate picture id")));
  assert.ok(result.errors.some((error) => error.includes("file is invalid")));
  assert.ok(result.errors.some((error) => error.includes("does not exist")));
  assert.ok(result.errors.some((error) => error.includes("valid YYYY-MM-DD")));
});
