import { notFound, redirect } from "next/navigation";

import { requireUserId } from "@/lib/auth-user";
import { db } from "@/lib/db";
import { buildAnnualTaxData } from "@/lib/annualTaxData";
import { findApplicableTaxSetting } from "@/lib/taxSetting";
import { SalaryForm } from "@/components/SalaryForm";
import type { ItemDTO, SalaryDTO, TaxSettingDTO } from "@/types";

export default async function EditSalaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await requireUserId();
  if (!userId) redirect("/auth/signin");

  const { id } = await params;
  const salary = await db.salary.findFirst({ where: { id, userId, deletedAt: null } });
  if (!salary) notFound();

  const year = salary.salaryDate.getFullYear();
  const candidateYears = [year - 1, year - 2];
  const [taxSetting, items, previousSalary, annualTaxData] = await Promise.all([
    findApplicableTaxSetting(userId, salary.salaryDate),
    db.item.findMany({
      where: { userId, isActive: true, scope: { in: ["salary", "both"] } },
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
  const itemDtos = JSON.parse(JSON.stringify(items)) as ItemDTO[];
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
