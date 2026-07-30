import { redirect } from "next/navigation";
import { ReceiptJapaneseYen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { requireUserId } from "@/lib/auth-user";
import { signInWithGoogleAction } from "@/app/actions/auth";
import { SignInButton } from "./sign-in-button";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  const userId = await requireUserId();
  if (userId) {
    // callbackUrl は外部ドメインへ誘導するオープンリダイレクトに悪用され得るため、
    // サイト内の相対パスであることを確認してから使う
    const isSafeCallbackUrl = callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//");
    redirect(isSafeCallbackUrl ? callbackUrl : "/salaries");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6">
      <Card className="w-full max-w-sm text-center">
        <CardHeader className="items-center">
          <span className="mb-2 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ReceiptJapaneseYen className="size-6" />
          </span>
          <CardTitle className="text-xl">ログイン</CardTitle>
          <CardDescription>Googleアカウントでログインしてください。</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signInWithGoogleAction.bind(null, callbackUrl)}>
            <SignInButton />
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
