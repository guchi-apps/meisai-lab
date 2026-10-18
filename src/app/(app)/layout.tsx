import { Navigation } from "@/components/Navigation";
import { AppMain } from "@/components/AppMain";
import { ReadOnlyBanner } from "@/components/ReadOnlyBanner";
import { isReadOnly } from "@/lib/readOnly";

// 読み取り専用スイッチは実行時の環境変数なので、ビルド時に固定させない。
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Navigation />
      {isReadOnly() && <ReadOnlyBanner />}
      <AppMain>{children}</AppMain>
    </div>
  );
}
