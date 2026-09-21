// 一意制約（@@unique）違反を 409 として返し、フォーム側で理由を表示するための共通処理。
// サーバー・クライアントの両方から使うため、Prisma などのサーバー専用モジュールには依存しない。

export const SALARY_DATE_CONFLICT_MESSAGE =
  "同じ支給日の給与明細がすでにあります。既存の明細を編集するか、別の支給日を指定してください";
export const BONUS_DATE_CONFLICT_MESSAGE =
  "同じ支給日の賞与明細がすでにあります。既存の明細を編集するか、別の支給日を指定してください";
export const TAX_SETTING_CONFLICT_MESSAGE =
  "同じ適用開始年月の保険料率がすでにあります。既存の設定を編集するか、別の年月を指定してください";

const PRISMA_UNIQUE_CONSTRAINT_CODE = "P2002";

export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === PRISMA_UNIQUE_CONSTRAINT_CODE
  );
}

export function conflictResponse(message: string) {
  return Response.json({ error: message }, { status: 409 });
}

// 409 のときだけサーバーが返した説明を使う。それ以外や解釈できない場合は fallback。
export async function readConflictMessage(res: Response, fallback: string): Promise<string> {
  if (res.status !== 409) return fallback;
  try {
    const body: unknown = await res.json();
    if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
      return body.error;
    }
  } catch {
    // 本文がJSONでなければ fallback を使う
  }
  return fallback;
}
