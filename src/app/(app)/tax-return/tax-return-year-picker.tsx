"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TaxReturnYearPicker({ existingYears }: { existingYears: number[] }) {
  const router = useRouter();
  const [year, setYear] = useState(() => String(new Date().getFullYear() - 1));

  function handleAdd() {
    const parsed = Number(year);
    if (!Number.isInteger(parsed)) return;
    if (existingYears.includes(parsed)) {
      toast.error(`${parsed}年は既に追加されています`);
      return;
    }
    router.push(`/tax-return?year=${parsed}`);
  }

  return (
    <div className="flex max-w-xs items-end gap-2">
      <div className="flex-1 space-y-1.5">
        <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
      </div>
      <Button type="button" onClick={handleAdd}>
        表示する
      </Button>
    </div>
  );
}
