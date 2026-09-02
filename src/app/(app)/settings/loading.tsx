import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsItemsLink } from "./items-link";

export default function Loading() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">設定</h1>

      <Card>
        <CardHeader>
          <CardTitle>プロフィール</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Skeleton className="size-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-40" />
          </div>
        </CardContent>
      </Card>

      {/* データに依存しないため、読み込み中もそのまま表示して遷移できるようにしている */}
      <SettingsItemsLink />

      <Card>
        <CardHeader>
          <CardTitle>保険料率</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>アプリ情報</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-24" />
        </CardContent>
      </Card>
    </div>
  );
}
