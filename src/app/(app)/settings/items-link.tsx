import Link from "next/link";
import { ChevronRight, ListChecks } from "lucide-react";

import { Card } from "@/components/ui/card";

/** 設定画面から項目管理ページ（/settings/items）へ入るためのカード。 */
export function SettingsItemsLink() {
  return (
    <Card className="py-0">
      <Link
        href="/settings/items"
        className="flex items-center gap-4 p-(--card-spacing) transition-colors hover:bg-accent/50"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ListChecks className="size-5" />
        </span>
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="font-medium">項目管理</span>
          <span className="text-sm text-muted-foreground">
            給与・賞与の明細に使う項目を追加し、並び順と表示・非表示を設定します
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
      </Link>
    </Card>
  );
}
