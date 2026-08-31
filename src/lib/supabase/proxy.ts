import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export function createProxyClient(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  return { supabase, getResponse: () => response };
}

/**
 * 「セッションが無効」ではなく「今は確認できなかった」ことを示すエラーか。
 *
 * auth-js は通信不達と HTTP 5xx を AuthRetryableFetchError（通信不達は status 0）で返す。
 * 判定関数 isAuthRetryableFetchError() は @supabase/supabase-js から再公開されておらず、
 * auth-js を直接の依存に加えたくないため、同じ判定をここに置く。
 * レート制限(429)も同じ扱いにする。時間をおけば通るもので、ログアウトさせる理由がない。
 */
export function isAuthUnreachable(error: { name: string; status?: number } | null): boolean {
  if (!error) return false;
  return error.name === "AuthRetryableFetchError" || error.status === 429;
}

/**
 * ログイン状態を確認できなかったことを伝える応答。
 *
 * 401 にしないのは「認証が通らなかった」ではなく「今は確認できない」ためで、
 * 画面側にログアウトされたと解釈させない。
 */
export function serviceUnavailable(pathname: string): NextResponse {
  const headers = { "Retry-After": "5", "Cache-Control": "no-store" };

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "ログイン状態を確認できませんでした。通信状況を確認して、もう一度お試しください。" },
      { status: 503, headers: { ...headers } }
    );
  }

  return new NextResponse(
    `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>明細ラボ</title>
  </head>
  <body style="font-family: system-ui, sans-serif; display: grid; place-items: center; height: 100dvh; margin: 0; text-align: center;">
    <div>
      <p>ログイン状態を確認できませんでした。</p>
      <p>通信状況を確認して、もう一度お試しください。</p>
      <p><a href="">再読み込み</a></p>
    </div>
  </body>
</html>
`,
    { status: 503, headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } }
  );
}
