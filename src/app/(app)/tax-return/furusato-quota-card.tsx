"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

import { calculateAnnualResidentTax, type ResidentTaxOverrides } from "@/lib/annualTax";
import type { FurusatoDonationSummary, FurusatoNozeiIncomeProjection } from "@/lib/annualTaxData";
import { AmountInput } from "@/components/ui/amount-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { DeductionType } from "@/types";

// 現行の計算が対応していない控除。該当があると実際の上限額は下がるため、
// 上限額を確定値として扱わないことを画面上で明示する。
const UNSUPPORTED_DEDUCTIONS = ["医療費控除", "住宅ローン控除", "扶養控除・配偶者控除"];

function formatYen(value: number): string {
  return `${Math.round(value).toLocaleString()} 円`;
}

function formatSignedYen(value: number): string {
  const rounded = Math.round(value);
  if (rounded === 0) return "±0 円";
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded).toLocaleString()} 円`;
}

function formatMonths(months: number[]): string {
  return months.map((month) => `${month}月`).join("・");
}

function DiffValue({ value }: { value: number }) {
  const rounded = Math.round(value);
  return (
    <span
      className={cn(
        "font-semibold tabular-nums",
        rounded > 0 && "text-primary",
        rounded < 0 && "text-destructive"
      )}
    >
      {formatSignedYen(rounded)}
    </span>
  );
}

export function FurusatoQuotaCard({
  year,
  projection,
  donationSummary,
  amounts,
  overrides,
  onGoToWithholdingInput,
}: {
  year: number;
  projection: FurusatoNozeiIncomeProjection;
  donationSummary: FurusatoDonationSummary;
  amounts: Partial<Record<DeductionType, number>>;
  overrides: ResidentTaxOverrides;
  onGoToWithholdingInput: () => void;
}) {
  // 源泉徴収票の値で上書き済みならそちらを、まだなら実績＋見込みの推定値を初期値にする
  const baseGrossIncome = overrides.annualGrossIncome ?? projection.estimatedGrossIncome;
  const baseSocialInsuranceTotal =
    overrides.socialInsuranceTotal ?? projection.estimatedSocialInsuranceTotal;

  const [grossIncome, setGrossIncome] = useState<number | undefined>(baseGrossIncome || undefined);
  const [socialInsuranceTotal, setSocialInsuranceTotal] = useState<number | undefined>(
    baseSocialInsuranceTotal || undefined
  );

  // 源泉徴収票の値を保存した直後など、サーバー側の初期値が変わったら試算欄も追従させる
  // （props の変化に合わせて state を作り直すため、レンダー中に直接更新する）
  const [baseValues, setBaseValues] = useState({ baseGrossIncome, baseSocialInsuranceTotal });
  if (
    baseValues.baseGrossIncome !== baseGrossIncome ||
    baseValues.baseSocialInsuranceTotal !== baseSocialInsuranceTotal
  ) {
    setBaseValues({ baseGrossIncome, baseSocialInsuranceTotal });
    setGrossIncome(baseGrossIncome || undefined);
    setSocialInsuranceTotal(baseSocialInsuranceTotal || undefined);
  }

  // 年収・社会保険料はこのカードの入力欄で試算するため、手入力の上書きからは外して渡す。
  // それ以外の上書き（ふるさと納税上限そのものの上書きなど）は尊重する。
  const limitOverrides = useMemo(() => {
    const rest: ResidentTaxOverrides = { ...overrides };
    delete rest.annualGrossIncome;
    delete rest.socialInsuranceTotal;
    return rest;
  }, [overrides]);

  // 寄付済額の取得はサーバー側のサマリーを正とする。
  // 年次控除を正としている間だけ、詳細セクションでの手入力を即座に反映させる。
  const donatedAmount =
    overrides.furusatoNozeiEffective ??
    (donationSummary.source === "deduction"
      ? (amounts.furusatoNozei ?? donationSummary.total)
      : donationSummary.total);

  const calculateLimit = useMemo(
    () => (annualGrossIncome: number, insuranceTotal: number) =>
      calculateAnnualResidentTax(
        {
          annualGrossIncome,
          socialInsuranceTotal: insuranceTotal,
          lifeInsuranceGeneral: amounts.lifeInsuranceGeneral ?? 0,
          lifeInsuranceCareMedical: amounts.lifeInsuranceCareMedical ?? 0,
          lifeInsurancePension: amounts.lifeInsurancePension ?? 0,
          furusatoNozei: donatedAmount,
          incomeTaxWithheldTotal: 0,
        },
        limitOverrides
      ).furusatoNozeiLimit.value,
    [
      amounts.lifeInsuranceGeneral,
      amounts.lifeInsuranceCareMedical,
      amounts.lifeInsurancePension,
      donatedAmount,
      limitOverrides,
    ]
  );

  const limit = Math.max(calculateLimit(grossIncome ?? 0, socialInsuranceTotal ?? 0), 0);
  const baseLimit = Math.max(calculateLimit(baseGrossIncome, baseSocialInsuranceTotal), 0);

  const remaining = Math.max(limit - donatedAmount, 0);
  const baseRemaining = Math.max(baseLimit - donatedAmount, 0);
  const excess = Math.max(donatedAmount - limit, 0);
  const usedRatio = limit > 0 ? Math.min(donatedAmount / limit, 1) : donatedAmount > 0 ? 1 : 0;
  const excessRatio = limit > 0 ? Math.min(excess / limit, 0.35) : 0;

  const isEdited = grossIncome !== baseGrossIncome || socialInsuranceTotal !== baseSocialInsuranceTotal;

  const hasProjectedValues =
    projection.projectedSalaryMonthCount > 0 || projection.projectedBonusMonths.length > 0;
  const isWithholdingConfirmed =
    overrides.annualGrossIncome !== undefined &&
    overrides.socialInsuranceTotal !== undefined &&
    overrides.incomeTaxWithheldTotal !== undefined;
  const isLimitOverridden = overrides.furusatoNozeiLimit !== undefined;

  const status: "over" | "confirmed" | "estimate" =
    excess > 0 ? "over" : isWithholdingConfirmed ? "confirmed" : "estimate";

  const statusBadge = {
    over: { label: "見込み上限を超過", className: "border-destructive/40 bg-destructive/10 text-destructive" },
    confirmed: { label: "確定確認済み", className: "border-primary/40 bg-primary/10 text-primary" },
    estimate: {
      label: "見込み・要確認",
      className: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    },
  }[status];

  const uncertaintyCount =
    (projection.projectedSalaryMonthCount > 0 ? 1 : 0) +
    (projection.projectedBonusMonths.length > 0 ? 1 : 0) +
    (isWithholdingConfirmed ? 0 : 1);

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">ふるさと納税 残り枠</p>
          <Badge variant="secondary">{year}年</Badge>
        </div>
        <span
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-xs font-semibold",
            statusBadge.className
          )}
        >
          {statusBadge.label}
        </span>
      </div>

      {/* 見込み上限額・寄付済額・追加可能額 */}
      <div className="grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.25fr]">
        <div className="order-2 space-y-0.5 bg-card p-3 lg:order-none">
          <p className="text-xs text-muted-foreground">見込み上限額</p>
          <p className="text-xl font-bold tabular-nums">{formatYen(limit)}</p>
          <p className="text-[11px] text-muted-foreground">
            {isLimitOverridden
              ? "計算過程の上書きで固定した値を表示しています"
              : `${isWithholdingConfirmed ? "源泉徴収票の年収" : "見込み年収"} ${Math.round(
                  grossIncome ?? 0
                ).toLocaleString()} 円で計算`}
          </p>
        </div>
        <div className="order-3 space-y-0.5 bg-card p-3 lg:order-none">
          <p className="text-xs text-muted-foreground">寄付済額</p>
          <p className="text-xl font-bold tabular-nums">{formatYen(donatedAmount)}</p>
          <p className="text-[11px] text-muted-foreground">
            {overrides.furusatoNozeiEffective !== undefined
              ? "「ふるさと納税 計算値」の上書きを使用"
              : donationSummary.source === "donations"
                ? `寄付明細 ${donationSummary.donationCount ?? 0} 件の合計`
                : "「ふるさと納税額（年間合計）」の入力を使用"}
          </p>
        </div>
        <div className="order-1 space-y-0.5 bg-accent p-3 text-accent-foreground sm:col-span-2 lg:order-none lg:col-span-1">
          <p className="text-xs font-semibold">{excess > 0 ? "見込み上限の超過分" : "追加可能額"}</p>
          <p className="text-3xl font-extrabold tabular-nums">
            {formatYen(excess > 0 ? excess : remaining)}
          </p>
          <p className="text-[11px] opacity-80">
            {excess > 0
              ? "この分は自己負担になる見込みです"
              : "自己負担2,000円のまま追加で寄付できる見込み額"}
          </p>
        </div>
      </div>

      {/* 枠の消化 */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
          <span>枠の消化 {limit > 0 ? Math.round((donatedAmount / limit) * 100) : 0}%</span>
          <span>
            {Math.round(donatedAmount).toLocaleString()} / {Math.round(limit).toLocaleString()} 円
          </span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary" style={{ width: `${usedRatio * 100}%` }} />
          {excess > 0 && (
            <div className="h-full bg-destructive" style={{ width: `${excessRatio * 100}%` }} />
          )}
        </div>
      </div>

      {/* 前提と未確定な要素 */}
      <Collapsible defaultOpen className="overflow-hidden rounded-md border">
        <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 bg-muted px-3 py-2 text-left text-xs font-semibold">
          <span>この見積もりの前提と、未確定な要素</span>
          <span className="flex items-center gap-1.5 font-normal text-muted-foreground">
            {uncertaintyCount > 0 ? `${uncertaintyCount}件` : "確認済み"}
            <ChevronDown className="size-3.5 transition-transform group-data-[state=open]:rotate-180" />
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <dl className="divide-y divide-dashed px-3 py-1 text-xs">
            <div className="flex flex-col gap-1 py-2 sm:flex-row sm:gap-3">
              <dt className="shrink-0 font-semibold text-muted-foreground sm:w-28">給与</dt>
              <dd className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>
                  実績 <span className="font-semibold tabular-nums">{projection.registeredSalaryMonths.length}</span>
                  か月
                  {projection.projectedSalaryMonthCount > 0 && (
                    <>
                      {" ＋ 見込み "}
                      <span className="font-semibold tabular-nums">
                        {projection.projectedSalaryMonthCount}
                      </span>
                      か月
                    </>
                  )}
                </span>
                {projection.missingSalaryMonths.length > 0 && (
                  <span className="text-amber-700 dark:text-amber-400">
                    未登録: {formatMonths(projection.missingSalaryMonths)}
                  </span>
                )}
              </dd>
            </div>
            <div className="flex flex-col gap-1 py-2 sm:flex-row sm:gap-3">
              <dt className="shrink-0 font-semibold text-muted-foreground sm:w-28">賞与</dt>
              <dd className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>
                  実績 <span className="font-semibold tabular-nums">{projection.registeredBonusMonths.length}</span>
                  回
                  {projection.registeredBonusMonths.length > 0 &&
                    `（${formatMonths(projection.registeredBonusMonths)}）`}
                </span>
                {projection.projectedBonusMonths.length > 0 && (
                  <span className="text-amber-700 dark:text-amber-400">
                    {formatMonths(projection.projectedBonusMonths)}は前年実績{" "}
                    {Math.round(projection.projectedBonusTotal).toLocaleString()} 円で仮置き
                  </span>
                )}
              </dd>
            </div>
            <div className="flex flex-col gap-1 py-2 sm:flex-row sm:gap-3">
              <dt className="shrink-0 font-semibold text-muted-foreground sm:w-28">年収・社会保険料</dt>
              <dd className="flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums">
                <span>年収 {formatYen(baseGrossIncome)}</span>
                <span>社会保険料 {formatYen(baseSocialInsuranceTotal)}</span>
                <span className="text-muted-foreground">
                  {isWithholdingConfirmed
                    ? "（源泉徴収票の値を反映済み）"
                    : hasProjectedValues
                      ? `（うち見込み分 年収 ${Math.round(
                          projection.estimatedGrossIncome - projection.actualGrossIncome
                        ).toLocaleString()} 円 / 社会保険料 ${Math.round(
                          projection.estimatedSocialInsuranceTotal - projection.actualSocialInsuranceTotal
                        ).toLocaleString()} 円）`
                      : "（登録済みの実績のみ。見込み値は含みません）"}
                </span>
              </dd>
            </div>
            <div className="flex flex-col gap-1 py-2 sm:flex-row sm:gap-3">
              <dt className="shrink-0 font-semibold text-muted-foreground sm:w-28">未対応の控除</dt>
              <dd className="space-y-1">
                <div className="flex flex-wrap gap-1">
                  {UNSUPPORTED_DEDUCTIONS.map((name) => (
                    <span
                      key={name}
                      className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400"
                    >
                      {name}
                    </span>
                  ))}
                </div>
                <p className="text-muted-foreground">
                  該当がある年は実際の上限額が下がります。この画面の上限額は確定値として扱わないでください。
                </p>
              </dd>
            </div>
          </dl>
        </CollapsibleContent>
      </Collapsible>

      {/* 試算 */}
      <div className="space-y-2.5 rounded-md border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold">年収・社会保険料を変えて試算する</p>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            保存されません
          </span>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`quota-gross-${year}`} className="text-xs text-muted-foreground">
              見込み年収（給与・賞与の合計）
            </Label>
            <AmountInput id={`quota-gross-${year}`} value={grossIncome} onChange={setGrossIncome} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`quota-insurance-${year}`} className="text-xs text-muted-foreground">
              見込み社会保険料（健康保険・厚生年金・雇用保険）
            </Label>
            <AmountInput
              id={`quota-insurance-${year}`}
              value={socialInsuranceTotal}
              onChange={setSocialInsuranceTotal}
            />
          </div>
        </div>
        {isEdited ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md bg-muted px-3 py-2 text-xs">
            <span className="text-muted-foreground">初期値からの差分</span>
            <span>
              年収 <DiffValue value={(grossIncome ?? 0) - baseGrossIncome} />
            </span>
            <span>
              社会保険料 <DiffValue value={(socialInsuranceTotal ?? 0) - baseSocialInsuranceTotal} />
            </span>
            <span>
              上限額 <DiffValue value={limit - baseLimit} />
              <span className="text-muted-foreground tabular-nums">
                {` (${Math.round(baseLimit).toLocaleString()} → ${Math.round(limit).toLocaleString()} 円)`}
              </span>
            </span>
            <span>
              追加可能額 <DiffValue value={remaining - baseRemaining} />
            </span>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => {
                setGrossIncome(baseGrossIncome || undefined);
                setSocialInsuranceTotal(baseSocialInsuranceTotal || undefined);
              }}
            >
              初期値に戻す
            </Button>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            金額を書き換えると、初期値との差分と上限額・追加可能額への影響を表示します。
            {isLimitOverridden &&
              "（この年は上限額を計算過程の上書きで固定しているため、試算しても上限額は変わりません）"}
          </p>
        )}
      </div>

      {/* 年末の確定確認への導線 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <p className="max-w-prose text-xs text-muted-foreground">
          {isWithholdingConfirmed
            ? "源泉徴収票の年収・社会保険料・源泉徴収税額を反映済みです。上限額は見込み値を使わずに計算しています。"
            : "源泉徴収票が届いたら、年収・社会保険料・源泉徴収税額を実額で上書きすると、この年は「見込み」から「確定確認済み」に変わります。"}
        </p>
        <Button type="button" variant={isWithholdingConfirmed ? "outline" : "default"} onClick={onGoToWithholdingInput}>
          {isWithholdingConfirmed ? "入力した値を確認する" : "源泉徴収票の値を入力して確定する"}
        </Button>
      </div>
    </div>
  );
}
