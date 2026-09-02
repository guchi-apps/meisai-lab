import { Skeleton } from "@/components/ui/skeleton";
import { ItemsBreadcrumb } from "./breadcrumb";

export default function Loading() {
  return (
    <div className="space-y-4">
      <ItemsBreadcrumb />
      <h1 className="text-2xl font-semibold">項目管理</h1>

      <div className="flex justify-end">
        <Skeleton className="h-9 w-28" />
      </div>

      <div className="space-y-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
