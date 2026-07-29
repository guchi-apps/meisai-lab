import { NextResponse, type NextRequest } from "next/server";

import { resolveOrigin } from "@/lib/request-origin";
import { createProxyClient } from "@/lib/supabase/proxy";

const publicPaths = ["/", "/auth/signin", "/auth/error", "/auth/callback"];

function isPublicPath(pathname: string): boolean {
  return publicPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default async function proxy(request: NextRequest) {
  const { supabase, getResponse } = createProxyClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const origin = resolveOrigin(request.headers, request.url);

  // /api/* はルートハンドラ自身が requireUserId() で認証チェックし、
  // 401 JSON を返す設計のため、proxy ではリダイレクトせず素通りさせる。
  if (pathname.startsWith("/api/")) {
    return getResponse();
  }

  if (isPublicPath(pathname)) {
    if (user && pathname === "/auth/signin") {
      return NextResponse.redirect(`${origin}/salaries`);
    }
    return getResponse();
  }

  if (!user) {
    const signInUrl = new URL(`${origin}/auth/signin`);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return getResponse();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|apple-icon).*)"],
};
