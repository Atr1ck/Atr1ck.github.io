import assert from "node:assert/strict";
import test from "node:test";
import { hasNanYueTag, isNanYueTag, normalizeTagList } from "../shared/tags.js";

test("normalizes tags to title case while preserving acronyms and Chinese", () => {
  assert.deepEqual(normalizeTagList(["visual novel", "comment", "HSR", "结成昨奈"]), ["Visual Novel", "Comment", "HSR", "结成昨奈"]);
});

test("deduplicates tags case-insensitively", () => {
  assert.deepEqual(normalizeTagList(["react", "React", "  visual novel  "]), ["React", "Visual Novel"]);
});

test("matches the Nan & Yue tag after trimming and ignoring case", () => {
  assert.equal(isNanYueTag("Nan & Yue"), true);
  assert.equal(isNanYueTag(" nan & YUE "), true);
  assert.equal(hasNanYueTag(["Diary", "Nan & Yue "]), true);
});

test("does not match tags that only contain the Nan & Yue phrase", () => {
  assert.equal(isNanYueTag("Nan & Yue Travel"), false);
  assert.equal(isNanYueTag("Nan  & Yue"), false);
  assert.equal(hasNanYueTag(["Nan", "Yue"]), false);
});
