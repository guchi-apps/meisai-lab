"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function AppMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    ref.current?.scrollTo(0, 0);
  }, [pathname]);

  return (
    <main ref={ref} className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
      {children}
    </main>
  );
}
