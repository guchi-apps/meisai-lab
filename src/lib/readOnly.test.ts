import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assetManagerPath,
  assetManagerUrl,
  isReadOnly,
  isWriteMethod,
  listPathForWritePage,
} from "./readOnly.ts";

describe("isReadOnly", () => {
  it("未設定・その他の値は従来どおり更新可能", () => {
    assert.equal(isReadOnly({}), false);
    assert.equal(isReadOnly({ MEISAI_READ_ONLY: "" }), false);
    assert.equal(isReadOnly({ MEISAI_READ_ONLY: "false" }), false);
  });
  it("true / 1 で読み取り専用", () => {
    assert.equal(isReadOnly({ MEISAI_READ_ONLY: "true" }), true);
    assert.equal(isReadOnly({ MEISAI_READ_ONLY: " TRUE " }), true);
    assert.equal(isReadOnly({ MEISAI_READ_ONLY: "1" }), true);
  });
});

describe("isWriteMethod", () => {
  it("更新系メソッドだけを書き込みとみなす", () => {
    for (const m of ["POST", "PUT", "PATCH", "DELETE", "post"]) assert.equal(isWriteMethod(m), true);
    for (const m of ["GET", "HEAD", "OPTIONS"]) assert.equal(isWriteMethod(m), false);
  });
});

describe("listPathForWritePage", () => {
  it("登録・編集画面は一覧へ戻す", () => {
    assert.equal(listPathForWritePage("/salaries/new"), "/salaries");
    assert.equal(listPathForWritePage("/bonuses/abc/edit"), "/bonuses");
    assert.equal(listPathForWritePage("/furusato/12/edit/"), "/furusato");
  });
  it("一覧・設定・確定申告は対象外", () => {
    assert.equal(listPathForWritePage("/salaries"), null);
    assert.equal(listPathForWritePage("/settings"), null);
    assert.equal(listPathForWritePage("/tax-return"), null);
  });
});

describe("assetManagerPath", () => {
  it("同じパスへ対応づける", () => {
    assert.equal(assetManagerPath("/salaries"), "/salaries");
    assert.equal(assetManagerPath("/salaries/new"), "/salaries/new");
    assert.equal(assetManagerPath("/bonuses/9/edit"), "/bonuses/9/edit");
    assert.equal(assetManagerPath("/furusato"), "/furusato");
  });
  it("確定申告は /tax へ、year を引き継ぐ", () => {
    assert.equal(assetManagerPath("/tax-return", "?year=2025"), "/tax?year=2025");
  });
  it("設定は /salaries/settings へ", () => {
    assert.equal(assetManagerPath("/settings"), "/salaries/settings");
    assert.equal(assetManagerPath("/settings/items"), "/salaries/settings");
  });
  it("対応が無ければ null、URL はトップへ", () => {
    assert.equal(assetManagerPath("/unknown"), null);
    assert.equal(assetManagerUrl("/unknown"), "https://asset.gucchii.com/");
    assert.equal(assetManagerUrl("/tax-return", "?year=2024"), "https://asset.gucchii.com/tax?year=2024");
  });
});
