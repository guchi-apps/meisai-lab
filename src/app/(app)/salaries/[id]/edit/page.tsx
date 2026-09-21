import { notFound, redirect } from "next/navigation";

import { requirePageUserId } from "@/lib/auth-user";
import { db } from "@/lib/db";
import { buildAnnualTaxData } from "@/lib/annualTaxData";
import { resolveEditableItems, savedItemIds } from "@/lib/editableItems";
import { findApplicableTaxSetting } from "@/lib/taxSetting";
import { SalaryForm } from "@/components/SalaryForm";
import type { ItemDTO, SalaryDTO, TaxSettingDTO } from "@/types";

export default async function EditSalaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await requirePageUserId();

  const { id } = await params;
  const salary = await db.salary.findFirst({ where: { id, userId, deletedAt: null } });
  if (!salary) notFound();

  const year = salary.salaryDate.getFullYear();
  const candidateYears = [year - 1, year - 2];
  // 無効化・適用範囲の変更をした項目でも、この明細に金額があるものは読み込む（保存時に金額が消えないように）
  const savedIds = savedItemIds(salary.data);
  const [taxSetting, items, previousSalary, annualTaxData] = await Promise.all([
    findApplicableTaxSetting(userId, salary.salaryDate),
    db.item.findMany({
      where: {
        userId,
        OR: [{ isActive: true, scope: { in: ["salary", "both"] } }, { id: { in: savedIds } }],
      },
      orderBy: { displayOrder: "asc" },
    }),
    db.salary.findFirst({
      where: { userId, deletedAt: null, salaryDate: { lt: salary.salaryDate } },
      orderBy: { salaryDate: "desc" },
    }),
    buildAnnualTaxData(userId, candidateYears),
  ]);

  const salaryDto = JSON.parse(JSON.stringify(salary)) as SalaryDTO;
  const taxSettingDto = taxSetting
    ? (JSON.parse(JSON.stringify(taxSetting)) as TaxSettingDTO)
    : null;
  const itemDtos = resolveEditableItems(
    JSON.parse(JSON.stringify(items)) as ItemDTO[],
    salary.data,
    "salary"
  );
  const previousSalaryData = previousSalary?.data as Record<string, unknown> | undefined;
  const previousStandardMonthlyRemuneration = (() => {
    const value = previousSalaryData?.standardMonthlyRemuneration;
    return typeof value === "number" ? value : undefined;
  })();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">給与を編集</h1>
      <SalaryForm
        salary={salaryDto}
        taxSetting={taxSettingDto}
        items={itemDtos}
        previousStandardMonthlyRemuneration={previousStandardMonthlyRemuneration}
        previousSalaryData={previousSalaryData}
        annualTaxData={annualTaxData}
      />
    </div>
  );
}
