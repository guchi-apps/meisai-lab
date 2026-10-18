import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isProxyBypassPath } from "./proxyBypass.ts";

describe("isProxyBypassPath", () => {
  it("/api/app-version だけを素通しする", () => {
    assert.equal(isProxyBypassPath("/api/app-version"), true);
  });
  it("前方一致・他のAPI・画面は素通ししない", () => {
    for (const p of [
      "/api/app-version/",
      "/api/app-version/x",
      "/api/app-versions",
      "/api/salaries",
      "/salaries",
      "/",
    ]) {
      assert.equal(isProxyBypassPath(p), false, p);
    }
  });
});
