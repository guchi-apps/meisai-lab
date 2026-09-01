"use client";

import { useState } from "react";

import type { ResidentTaxBreakdownField, ResidentTaxOverrides } from "@/lib/annualTax";
import type { DeductionType } from "@/types";
import { TaxCalculationDetail } from "./tax-calculation-detail";
import { FurusatoNozeiEstimate } from "./furusato-nozei-estimate";
import { ChatGptSnapshotDialog } from "./chatgpt-snapshot-dialog";

export function TaxYearSection({
  year,
  amounts,
  overrides,
  overrideIds,
  isLocked,
  grossIncome,
  socialInsuranceTotal,
  incomeTaxWithheldTotal,
  salaryCount,
  bonusCount,
  estimatedGrossIncome,
  estimatedSocialInsuranceTotal,
  projectedSalaryMonths,
  projectedBonusMonths,
}: {
  year: number;
  amounts: Partial<Record<DeductionType, number>>;
  overrides: ResidentTaxOverrides;
  overrideIds: Partial<Record<ResidentTaxBreakdownField, string>>;
  isLocked: boolean;
  grossIncome: number;
  socialInsuranceTotal: number;
  incomeTaxWithheldTotal: number;
  salaryCount: number;
  bonusCount: number;
  estimatedGrossIncome: number;
  estimatedSocialInsuranceTotal: number;
  projectedSalaryMonths: number;
  projectedBonusMonths: number[];
}) {
  const [liveAmounts, setLiveAmounts] = useState(amounts);
  // 上限額の試算欄で書き換えた見込み値は、ChatGPT相談用スナップショットの上限額にも使う
  const [liveGrossIncome, setLiveGrossIncome] = useState<number | undefined>(
    estimatedGrossIncome || undefined
  );
  const [liveSocialInsuranceTotal, setLiveSocialInsuranceTotal] = useState<number | undefined>(
    estimatedSocialInsuranceTotal || undefined
  );

  return (
    <div className="space-y-6">
      <FurusatoNozeiEstimate
        year={year}
        estimatedGrossIncome={liveGrossIncome}
        estimatedSocialInsuranceTotal={liveSocialInsuranceTotal}
        onEstimatedGrossIncomeChange={setLiveGrossIncome}
        onEstimatedSocialInsuranceTotalChange={setLiveSocialInsuranceTotal}
        amounts={liveAmounts}
      />

      <ChatGptSnapshotDialog
        year={year}
        isLocked={isLocked}
        grossIncome={grossIncome}
        socialInsuranceTotal={socialInsuranceTotal}
        incomeTaxWithheldTotal={incomeTaxWithheldTotal}
        salaryCount={salaryCount}
        bonusCount={bonusCount}
        estimatedGrossIncome={liveGrossIncome ?? 0}
        estimatedSocialInsuranceTotal={liveSocialInsuranceTotal ?? 0}
        projectedSalaryMonths={projectedSalaryMonths}
        projectedBonusMonths={projectedBonusMonths}
        amounts={liveAmounts}
        overrides={overrides}
      />

      <div>
        <p className="mb-2 text-sm font-medium">所得税・住民税 計算方法の詳細</p>
        <TaxCalculationDetail
          year={year}
          amounts={amounts}
          overrides={overrides}
          overrideIds={overrideIds}
          grossIncome={grossIncome}
          socialInsuranceTotal={socialInsuranceTotal}
          incomeTaxWithheldTotal={incomeTaxWithheldTotal}
          onAmountsChange={setLiveAmounts}
        />
      </div>
    </div>
  );
}
