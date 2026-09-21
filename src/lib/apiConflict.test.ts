import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { conflictResponse, isUniqueConstraintError, readConflictMessage } from "./apiConflict.ts";

describe("isUniqueConstraintError", () => {
  it("code が P2002 のエラーだけを一意制約違反とみなす", () => {
    assert.equal(isUniqueConstraintError({ code: "P2002" }), true);
    assert.equal(isUniqueConstraintError({ code: "P2025" }), false);
    assert.equal(isUniqueConstraintError(new Error("x")), false);
    assert.equal(isUniqueConstraintError(null), false);
    assert.equal(isUniqueConstraintError("P2002"), false);
  });
});

describe("conflictResponse / readConflictMessage", () => {
  it("409 で説明文を返し、クライアントがそれを読み取れる", async () => {
    const res = conflictResponse("重複しています");
    assert.equal(res.status, 409);
    assert.equal(await readConflictMessage(res, "保存に失敗しました"), "重複しています");
  });

  it("409 以外は fallback を使う", async () => {
    const res = Response.json({ error: "Not Found" }, { status: 404 });
    assert.equal(await readConflictMessage(res, "保存に失敗しました"), "保存に失敗しました");
  });

  it("409 でも本文がJSONでなければ fallback を使う", async () => {
    const res = new Response("oops", { status: 409 });
    assert.equal(await readConflictMessage(res, "保存に失敗しました"), "保存に失敗しました");
  });
});
