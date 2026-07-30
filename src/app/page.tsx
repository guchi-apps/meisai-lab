import { redirect } from "next/navigation";
import { LineChart, ReceiptJapaneseYen } from "lucide-react";
import { requireUserId } from "@/lib/auth-user";
import { signInWithGoogleAction } from "@/app/actions/auth";
import { HomeSignInButton } from "./home-signin-button";

export default async function Home() {
  const userId = await requireUserId();
  if (userId) {
    redirect("/salaries");
  }

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-24 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_60%)]"
      />

      <span className="mb-6 inline-flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
        <ReceiptJapaneseYen className="size-7" />
      </span>

      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">明細ラボ</h1>
      <p className="mt-4 max-w-md text-balance text-muted-foreground">
        給与・賞与の記録と可視化をシンプルに。Googleアカウントでログインして始めましょう。
      </p>

      <form action={signInWithGoogleAction.bind(null, undefined)}>
        <HomeSignInButton />
      </form>

      <div className="mt-16 flex items-center gap-2 text-xs text-muted-foreground">
        <LineChart className="size-4" />
        給与・賞与の推移をグラフでひと目で確認
      </div>
    </div>
  );
}
