"use client";

import { useState } from "react";

import type { ResidentTaxBreakdownField, ResidentTaxOverrides } from "@/lib/annualTax";
import type { FurusatoDonationSummary } from "@/lib/annualTaxData";
import type { DeductionType } from "@/types";
import { TaxCalculationDetail } from "./tax-calculation-detail";
import { FurusatoNozeiEstimate } from "./furusato-nozei-estimate";

export function TaxYearSection({
  year,
  amounts,
  overrides,
  overrideIds,
  grossIncome,
  socialInsuranceTotal,
  incomeTaxWithheldTotal,
  estimatedGrossIncome,
  estimatedSocialInsuranceTotal,
  furusato,
}: {
  year: number;
  amounts: Partial<Record<DeductionType, number>>;
  overrides: ResidentTaxOverrides;
  overrideIds: Partial<Record<ResidentTaxBreakdownField, string>>;
  grossIncome: number;
  socialInsuranceTotal: number;
  incomeTaxWithheldTotal: number;
  estimatedGrossIncome: number;
  estimatedSocialInsuranceTotal: number;
  furusato: FurusatoDonationSummary;
}) {
  const [liveAmounts, setLiveAmounts] = useState(amounts);

  return (
    <div className="space-y-6">
      <FurusatoNozeiEstimate
        year={year}
        estimatedGrossIncome={estimatedGrossIncome}
        estimatedSocialInsuranceTotal={estimatedSocialInsuranceTotal}
        amounts={liveAmounts}
        furusatoDonationTotal={furusato.total}
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
          furusato={furusato}
          onAmountsChange={setLiveAmounts}
        />
      </div>
    </div>
  );
}
