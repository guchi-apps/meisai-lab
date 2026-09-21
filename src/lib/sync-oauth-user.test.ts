import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { syncOAuthUser, type OAuthProfile, type UserStore } from "./sync-oauth-user.ts";

const profile: OAuthProfile = {
  supabaseUserId: "sb-new",
  email: "a@example.com",
  name: "A",
  image: null,
};

function createStore(rows: { id: string; email: string; supabaseUserId: string | null }[]) {
  const calls: string[] = [];
  const store: UserStore = {
    findBySupabaseUserId: async (supabaseUserId) => {
      calls.push(`findBySupabaseUserId:${supabaseUserId}`);
      return rows.find((r) => r.supabaseUserId === supabaseUserId) ?? null;
    },
    findByEmail: async (email) => {
      calls.push(`findByEmail:${email}`);
      return rows.find((r) => r.email === email) ?? null;
    },
    linkSupabaseUserId: async (userId, supabaseUserId) => {
      calls.push(`link:${userId}:${supabaseUserId}`);
    },
    create: async (p) => {
      calls.push(`create:${p.email}`);
    },
  };
  return { store, calls };
}

describe("syncOAuthUser", () => {
  it("supabaseUserId で見つかれば email での照合も更新もしない", async () => {
    const { store, calls } = createStore([{ id: "u1", email: "a@example.com", supabaseUserId: "sb-new" }]);

    await syncOAuthUser(store, profile);

    assert.deepEqual(calls, ["findBySupabaseUserId:sb-new"]);
  });

  it("supabaseUserId が食い違う既存行は email で見つけて上書きする", async () => {
    const { store, calls } = createStore([{ id: "u1", email: "a@example.com", supabaseUserId: "sb-old" }]);

    await syncOAuthUser(store, profile);

    assert.deepEqual(calls, [
      "findBySupabaseUserId:sb-new",
      "findByEmail:a@example.com",
      "link:u1:sb-new",
    ]);
  });

  it("supabaseUserId が空の既存行は email で見つけて紐付ける", async () => {
    const { store, calls } = createStore([{ id: "u1", email: "a@example.com", supabaseUserId: null }]);

    await syncOAuthUser(store, profile);

    assert.deepEqual(calls, [
      "findBySupabaseUserId:sb-new",
      "findByEmail:a@example.com",
      "link:u1:sb-new",
    ]);
  });

  it("どちらでも見つからなければ作成する", async () => {
    const { store, calls } = createStore([]);

    await syncOAuthUser(store, profile);

    assert.deepEqual(calls, [
      "findBySupabaseUserId:sb-new",
      "findByEmail:a@example.com",
      "create:a@example.com",
    ]);
  });

  it("ストアの失敗は握りつぶさず呼び出し側へ伝える", async () => {
    const { store } = createStore([]);
    store.create = async () => {
      throw new Error("unique constraint");
    };

    await assert.rejects(syncOAuthUser(store, profile), /unique constraint/);
  });
});
