import { redirect } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { requireUserId } from "@/lib/auth-user";
import { db } from "@/lib/db";
import {
  getAnnualAggregate,
  getFurusatoNozeiIncomeProjection,
  getYearsWithTaxReturnData,
} from "@/lib/annualTaxData";
import {
  RESIDENT_TAX_BREAKDOWN_FIELDS,
  type ResidentTaxBreakdownField,
  type ResidentTaxOverrides,
} from "@/lib/annualTax";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TaxYearSection } from "./tax-year-section";
import { TaxReturnYearPicker } from "./tax-return-year-picker";
import type { DeductionType } from "@/types";

export default async function TaxReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const userId = await requireUserId();
  if (!userId) redirect("/auth/signin");

  const { year: yearParam } = await searchParams;
  const currentYear = new Date().getFullYear();
  const requestedYear = yearParam ? Number(yearParam) : currentYear - 1;

  const existingYears = await getYearsWithTaxReturnData(userId);
  const years = Array.from(new Set([...existingYears, requestedYear])).sort((a, b) => b - a);

  const [deductions, overrideRows, aggregates, incomeProjections] = await Promise.all([
    db.deduction.findMany({ where: { userId, year: { in: years } } }),
    db.taxCalculationOverride.findMany({ where: { userId, year: { in: years } } }),
    Promise.all(years.map((year) => getAnnualAggregate(userId, year))),
    Promise.all(years.map((year) => getFurusatoNozeiIncomeProjection(userId, year))),
  ]);

  const amountsByYear = new Map<number, Partial<Record<DeductionType, number>>>();
  for (const d of deductions) {
    const entry = amountsByYear.get(d.year) ?? {};
    entry[d.deductionType as DeductionType] = Number(d.amount);
    amountsByYear.set(d.year, entry);
  }

  const overridesByYear = new Map<number, ResidentTaxOverrides>();
  const overrideIdsByYear = new Map<number, Partial<Record<ResidentTaxBreakdownField, string>>>();
  for (const o of overrideRows) {
    const field = o.field as ResidentTaxBreakdownField;
    const valueEntry = overridesByYear.get(o.year) ?? {};
    valueEntry[field] = Number(o.amount);
    overridesByYear.set(o.year, valueEntry);

    const idEntry = overrideIdsByYear.get(o.year) ?? {};
    idEntry[field] = o.id;
    overrideIdsByYear.set(o.year, idEntry);
  }

  const yearBlocks = years.map((year, i) => {
    const amounts = amountsByYear.get(year) ?? {};
    const { grossIncome, socialInsuranceTotal, incomeTaxWithheldTotal } = aggregates[i];
    const { estimatedGrossIncome, estimatedSocialInsuranceTotal } = incomeProjections[i];
    const overrides = overridesByYear.get(year) ?? {};
    const overrideIds = overrideIdsByYear.get(year) ?? {};
    const isLocked = RESIDENT_TAX_BREAKDOWN_FIELDS.every((field) => overrideIds[field] !== undefined);
    return {
      year,
      amounts,
      overrides,
      overrideIds,
      isLocked,
      grossIncome,
      socialInsuranceTotal,
      incomeTaxWithheldTotal,
      estimatedGrossIncome,
      estimatedSocialInsuranceTotal,
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">確定申告データ</h1>

      <Card>
        <CardHeader>
          <CardTitle>年を追加</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            まだ表示されていない年のデータを入力・確認したい場合は、対象の年を指定してください。
          </p>
          <TaxReturnYearPicker existingYears={existingYears} />
        </CardContent>
      </Card>

      {yearBlocks.map(
        ({
          year,
          amounts,
          overrides,
          overrideIds,
          isLocked,
          grossIncome,
          socialInsuranceTotal,
          incomeTaxWithheldTotal,
          estimatedGrossIncome,
          estimatedSocialInsuranceTotal,
        }) => (
          <Card key={year}>
            <Collapsible defaultOpen={false} className="contents">
              <CollapsibleTrigger className="group flex w-full items-center justify-between text-left">
                <CardHeader className="flex-1">
                  <CardTitle className="flex items-center gap-2">
                    {year}年分
                    {isLocked && <Badge variant="secondary">確定済み</Badge>}
                  </CardTitle>
                </CardHeader>
                <ChevronDown className="mr-6 size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <TaxYearSection
                    year={year}
                    amounts={amounts}
                    overrides={overrides}
                    overrideIds={overrideIds}
                    grossIncome={grossIncome}
                    socialInsuranceTotal={socialInsuranceTotal}
                    incomeTaxWithheldTotal={incomeTaxWithheldTotal}
                    estimatedGrossIncome={estimatedGrossIncome}
                    estimatedSocialInsuranceTotal={estimatedSocialInsuranceTotal}
                  />
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )
      )}
    </div>
  );
}
