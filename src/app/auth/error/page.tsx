import Link from "next/link";
import { OctagonAlert } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;

  // Supabase 上はログイン済みだが DB に対応する User が無い。/auth/signin へ戻すと proxy が
  // 保護ページへ差し戻して抜け出せなくなるため、ここでログアウトさせる。
  const accountMissing = reason === "account-missing";

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6">
      <Card className="w-full max-w-sm text-center">
        <CardHeader className="items-center">
          <span className="mb-2 flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <OctagonAlert className="size-6" />
          </span>
          <CardTitle className="text-xl">
            {accountMissing ? "アカウント情報を確認できませんでした" : "ログインに失敗しました"}
          </CardTitle>
          <CardDescription>
            {accountMissing
              ? "ログイン中のアカウントに対応する利用者情報が見つかりません。いったんログアウトして、もう一度ログインしてください。"
              : "時間をおいて再度お試しください。"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accountMissing ? (
            <form action={signOutAction}>
              <Button type="submit" className="w-full rounded-full">
                ログアウトする
              </Button>
            </form>
          ) : (
            <Button asChild className="w-full rounded-full">
              <Link href="/auth/signin">ログインページへ戻る</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
