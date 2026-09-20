import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * このアプリのセッションだけを破棄する。
 *
 * Supabase Auth は共有プロジェクトで、他アプリ・他端末が同じユーザーのセッションを持っている。
 * signOut() の既定 scope は "global" で、引数なしで呼ぶとそれらの refresh token まで失効するため、
 * ログアウトは必ずここを経由して scope: "local" を明示する。
 * 直接 supabase.auth.signOut() を呼ばないこと（sign-out.test.ts が検知する）。
 */
export function signOutThisApp(supabase: { auth: Pick<SupabaseClient["auth"], "signOut"> }) {
  return supabase.auth.signOut({ scope: "local" });
}
