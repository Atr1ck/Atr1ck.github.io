import assert from "node:assert/strict";
import test from "node:test";
import { assertInstallationPermissions } from "./github.js";
import { HttpError } from "./http.js";

test("requires GitHub App Contents read and write permission", () => {
  assert.doesNotThrow(() => assertInstallationPermissions({
    contents: "write",
    metadata: "read",
  }));

  for (const contents of ["read", undefined]) {
    assert.throws(
      () => assertInstallationPermissions({ contents }),
      (error) => {
        assert.ok(error instanceof HttpError);
        assert.equal(error.status, 503);
        assert.equal(
          (error.details as { code: string }).code,
          "GITHUB_APP_CONTENTS_PERMISSION_REQUIRED",
        );
        return true;
      },
    );
  }
});
