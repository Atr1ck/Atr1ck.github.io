import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTagList } from "../shared/tags.js";

test("normalizes tags to title case while preserving acronyms and Chinese", () => {
  assert.deepEqual(normalizeTagList(["visual novel", "comment", "HSR", "结成昨奈"]), ["Visual Novel", "Comment", "HSR", "结成昨奈"]);
});

test("deduplicates tags case-insensitively", () => {
  assert.deepEqual(normalizeTagList(["react", "React", "  visual novel  "]), ["React", "Visual Novel"]);
});
