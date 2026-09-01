"use client";

import { useState } from "react";

import type { ResidentTaxBreakdownField, ResidentTaxOverrides } from "@/lib/annualTax";
import type { FurusatoDonationSummary, FurusatoNozeiIncomeProjection } from "@/lib/annualTaxData";
import type { DeductionType } from "@/types";
import { TaxCalculationDetail } from "./tax-calculation-detail";
import { FurusatoQuotaCard } from "./furusato-quota-card";

export function TaxYearSection({
  year,
  amounts,
  overrides,
  overrideIds,
  grossIncome,
  socialInsuranceTotal,
  incomeTaxWithheldTotal,
  projection,
  donationSummary,
}: {
  year: number;
  amounts: Partial<Record<DeductionType, number>>;
  overrides: ResidentTaxOverrides;
  overrideIds: Partial<Record<ResidentTaxBreakdownField, string>>;
  grossIncome: number;
  socialInsuranceTotal: number;
  incomeTaxWithheldTotal: number;
  projection: FurusatoNozeiIncomeProjection;
  donationSummary: FurusatoDonationSummary;
}) {
  const [liveAmounts, setLiveAmounts] = useState(amounts);

  // 残り枠カードの「源泉徴収票の値を入力して確定する」から、計算過程の「給与」の入力欄へ送る
  function goToWithholdingInput() {
    const input = document.getElementById(`annualGrossIncome-${year}`);
    if (!(input instanceof HTMLInputElement)) return;
    input.scrollIntoView({ behavior: "smooth", block: "center" });
    input.focus({ preventScroll: true });
  }

  return (
    <div className="space-y-6">
      <FurusatoQuotaCard
        year={year}
        projection={projection}
        donationSummary={donationSummary}
        amounts={liveAmounts}
        overrides={overrides}
        onGoToWithholdingInput={goToWithholdingInput}
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
