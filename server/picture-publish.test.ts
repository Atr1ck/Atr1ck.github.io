import assert from "node:assert/strict";
import test from "node:test";
import { HttpError } from "./http.js";
import { publishPicture, validatePicturePublishRequest } from "./picture-publish.js";
import type { PicturePublishDependencies } from "./picture-publish.js";
import type { GitHubRequester } from "./article-publish.js";

const manifestSha = "e".repeat(40);
const legacyPicture = { id: "legacy-photo", title: "Legacy", file: "旧照片.JPG", preview: "旧照片.webp", tags: [], date: "2026-07-28", published: true };
const manifest = { version: 1 as const, pictures: [legacyPicture] };

function editRequest(overrides = {}) {
  return { picture: legacyPicture, expectedManifestSha: manifestSha, isNew: false, assets: [], ...overrides };
}

test("allows metadata-only edits of migrated root-level picture paths", () => {
  const result = validatePicturePublishRequest(editRequest({ picture: { ...legacyPicture, title: "Updated" } }));
  assert.equal(result.picture.file, "旧照片.JPG");
  assert.equal(result.assets.length, 0);
});

test("requires new and replacement assets to use the picture id directory", () => {
  assert.throws(() => validatePicturePublishRequest({ ...editRequest(), isNew: true }), (error) => error instanceof HttpError && error.status === 400);
  assert.throws(() => validatePicturePublishRequest({ ...editRequest(), assets: [{ path: "public/pictures/legacy-photo/new.webp", contentBase64: Buffer.from("x").toString("base64") }] }), (error) => error instanceof HttpError && error.status === 400);
});

function dependencies(expectedSha = manifestSha) {
  const calls: Array<{ route: string; init?: RequestInit }> = [];
  let blob = 0;
  const base = "a".repeat(40);
  const request: GitHubRequester = async <T>(route: string, init?: RequestInit): Promise<T> => {
    calls.push({ route, init });
    if (route.endsWith("/git/ref/heads/main") && !init) return { object: { sha: base } } as T;
    if (route.includes("/contents/content/pictures.json")) return { sha: expectedSha, encoding: "base64", content: Buffer.from(JSON.stringify(manifest)).toString("base64") } as T;
    if (route.endsWith(`/git/commits/${base}`)) return { tree: { sha: "b".repeat(40) } } as T;
    if (route.endsWith("/git/blobs")) { blob += 1; return { sha: String(blob).repeat(40) } as T; }
    if (route.endsWith("/git/trees")) return { sha: "c".repeat(40) } as T;
    if (route.endsWith("/git/commits")) return { sha: "d".repeat(40), html_url: "https://github.com/commit/photo" } as T;
    if (route.endsWith("/git/refs/heads/main") && init?.method === "PATCH") return {} as T;
    throw new Error(`Unexpected route: ${route}`);
  };
  return { calls, dependencies: { request, repository: { owner: "Atr1ck", repo: "Atr1ck.github.io", branch: "main" } } satisfies PicturePublishDependencies };
}

test("updates the manifest in one commit and uses a non-forced ref update", async () => {
  const { calls, dependencies: deps } = dependencies();
  const input = validatePicturePublishRequest(editRequest({ picture: { ...legacyPicture, title: "Updated", published: false } }));
  const result = await publishPicture(input, deps);
  assert.equal(result.status, "submitted");
  assert.equal(result.manifestSha, "1".repeat(40));
  const treeCall = calls.find((call) => call.route.endsWith("/git/trees"));
  const tree = JSON.parse(String(treeCall?.init?.body));
  assert.equal(tree.tree.length, 1);
  const refCall = calls.find((call) => call.route.endsWith("/git/refs/heads/main") && call.init?.method === "PATCH");
  assert.deepEqual(JSON.parse(String(refCall?.init?.body)), { sha: "d".repeat(40), force: false });
});

test("rejects stale manifest SHA before creating blobs", async () => {
  const { calls, dependencies: deps } = dependencies("f".repeat(40));
  const input = validatePicturePublishRequest(editRequest());
  await assert.rejects(() => publishPicture(input, deps), (error) => error instanceof HttpError && error.status === 409);
  assert.equal(calls.some((call) => call.route.endsWith("/git/blobs")), false);
});

test("rejects changing legacy asset paths without replacements", async () => {
  const { dependencies: deps } = dependencies();
  const input = validatePicturePublishRequest(editRequest({ picture: { ...legacyPicture, file: "another.jpg" } }));
  await assert.rejects(() => publishPicture(input, deps), (error) => error instanceof HttpError && error.status === 400);
});
