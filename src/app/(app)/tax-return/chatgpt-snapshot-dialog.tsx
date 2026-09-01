"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, MessageSquareText } from "lucide-react";

import { calculateAnnualResidentTax, type ResidentTaxOverrides } from "@/lib/annualTax";
import { APP_VERSION } from "@/lib/app-version";
import {
  buildSnapshotText,
  buildTaxSnapshot,
  SNAPSHOT_PURPOSES,
  type SnapshotFormat,
  type SnapshotPurpose,
} from "@/lib/taxSnapshot";
import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { DeductionType } from "@/types";

export function ChatGptSnapshotDialog({
  year,
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
  amounts,
  overrides,
}: {
  year: number;
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
  amounts: Partial<Record<DeductionType, number>>;
  overrides: ResidentTaxOverrides;
}) {
  const [open, setOpen] = useState(false);
  // ダイアログを開いた時刻を「計算日時」として出力する（サーバーとの時刻差でずれないよう、開いた時点で確定させる）
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [purpose, setPurpose] = useState<SnapshotPurpose>("limit");
  const [format, setFormat] = useState<SnapshotFormat>("markdown");
  const [municipalityCount, setMunicipalityCount] = useState<number | undefined>(undefined);
  const [oneStopSubmittedCount, setOneStopSubmittedCount] = useState<number | undefined>(undefined);
  const [receiptReceivedCount, setReceiptReceivedCount] = useState<number | undefined>(undefined);

  const premiums = {
    lifeInsuranceGeneral: amounts.lifeInsuranceGeneral ?? 0,
    lifeInsuranceCareMedical: amounts.lifeInsuranceCareMedical ?? 0,
    lifeInsurancePension: amounts.lifeInsurancePension ?? 0,
  };
  const furusatoNozei = amounts.furusatoNozei ?? 0;

  const text = useMemo(() => {
    if (!generatedAt) return "";

    // 上限額は画面上の「上限額の目安」と同じく見込み値から求め、
    // 所得税・住民税の試算は計算過程の表と同じく実績値（保存済みの上書きを反映）から求める
    const projectedBreakdown = calculateAnnualResidentTax({
      annualGrossIncome: estimatedGrossIncome,
      socialInsuranceTotal: estimatedSocialInsuranceTotal,
      ...premiums,
      furusatoNozei,
      incomeTaxWithheldTotal: 0,
    });
    const actualBreakdown = calculateAnnualResidentTax(
      {
        annualGrossIncome: grossIncome,
        socialInsuranceTotal,
        ...premiums,
        furusatoNozei,
        incomeTaxWithheldTotal,
      },
      overrides
    );

    const snapshot = buildTaxSnapshot({
      year,
      generatedAt,
      appVersion: APP_VERSION,
      isLocked,
      actual: { grossIncome, socialInsuranceTotal, incomeTaxWithheldTotal },
      projected: {
        grossIncome: estimatedGrossIncome,
        socialInsuranceTotal: estimatedSocialInsuranceTotal,
        salaryMonths: projectedSalaryMonths,
        bonusMonths: projectedBonusMonths,
      },
      registeredSalaryCount: salaryCount,
      registeredBonusCount: bonusCount,
      premiums,
      furusato: { donated: furusatoNozei, limit: projectedBreakdown.furusatoNozeiLimit.value },
      tax: {
        employmentIncome: actualBreakdown.employmentIncome.value,
        incomeDeductionTotalForIncomeTax: actualBreakdown.incomeDeductionTotalForIncomeTax.value,
        taxableIncomeForIncomeTax: actualBreakdown.taxableIncomeForIncomeTax.value,
        incomeTaxRate: actualBreakdown.incomeTaxRate.value,
        incomeTaxAndSurtaxTotal: actualBreakdown.incomeTaxAndSurtaxTotal.value,
        taxReturnPayment: actualBreakdown.taxReturnPayment.value,
        residentTaxAnnualTotal: actualBreakdown.annualTotal.value,
      },
      progress: { municipalityCount, oneStopSubmittedCount, receiptReceivedCount },
    });

    return buildSnapshotText(snapshot, purpose, format);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    generatedAt,
    year,
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
    premiums.lifeInsuranceGeneral,
    premiums.lifeInsuranceCareMedical,
    premiums.lifeInsurancePension,
    furusatoNozei,
    overrides,
    municipalityCount,
    oneStopSubmittedCount,
    receiptReceivedCount,
    purpose,
    format,
  ]);

  function handleOpenChange(next: boolean) {
    if (next) setGeneratedAt(new Date());
    setOpen(next);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("スナップショットをコピーしました");
    } catch {
      toast.error("コピーできませんでした。下の枠内のテキストを選択してコピーしてください");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <div className="max-w-sm space-y-3 rounded-md border p-3">
        <p className="text-sm font-semibold">ChatGPTに相談する</p>
        <p className="text-xs text-muted-foreground">
          {year}
          年分の集計値・計算の前提・未確認の項目をまとめてコピーし、ChatGPTに上限額や手続きの漏れを相談できます。個人番号・給与明細画像・口座情報・自治体名は出力に含まれません。
        </p>
        <DialogTrigger asChild>
          <Button type="button" variant="outline">
            <MessageSquareText />
            相談用データを作る
          </Button>
        </DialogTrigger>
      </div>

      <DialogContent className="flex max-h-[90dvh] flex-col gap-4 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>ChatGPT相談用スナップショット（{year}年分）</DialogTitle>
          <DialogDescription>
            明細ラボが集計・試算した値だけを出力します。用途と形式を選び、そのままコピーしてChatGPTに貼り付けてください。
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <p className="rounded-md border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
            正式な上限額の計算・確定申告の提出は
            e-Tax／国税庁のサイトで行ってください。ChatGPTの回答は確認の補助であり、申告の根拠にはできません。
          </p>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Label>相談の用途</Label>
              <span className="text-xs text-muted-foreground">先頭に付く相談文が変わります</span>
            </div>
            <Tabs value={purpose} onValueChange={(value) => setPurpose(value as SnapshotPurpose)}>
              <TabsList className="w-full">
                {SNAPSHOT_PURPOSES.map(({ key, label }) => (
                  <TabsTrigger key={key} value={key}>
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <p className="text-xs text-muted-foreground">
              {SNAPSHOT_PURPOSES.find((p) => p.key === purpose)?.description}
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Label>ふるさと納税の補足（保存されません）</Label>
              <span className="text-xs text-muted-foreground">
                未入力の項目は「未確認」として出力します
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor={`municipalityCount-${year}`} className="text-xs font-normal">
                  寄付先の自治体数
                </Label>
                <AmountInput
                  id={`municipalityCount-${year}`}
                  placeholder="未入力"
                  value={municipalityCount}
                  onChange={setMunicipalityCount}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`oneStopSubmittedCount-${year}`} className="text-xs font-normal">
                  ワンストップ申請済み
                </Label>
                <AmountInput
                  id={`oneStopSubmittedCount-${year}`}
                  placeholder="未入力"
                  value={oneStopSubmittedCount}
                  onChange={setOneStopSubmittedCount}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`receiptReceivedCount-${year}`} className="text-xs font-normal">
                  受領証明書の到着
                </Label>
                <AmountInput
                  id={`receiptReceivedCount-${year}`}
                  placeholder="未入力"
                  value={receiptReceivedCount}
                  onChange={setReceiptReceivedCount}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Label>出力形式</Label>
              <span className="text-xs text-muted-foreground">コピーされる内容もこの形式です</span>
            </div>
            <Tabs value={format} onValueChange={(value) => setFormat(value as SnapshotFormat)}>
              <TabsList>
                <TabsTrigger value="markdown">Markdown</TabsTrigger>
                <TabsTrigger value="json">JSON</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`snapshot-${year}`}>コピーされる内容</Label>
            <Textarea
              id={`snapshot-${year}`}
              readOnly
              value={text}
              rows={12}
              className="max-h-64 font-mono text-xs"
            />
          </div>
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            コピー後、ChatGPTの入力欄にそのまま貼り付けてください
          </p>
          <Button type="button" onClick={handleCopy}>
            <Copy />
            この内容をコピー
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
