import { redirect } from "next/navigation";

import { requireUserId } from "@/lib/auth-user";
import { db } from "@/lib/db";
import { SalariesClient } from "./salaries-client";
import type { ItemDTO, SalaryDTO } from "@/types";

export default async function SalariesPage() {
  const userId = await requireUserId();
  if (!userId) redirect("/auth/signin");

  const [salaries, items] = await Promise.all([
    db.salary.findMany({
      where: { userId, deletedAt: null },
      orderBy: { salaryDate: "desc" },
    }),
    db.item.findMany({
      where: { userId, scope: { in: ["salary", "both"] } },
      orderBy: { displayOrder: "asc" },
    }),
  ]);
  const salaryDtos = JSON.parse(JSON.stringify(salaries)) as SalaryDTO[];
  const itemDtos = JSON.parse(JSON.stringify(items)) as ItemDTO[];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">給与一覧</h1>

      <SalariesClient salaries={salaryDtos} items={itemDtos} />
    </div>
  );
}
