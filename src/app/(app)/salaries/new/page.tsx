
import { requirePageUserId } from "@/lib/auth-user";
import { db } from "@/lib/db";
import { buildAnnualTaxData } from "@/lib/annualTaxData";
import { findApplicableTaxSetting } from "@/lib/taxSetting";
import { SalaryForm } from "@/components/SalaryForm";
import type { ItemDTO, TaxSettingDTO } from "@/types";

export default async function NewSalaryPage() {
  const userId = await requirePageUserId();

  const currentYear = new Date().getFullYear();
  const candidateYears = [currentYear - 1, currentYear - 2];
  const [taxSetting, items, previousSalary, annualTaxData] = await Promise.all([
    findApplicableTaxSetting(userId, new Date()),
    db.item.findMany({
      where: { userId, isActive: true, scope: { in: ["salary", "both"] } },
      orderBy: { displayOrder: "asc" },
    }),
    db.salary.findFirst({
      where: { userId, deletedAt: null },
      orderBy: { salaryDate: "desc" },
    }),
    buildAnnualTaxData(userId, candidateYears),
  ]);
  const taxSettingDto = taxSetting
    ? (JSON.parse(JSON.stringify(taxSetting)) as TaxSettingDTO)
    : null;
  const itemDtos = JSON.parse(JSON.stringify(items)) as ItemDTO[];
  const previousSalaryData = previousSalary?.data as Record<string, unknown> | undefined;
  const previousStandardMonthlyRemuneration = (() => {
    const value = previousSalaryData?.standardMonthlyRemuneration;
    return typeof value === "number" ? value : undefined;
  })();
  // 給与明細PDFには年月しか無いため、支給日の「日」は前回の支給日に揃える（#256）。
  // 支給日は日付入力の値を UTC の0時として保存している
  const pdfImportPayday = previousSalary ? previousSalary.salaryDate.getUTCDate() : 25;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">給与を登録</h1>
      <SalaryForm
        taxSetting={taxSettingDto}
        items={itemDtos}
        previousStandardMonthlyRemuneration={previousStandardMonthlyRemuneration}
        previousSalaryData={previousSalaryData}
        annualTaxData={annualTaxData}
        pdfImportPayday={pdfImportPayday}
      />
    </div>
  );
}
