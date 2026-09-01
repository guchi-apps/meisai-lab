"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AmountInput } from "@/components/ui/amount-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CERTIFICATE_STATUSES,
  CERTIFICATE_STATUS_LABELS,
  ONE_STOP_STATUSES,
  ONE_STOP_STATUS_LABELS,
  type FurusatoDonationDTO,
} from "@/types";

const donationFormSchema = z
  .object({
    donatedAt: z.string().min(1, "寄付日は必須です"),
    municipality: z.string().min(1, "自治体名は必須です"),
    amount: z.number().positive("寄付額は0より大きい数値が必須"),
    returnItem: z.string().optional(),
    category: z.string().optional(),
    portalSite: z.string().optional(),
    oneStopStatus: z.enum(["notApplied", "applied", "accepted", "switchedToTaxReturn"]),
    certificateStatus: z.enum(["notReceived", "received", "notNeeded"]),
    memo: z.string().optional(),
  })
  // 確定申告へ切り替えた寄付は寄附金控除証明書が必ず要るため、「不要」にはできない。
  .superRefine((values, ctx) => {
    if (values.oneStopStatus === "switchedToTaxReturn" && values.certificateStatus === "notNeeded") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["certificateStatus"],
        message: "確定申告へ切替えた寄付では証明書を「不要」にできません",
      });
    }
  });

type DonationFormValues = z.infer<typeof donationFormSchema>;

function toDateInputValue(iso: string): string {
  return format(new Date(iso), "yyyy-MM-dd");
}

// 一覧から「寄付を追加」した年が当年なら今日を初期値にする。過去年を見ているときに今日を入れると
// 別の年の明細になってしまうため、その場合は空のままにして入力してもらう。
function initialDonatedAt(defaultYear: number | undefined): string {
  const today = new Date();
  if (defaultYear === undefined || defaultYear === today.getFullYear()) {
    return format(today, "yyyy-MM-dd");
  }
  return "";
}

export function FurusatoDonationForm({
  donation,
  defaultYear,
}: {
  donation?: FurusatoDonationDTO;
  defaultYear?: number;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DonationFormValues>({
    resolver: zodResolver(donationFormSchema),
    defaultValues: {
      donatedAt: donation ? toDateInputValue(donation.donatedAt) : initialDonatedAt(defaultYear),
      municipality: donation?.municipality ?? "",
      amount: donation ? Number(donation.amount) : 0,
      returnItem: donation?.returnItem ?? "",
      category: donation?.category ?? "",
      portalSite: donation?.portalSite ?? "",
      oneStopStatus: donation?.oneStopStatus ?? "notApplied",
      certificateStatus: donation?.certificateStatus ?? "notReceived",
      memo: donation?.memo ?? "",
    },
  });

  async function onSubmit(values: DonationFormValues) {
    setIsSubmitting(true);
    try {
      const payload = {
        donatedAt: new Date(values.donatedAt).toISOString(),
        municipality: values.municipality,
        amount: values.amount,
        returnItem: values.returnItem || undefined,
        category: values.category || undefined,
        portalSite: values.portalSite || undefined,
        oneStopStatus: values.oneStopStatus,
        certificateStatus: values.certificateStatus,
        memo: values.memo || undefined,
      };

      const res = await fetch(
        donation ? `/api/furusato-donations/${donation.id}` : "/api/furusato-donations",
        {
          method: donation ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        toast.error("保存に失敗しました");
        return;
      }

      toast.success(donation ? "寄付を更新しました" : "寄付を登録しました");
      const year = new Date(values.donatedAt).getFullYear();
      router.push(`/furusato?year=${year}`);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-xl space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="donatedAt">寄付日</Label>
        <Input id="donatedAt" type="date" {...register("donatedAt")} />
        {errors.donatedAt && <p className="text-sm text-destructive">{errors.donatedAt.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="municipality">自治体名</Label>
        <Input id="municipality" placeholder="北海道 紋別市" {...register("municipality")} />
        {errors.municipality && (
          <p className="text-sm text-destructive">{errors.municipality.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="amount">寄付額</Label>
        <Controller
          control={control}
          name="amount"
          render={({ field }) => (
            <AmountInput id="amount" value={field.value} onChange={field.onChange} />
          )}
        />
        {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
      </div>

      <div className="space-y-3 rounded-md border p-3">
        <p className="text-sm font-medium">返礼品</p>
        <div className="space-y-1.5">
          <Label htmlFor="returnItem">返礼品名</Label>
          <Input id="returnItem" placeholder="ホタテ貝柱 1kg" {...register("returnItem")} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="category">カテゴリ</Label>
            <Input id="category" placeholder="魚介類" {...register("category")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="portalSite">利用サイト</Label>
            <Input id="portalSite" placeholder="さとふる" {...register("portalSite")} />
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-md border p-3">
        <p className="text-sm font-medium">手続きの状況</p>
        <div className="space-y-1.5">
          <Label htmlFor="oneStopStatus">ワンストップ特例</Label>
          <Controller
            control={control}
            name="oneStopStatus"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="oneStopStatus" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ONE_STOP_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {ONE_STOP_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <p className="text-xs text-muted-foreground">
            確定申告をする年は、受付済みの分も含めてすべての寄付が確定申告の対象になります。
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="certificateStatus">寄附金控除証明書</Label>
          <Controller
            control={control}
            name="certificateStatus"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="certificateStatus" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CERTIFICATE_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {CERTIFICATE_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.certificateStatus && (
            <p className="text-sm text-destructive">{errors.certificateStatus.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="memo">メモ</Label>
        <Textarea id="memo" {...register("memo")} />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {donation ? "更新する" : "登録する"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          キャンセル
        </Button>
      </div>
    </form>
  );
}
