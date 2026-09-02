"use client";

import { useState } from "react";

import type { ResidentTaxBreakdownField, ResidentTaxOverrides } from "@/lib/annualTax";
import type { FurusatoDonationSummary, FurusatoNozeiIncomeProjection } from "@/lib/annualTaxData";
import type { DeductionType } from "@/types";
import { TaxCalculationDetail } from "./tax-calculation-detail";
import { FurusatoQuotaCard } from "./furusato-quota-card";
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
  projection,
  donationSummary,
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
  projection: FurusatoNozeiIncomeProjection;
  donationSummary: FurusatoDonationSummary;
}) {
  const [liveAmounts, setLiveAmounts] = useState(amounts);

  // 源泉徴収票の値で上書き済みならそちらを、まだなら実績＋見込みの推定値を初期値にする。
  // 残り枠カードの試算欄とChatGPT相談用スナップショットの両方が同じ見込み値を参照するため、
  // 試算の状態はこのコンポーネントで一元管理する
  const baseGrossIncome = overrides.annualGrossIncome ?? projection.estimatedGrossIncome;
  const baseSocialInsuranceTotal =
    overrides.socialInsuranceTotal ?? projection.estimatedSocialInsuranceTotal;

  const [estimatedGrossIncome, setEstimatedGrossIncome] = useState<number | undefined>(
    baseGrossIncome || undefined
  );
  const [estimatedSocialInsuranceTotal, setEstimatedSocialInsuranceTotal] = useState<
    number | undefined
  >(baseSocialInsuranceTotal || undefined);

  // 源泉徴収票の値を保存した直後など、サーバー側の初期値が変わったら試算欄も追従させる
  // （props の変化に合わせて state を作り直すため、レンダー中に直接更新する）
  const [baseValues, setBaseValues] = useState({ baseGrossIncome, baseSocialInsuranceTotal });
  if (
    baseValues.baseGrossIncome !== baseGrossIncome ||
    baseValues.baseSocialInsuranceTotal !== baseSocialInsuranceTotal
  ) {
    setBaseValues({ baseGrossIncome, baseSocialInsuranceTotal });
    setEstimatedGrossIncome(baseGrossIncome || undefined);
    setEstimatedSocialInsuranceTotal(baseSocialInsuranceTotal || undefined);
  }

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
        grossIncome={estimatedGrossIncome}
        socialInsuranceTotal={estimatedSocialInsuranceTotal}
        onGrossIncomeChange={setEstimatedGrossIncome}
        onSocialInsuranceTotalChange={setEstimatedSocialInsuranceTotal}
        onGoToWithholdingInput={goToWithholdingInput}
      />

      <ChatGptSnapshotDialog
        year={year}
        isLocked={isLocked}
        grossIncome={grossIncome}
        socialInsuranceTotal={socialInsuranceTotal}
        incomeTaxWithheldTotal={incomeTaxWithheldTotal}
        salaryCount={salaryCount}
        bonusCount={bonusCount}
        estimatedGrossIncome={estimatedGrossIncome ?? 0}
        estimatedSocialInsuranceTotal={estimatedSocialInsuranceTotal ?? 0}
        projectedSalaryMonths={projection.projectedSalaryMonthCount}
        projectedBonusMonths={projection.projectedBonusMonths}
        amounts={liveAmounts}
        overrides={overrides}
        donationSummary={donationSummary}
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
          donationSummary={donationSummary}
          onAmountsChange={setLiveAmounts}
        />
      </div>
    </div>
  );
}
