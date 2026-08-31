import { Loader2, ReceiptJapaneseYen } from "lucide-react";

export function AppSplash() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-24 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_60%)]"
      />

      <span className="mb-6 inline-flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
        <ReceiptJapaneseYen className="size-7" />
      </span>

      <h1 className="text-2xl font-semibold tracking-tight">明細ラボ</h1>

      <Loader2 className="mt-6 size-6 animate-spin text-muted-foreground" aria-hidden />
      <span className="sr-only">読み込み中</span>
    </div>
  );
}
