export type OAuthProfile = {
  supabaseUserId: string;
  email: string;
  name: string | null;
  image: string | null;
};

// Prisma に依存させず、照合の順序だけを単体テストできるようにするための最小の窓口
export type UserStore = {
  findBySupabaseUserId: (supabaseUserId: string) => Promise<{ id: string } | null>;
  findByEmail: (email: string) => Promise<{ id: string } | null>;
  linkSupabaseUserId: (userId: string, supabaseUserId: string) => Promise<unknown>;
  create: (profile: OAuthProfile) => Promise<unknown>;
};

/**
 * OAuth ログインした Supabase ユーザーに対応する User 行を用意する。
 *
 * requireUserId() は supabaseUserId で User を引くため、ここも supabaseUserId を最優先で照合する。
 * email だけで照合して「supabaseUserId が空のときだけ」紐付けると、Supabase 側でユーザーが作り直されて
 * 値が食い違った行を直せず、ログイン済みなのに User が引けない状態になる。
 * email は Supabase が検証済みの値なので、supabaseUserId で見つからなければ email で探して上書きする。
 */
export async function syncOAuthUser(store: UserStore, profile: OAuthProfile): Promise<void> {
  const bySupabaseUserId = await store.findBySupabaseUserId(profile.supabaseUserId);
  if (bySupabaseUserId) return;

  const byEmail = await store.findByEmail(profile.email);
  if (byEmail) {
    await store.linkSupabaseUserId(byEmail.id, profile.supabaseUserId);
    return;
  }

  await store.create(profile);
}
