"use client";

import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function FurusatoYearPicker({
  years,
  selectedYear,
}: {
  years: number[];
  selectedYear: number;
}) {
  const router = useRouter();

  return (
    <Select
      value={String(selectedYear)}
      onValueChange={(value) => router.push(`/furusato?year=${value}`)}
    >
      <SelectTrigger className="w-36" aria-label="対象年">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {years.map((year) => (
          <SelectItem key={year} value={String(year)}>
            {year}年分
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
