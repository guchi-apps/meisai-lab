/**
 * proxy で Supabase のセッション確認を行わずに素通しするパス（#301）。
 *
 * `/api/app-version` はデプロイのヘルスチェックが 127.0.0.1 から未ログインで叩く。
 * セッション確認を通すと、Supabase Auth へ届かないときの 503 に巻き込まれて
 * 稼働中の版を照合できなくなるため、Supabase へ問い合わせる前に返す。
 * ここへ足してよいのは、認証情報もユーザーのデータも返さないエンドポイントだけ。
 */
const bypassPaths = ["/api/app-version"];

export function isProxyBypassPath(pathname: string): boolean {
  return bypassPaths.includes(pathname);
}
