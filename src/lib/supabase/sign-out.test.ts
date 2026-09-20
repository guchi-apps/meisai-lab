import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { signOutThisApp } from "./sign-out.ts";

describe("signOutThisApp", () => {
  it("scope: local を渡し、他アプリ・他端末のセッションを失効させない", async () => {
    const calls: unknown[][] = [];
    const supabase = {
      auth: {
        signOut: async (...args: unknown[]) => {
          calls.push(args);
          return { error: null };
        },
      },
    };

    await signOutThisApp(supabase);

    assert.deepEqual(calls, [[{ scope: "local" }]]);
  });
});

describe("supabase.auth.signOut の直接呼び出し", () => {
  it("sign-out.ts 以外から呼ばれていない（既定 scope の global に戻さない）", () => {
    const srcDir = join(import.meta.dirname, "..", "..");
    const offenders = readdirSync(srcDir, { recursive: true, encoding: "utf8" })
      .filter((file) => /\.(ts|tsx)$/.test(file))
      .filter((file) => !/(^|[\\/])sign-out(\.test)?\.ts$/.test(file))
      .filter((file) => /\.signOut\s*\(/.test(readFileSync(join(srcDir, file), "utf8")));

    assert.deepEqual(offenders, []);
  });
});
