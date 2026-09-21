import { NextResponse, type NextRequest } from "next/server";

import { AUTH_NEXT_COOKIE } from "@/lib/auth-next-cookie";
import { db } from "@/lib/db";
import { resolveOrigin } from "@/lib/request-origin";
import { notifySignalyLogin } from "@/lib/signaly";
import { createClient } from "@/lib/supabase/server";
import { signOutThisApp } from "@/lib/supabase/sign-out";
import { syncOAuthUser } from "@/lib/sync-oauth-user";

// next の値は外部ドメインへのオープンリダイレクトに悪用され得るため、
// サイト内の相対パスであることを確認してから使う
function isSafeNextPath(next: string | undefined): next is string {
  return !!next && next.startsWith("/") && !next.startsWith("//");
}

export async function GET(request: NextRequest) {
  const origin = resolveOrigin(request.headers, request.url);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = request.cookies.get(AUTH_NEXT_COOKIE)?.value;
  const redirectPath = isSafeNextPath(next) ? next : "/salaries";

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/error`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/auth/error`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.redirect(`${origin}/auth/error`);
  }

  const name =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    null;

  try {
    await syncOAuthUser(
      {
        findBySupabaseUserId: (supabaseUserId) => db.user.findUnique({ where: { supabaseUserId } }),
        findByEmail: (email) => db.user.findUnique({ where: { email } }),
        linkSupabaseUserId: (userId, supabaseUserId) =>
          db.user.update({ where: { id: userId }, data: { supabaseUserId } }),
        create: (profile) => db.user.create({ data: profile }),
      },
      {
        supabaseUserId: user.id,
        email: user.email,
        name,
        image: (user.user_metadata?.avatar_url as string | undefined) ?? null,
      }
    );
  } catch (e) {
    // exchangeCodeForSession でセッション Cookie は発行済み。User を用意できないまま残すと、
    // Supabase 上はログイン済みなのに DB の User が無い状態になるため、セッションを破棄する。
    console.error("[meisai-lab] OAuth ログイン後の User の用意に失敗した", e);
    await signOutThisApp(supabase).catch(() => {});
    return NextResponse.redirect(`${origin}/auth/error`);
  }

  // 接続元IP・User-Agent は notifySignalyLogin がリクエストヘッダーから拾う
  await notifySignalyLogin({
    email: user.email,
    name,
    provider: user.app_metadata?.provider ?? null,
  });

  const response = NextResponse.redirect(`${origin}${redirectPath}`);
  response.cookies.delete(AUTH_NEXT_COOKIE);
  return response;
}
