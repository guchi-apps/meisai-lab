"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { assetManagerUrl, READ_ONLY_MESSAGE } from "@/lib/readOnly";

function BannerBody() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const href = assetManagerUrl(pathname, search ? `?${search}` : "");

  return (
    <div
      role="status"
      className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
    >
      <p className="font-medium">Asset Manager へ移りました</p>
      <p className="text-xs">{READ_ONLY_MESSAGE}</p>
      <a href={href} className="text-sm font-medium underline underline-offset-2">
        Asset Manager の同じ画面を開く
      </a>
    </div>
  );
}

export function ReadOnlyBanner() {
  return (
    <Suspense fallback={null}>
      <BannerBody />
    </Suspense>
  );
}
