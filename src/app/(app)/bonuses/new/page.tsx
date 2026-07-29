import { redirect } from "next/navigation";

import { requireUserId } from "@/lib/auth-user";
import { db } from "@/lib/db";
import { findApplicableTaxSetting } from "@/lib/taxSetting";
import { calculatePreviousMonthTaxableSalary } from "@/lib/calculations";
import { BonusForm } from "@/components/BonusForm";
import type { ItemDTO, TaxSettingDTO } from "@/types";

export default async function NewBonusPage() {
  const userId = await requireUserId();
  if (!userId) redirect("/auth/signin");

  const [taxSetting, items, salaryItems, previousSalary] = await Promise.all([
    findApplicableTaxSetting(userId, new Date()),
    db.item.findMany({
      where: { userId, isActive: true, scope: { in: ["bonus", "both"] } },
      orderBy: { displayOrder: "asc" },
    }),
    db.item.findMany({
      where: { userId, scope: { in: ["salary", "both"] } },
    }),
    db.salary.findFirst({
      where: { userId, deletedAt: null },
      orderBy: { salaryDate: "desc" },
    }),
  ]);
  const taxSettingDto = taxSetting
    ? (JSON.parse(JSON.stringify(taxSetting)) as TaxSettingDTO)
    : null;
  const itemDtos = JSON.parse(JSON.stringify(items)) as ItemDTO[];
  const previousMonthTaxableSalary = previousSalary
    ? calculatePreviousMonthTaxableSalary(
        { grossSalary: Number(previousSalary.grossSalary), data: previousSalary.data as Record<string, unknown> },
        salaryItems
      )
    : undefined;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">賞与を登録</h1>
      <BonusForm
        taxSetting={taxSettingDto}
        items={itemDtos}
        previousMonthTaxableSalary={previousMonthTaxableSalary}
      />
    </div>
  );
}
