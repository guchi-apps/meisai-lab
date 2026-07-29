import { redirect } from "next/navigation";

import { requireUserId } from "@/lib/auth-user";
import { db } from "@/lib/db";
import { BonusesClient } from "./bonuses-client";
import type { BonusDTO, ItemDTO } from "@/types";

export default async function BonusesPage() {
  const userId = await requireUserId();
  if (!userId) redirect("/auth/signin");

  const [bonuses, items] = await Promise.all([
    db.bonus.findMany({
      where: { userId, deletedAt: null },
      orderBy: { bonusDate: "desc" },
    }),
    db.item.findMany({
      where: { userId, scope: { in: ["bonus", "both"] } },
      orderBy: { displayOrder: "asc" },
    }),
  ]);
  const bonusDtos = JSON.parse(JSON.stringify(bonuses)) as BonusDTO[];
  const itemDtos = JSON.parse(JSON.stringify(items)) as ItemDTO[];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">賞与一覧</h1>

      <BonusesClient bonuses={bonusDtos} items={itemDtos} />
    </div>
  );
}
