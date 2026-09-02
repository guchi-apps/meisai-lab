import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** グローバルナビから直接来られないため、設定へ戻る導線を見出しの上に置いている。 */
export function ItemsBreadcrumb() {
  return (
    <nav aria-label="パンくず" className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Link
        href="/settings"
        className="flex items-center gap-1.5 transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        設定
      </Link>
      <span aria-hidden className="opacity-50">
        /
      </span>
      <span className="font-medium text-foreground">項目管理</span>
    </nav>
  );
}
