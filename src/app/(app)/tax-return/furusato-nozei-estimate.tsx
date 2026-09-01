"use client";

import { useMemo } from "react";
import { Info } from "lucide-react";

import { calculateAnnualResidentTax } from "@/lib/annualTax";
import { AmountInput } from "@/components/ui/amount-input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DeductionType } from "@/types";

function FormulaInfo({ formula }: { formula: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="計算式を表示"
          className="text-muted-foreground hover:text-foreground"
        >
          <Info className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="text-xs leading-relaxed">{formula}</PopoverContent>
    </Popover>
  );
}

export function FurusatoNozeiEstimate({
  year,
  estimatedGrossIncome,
  estimatedSocialInsuranceTotal,
  onEstimatedGrossIncomeChange: setEstimatedGrossIncome,
  onEstimatedSocialInsuranceTotalChange: setEstimatedSocialInsuranceTotal,
  amounts,
}: {
  year: number;
  estimatedGrossIncome: number | undefined;
  estimatedSocialInsuranceTotal: number | undefined;
  onEstimatedGrossIncomeChange: (value: number | undefined) => void;
  onEstimatedSocialInsuranceTotalChange: (value: number | undefined) => void;
  amounts: Partial<Record<DeductionType, number>>;
}) {
  const limit = useMemo(() => {
    const breakdown = calculateAnnualResidentTax({
      annualGrossIncome: estimatedGrossIncome ?? 0,
      socialInsuranceTotal: estimatedSocialInsuranceTotal ?? 0,
      lifeInsuranceGeneral: amounts.lifeInsuranceGeneral ?? 0,
      lifeInsuranceCareMedical: amounts.lifeInsuranceCareMedical ?? 0,
      lifeInsurancePension: amounts.lifeInsurancePension ?? 0,
      furusatoNozei: amounts.furusatoNozei ?? 0,
      incomeTaxWithheldTotal: 0,
    });
    return breakdown.furusatoNozeiLimit.value;
  }, [
    estimatedGrossIncome,
    estimatedSocialInsuranceTotal,
    amounts.lifeInsuranceGeneral,
    amounts.lifeInsuranceCareMedical,
    amounts.lifeInsurancePension,
    amounts.furusatoNozei,
  ]);

  return (
    <div className="max-w-sm space-y-3 rounded-md border p-3">
      <p className="text-sm font-semibold">ふるさと納税 上限額の目安（{year}年・見込み）</p>
      <p className="text-xs text-muted-foreground">
        登録済みの給与・賞与の実績から、まだ登録していない残り月分を見込んだ年収・社会保険料を自動計算し、初期値として表示しています（給与は直近の基本給と同水準の月の平均、賞与は前年同月の実績を参考に見込んでいます）。必要に応じて下の欄を書き換えて試算できます（保存はされません）。
      </p>
      <div className="space-y-1.5">
        <div className="flex items-center gap-1">
          <Label htmlFor={`estimatedGrossIncome-${year}`}>見込み年収（給与・賞与の合計）</Label>
          <FormulaInfo
            formula={
              "給与: 登録済みの給与実績合計 + (直近の給与明細と同じ基本給の月だけで平均した支給額 × 未登録の残り月数)。" +
              "賞与: 登録済みの賞与実績合計 + (前年に支給があった月のうち、その年にまだ登録がない月は前年同月の支給額を加算)。"
            }
          />
        </div>
        <AmountInput
          id={`estimatedGrossIncome-${year}`}
          value={estimatedGrossIncome}
          onChange={setEstimatedGrossIncome}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`estimatedSocialInsuranceTotal-${year}`}>
          見込み社会保険料（健康保険・厚生年金・雇用保険の合計）
        </Label>
        <AmountInput
          id={`estimatedSocialInsuranceTotal-${year}`}
          value={estimatedSocialInsuranceTotal}
          onChange={setEstimatedSocialInsuranceTotal}
        />
      </div>
      <p className="text-sm">
        上限額の目安:{" "}
        <span className="text-lg font-semibold tabular-nums">
          {Math.max(Math.round(limit), 0).toLocaleString()} 円
        </span>
      </p>
    </div>
  );
}
