import { notFound, redirect } from "next/navigation";

import { requirePageUserId } from "@/lib/auth-user";
import { db } from "@/lib/db";
import { findApplicableTaxSetting } from "@/lib/taxSetting";
import { resolveEditableItems, savedItemIds } from "@/lib/editableItems";
import { calculatePreviousMonthTaxableSalary } from "@/lib/calculations";
import { BonusForm } from "@/components/BonusForm";
import type { BonusDTO, ItemDTO, TaxSettingDTO } from "@/types";

export default async function EditBonusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await requirePageUserId();

  const { id } = await params;
  const bonus = await db.bonus.findFirst({ where: { id, userId, deletedAt: null } });
  if (!bonus) notFound();

  // 無効化・適用範囲の変更をした項目でも、この明細に金額があるものは読み込む（保存時に金額が消えないように）
  const savedIds = savedItemIds(bonus.data);
  const [taxSetting, items, salaryItems, previousSalary] = await Promise.all([
    findApplicableTaxSetting(userId, bonus.bonusDate),
    db.item.findMany({
      where: {
        userId,
        OR: [{ isActive: true, scope: { in: ["bonus", "both"] } }, { id: { in: savedIds } }],
      },
      orderBy: { displayOrder: "asc" },
    }),
    db.item.findMany({
      where: { userId, scope: { in: ["salary", "both"] } },
    }),
    db.salary.findFirst({
      where: { userId, deletedAt: null, salaryDate: { lt: bonus.bonusDate } },
      orderBy: { salaryDate: "desc" },
    }),
  ]);

  const bonusDto = JSON.parse(JSON.stringify(bonus)) as BonusDTO;
  const taxSettingDto = taxSetting
    ? (JSON.parse(JSON.stringify(taxSetting)) as TaxSettingDTO)
    : null;
  const itemDtos = resolveEditableItems(
    JSON.parse(JSON.stringify(items)) as ItemDTO[],
    bonus.data,
    "bonus"
  );
  const previousMonthTaxableSalary = previousSalary
    ? calculatePreviousMonthTaxableSalary(
        { grossSalary: Number(previousSalary.grossSalary), data: previousSalary.data as Record<string, unknown> },
        salaryItems
      )
    : undefined;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">賞与を編集</h1>
      <BonusForm
        bonus={bonusDto}
        taxSetting={taxSettingDto}
        items={itemDtos}
        previousMonthTaxableSalary={previousMonthTaxableSalary}
      />
    </div>
  );
}
