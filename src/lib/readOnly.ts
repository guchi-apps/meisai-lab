export const ASSET_MANAGER_ORIGIN = "https://asset.gucchii.com";

export const READ_ONLY_MESSAGE =
  "明細ラボは Asset Manager へ移りました。読み取り専用のため、登録・編集・削除などの更新はできません。";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** `MEISAI_READ_ONLY` が true / 1 のとき読み取り専用。実行時に読むので切替・切戻しに再ビルドは要らない。 */
export function isReadOnly(env: Record<string, string | undefined> = process.env): boolean {
  const value = env.MEISAI_READ_ONLY?.trim().toLowerCase();
  return value === "true" || value === "1";
}

export function isWriteMethod(method: string): boolean {
  return WRITE_METHODS.has(method.toUpperCase());
}

export function readOnlyResponse(): Response {
  return Response.json({ error: READ_ONLY_MESSAGE, code: "READ_ONLY" }, { status: 403 });
}

/** 読み取り専用のあいだ開かない登録・編集画面か。開いたときの戻り先（一覧）を返す。 */
export function listPathForWritePage(pathname: string): string | null {
  const match = /^\/(salaries|bonuses|furusato)(?:\/new|\/[^/]+\/edit)\/?$/.exec(pathname);
  return match ? `/${match[1]}` : null;
}

/** 明細ラボの画面パスに対応する Asset Manager 側のパス（クエリ付き）。対応が無ければ null。 */
export function assetManagerPath(pathname: string, search = ""): string | null {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  if (/^\/(salaries|bonuses|furusato)(\/new|\/[^/]+\/edit)?$/.test(path)) {
    return `${path}${search}`;
  }
  if (path === "/tax-return") return `/tax${search}`;
  if (path === "/settings" || path === "/settings/items") return `/salaries/settings${search}`;
  return null;
}

export function assetManagerUrl(pathname: string, search = ""): string {
  return `${ASSET_MANAGER_ORIGIN}${assetManagerPath(pathname, search) ?? "/"}`;
}
