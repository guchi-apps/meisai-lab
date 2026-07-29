import { NextResponse, type NextRequest } from "next/server";

import { AUTH_NEXT_COOKIE } from "@/lib/auth-next-cookie";
import { db } from "@/lib/db";
import { resolveOrigin } from "@/lib/request-origin";
import { notifySignalyLogin } from "@/lib/signaly";
import { createClient } from "@/lib/supabase/server";

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

  const existing = await db.user.findUnique({ where: { email: user.email } });
  if (existing) {
    if (!existing.supabaseUserId) {
      await db.user.update({
        where: { id: existing.id },
        data: { supabaseUserId: user.id },
      });
    }
  } else {
    await db.user.create({
      data: {
        email: user.email,
        name:
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          null,
        image: (user.user_metadata?.avatar_url as string | undefined) ?? null,
        supabaseUserId: user.id,
      },
    });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip");
  await notifySignalyLogin({ email: user.email, ip });

  const response = NextResponse.redirect(`${origin}${redirectPath}`);
  response.cookies.delete(AUTH_NEXT_COOKIE);
  return response;
}
