import assert from "node:assert/strict";
import test from "node:test";
import { getDeploymentForCommit, redeploy } from "./vercel.js";
import { HttpError } from "./http.js";

process.env.VERCEL_PROJECT_ID = "prj_test";
process.env.VERCEL_PROJECT_NAME = "atr1ck-blog";

test("returns the deployment matching the exact commit", async () => {
  const sha = "a".repeat(40);
  const result = await getDeploymentForCommit(sha, async <T>(path: string): Promise<T> => {
    assert.match(path, /meta-githubCommitSha=/);
    return {
      deployments: [{
        uid: "dpl_test",
        name: "blog",
        url: "blog.example.vercel.app",
        state: "READY",
        created: 1000,
        ready: 2500,
        meta: { githubCommitSha: sha },
      }],
    } as T;
  });

  assert.equal(result.found, true);
  if (result.found) {
    assert.equal(result.state, "READY");
    assert.equal(result.durationMs, 1500);
  }
});

test("includes a bounded stderr summary for failed deployments", async () => {
  const sha = "b".repeat(40);
  const result = await getDeploymentForCommit(sha, async <T>(path: string): Promise<T> => {
    if (path.startsWith("/v6/deployments")) {
      return { deployments: [{
        uid: "dpl_failed",
        name: "blog",
        url: "failed.vercel.app",
        state: "ERROR",
        created: 1000,
        meta: { githubCommitSha: sha },
      }] } as T;
    }
    return [{ type: "stdout", text: "ignore" }, { type: "stderr", text: "Build failed" }] as T;
  });

  assert.equal(result.found, true);
  if (result.found) assert.equal(result.errorSummary, "Build failed");
});

test("validates deployment IDs before redeploying", async () => {
  await assert.rejects(
    redeploy("../bad", async () => { throw new Error("should not run"); }),
    (error) => error instanceof HttpError && error.status === 400,
  );
});

test("requests a production redeployment", async () => {
  const result = await redeploy("dpl_original", async <T>(_path: string, init?: RequestInit): Promise<T> => {
    assert.equal(init?.method, "POST");
    assert.deepEqual(JSON.parse(String(init?.body)), {
      name: "atr1ck-blog",
      deploymentId: "dpl_original",
      target: "production",
    });
    return { uid: "dpl_new", state: "QUEUED", url: "new.vercel.app" } as T;
  });
  assert.equal(result.deploymentId, "dpl_new");
});
