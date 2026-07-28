import assert from "node:assert/strict";
import test from "node:test";
import { validatePictureManifest } from "./picture-content.mjs";

const picture = { id: "sample-photo", title: "Sample", file: "legacy photo.jpg", preview: "legacy photo.webp", tags: ["one", "one"], date: "2026-07-28", published: true };

test("normalizes a valid manifest while preserving legacy asset URLs", () => {
  const result = validatePictureManifest({ version: 1, pictures: [picture] });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.value.pictures[0].tags, ["One"]);
  assert.equal(result.value.pictures[0].file, "legacy photo.jpg");
});

test("rejects traversal, invalid dates, and duplicate ids", () => {
  const result = validatePictureManifest({ version: 1, pictures: [picture, { ...picture, file: "../secret.jpg", date: "2026-02-30" }] });
  assert.ok(result.errors.some((error) => error.includes("duplicate picture id")));
  assert.ok(result.errors.some((error) => error.includes("file is invalid")));
  assert.ok(result.errors.some((error) => error.includes("valid YYYY-MM-DD")));
});
