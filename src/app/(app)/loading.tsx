import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
      <span className="sr-only">読み込み中</span>
    </div>
  );
}
