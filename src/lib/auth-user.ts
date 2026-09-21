import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

async function resolveUser(): Promise<{ hasSession: boolean; userId: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { hasSession: false, userId: null };

  const dbUser = await db.user.findUnique({ where: { supabaseUserId: user.id } });
  return { hasSession: true, userId: dbUser?.id ?? null };
}

export async function requireUserId(): Promise<string | null> {
  return (await resolveUser()).userId;
}

/**
 * 保護ページ用。利用者を特定できなければリダイレクトする（戻り値は常にユーザーID）。
 *
 * Supabase 上はログイン済みなのに DB の User が引けない場合に /auth/signin へ送ってはならない。
 * proxy が「ログイン済みなら /auth/signin から /salaries へ戻す」ため、無限にリダイレクトし続け、
 * ログアウトボタンのある画面にも辿り着けなくなる。ログアウトできるエラーページへ送る。
 */
export async function requirePageUserId(): Promise<string> {
  const { hasSession, userId } = await resolveUser();
  if (userId) return userId;
  redirect(hasSession ? "/auth/error?reason=account-missing" : "/auth/signin");
}
