import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, TriangleAlert } from "lucide-react";

import { requireUserId } from "@/lib/auth-user";
import { db } from "@/lib/db";
import { getFurusatoDonationSummary } from "@/lib/annualTaxData";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FurusatoDonationList } from "./furusato-donation-list";
import { FurusatoYearPicker } from "./furusato-year-picker";
import { ONE_STOP_MUNICIPALITY_LIMIT } from "./furusato-status";
import {
  FURUSATO_STATUS_FILTERS,
  buildFilterHref,
  resolveStatusFilter,
} from "./furusato-filters";
import type { FurusatoDonationDTO } from "@/types";

function StatTile({
  label,
  value,
  unit,
  note,
  tone = "neutral",
}: {
  label: string;
  value: number;
  unit: string;
  note: string;
  tone?: "neutral" | "primary" | "attention";
}) {
  return (
    <Card
      className={cn(
        "gap-0 border-l-[3px] py-4",
        tone === "primary" && "border-l-primary",
        tone === "attention" && "border-l-amber-500",
        tone === "neutral" && "border-l-border"
      )}
    >
      <CardContent className="space-y-1 px-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p
          className={cn(
            "text-2xl font-bold tabular-nums",
            tone === "attention" && "text-amber-700 dark:text-amber-300"
          )}
        >
          {Math.round(value).toLocaleString()}
          <span className="ml-0.5 text-sm font-medium">{unit}</span>
        </p>
        <p className="text-xs text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}

export default async function FurusatoPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; oneStopStatus?: string; certificateStatus?: string }>;
}) {
  const userId = await requireUserId();
  if (!userId) redirect("/auth/signin");

  const { year: yearParam, oneStopStatus, certificateStatus } = await searchParams;
  const currentYear = new Date().getFullYear();
  const parsedYear = Number(yearParam);
  // 寄付は「今年何を寄付したか」を見に来る画面なので、既定は前年ではなく当年にする。
  const selectedYear = Number.isInteger(parsedYear) ? parsedYear : currentYear;
  const activeFilter = resolveStatusFilter(oneStopStatus, certificateStatus);

  const [rows, summary, yearRows] = await Promise.all([
    db.furusatoDonation.findMany({
      where: { userId, year: selectedYear, deletedAt: null },
      orderBy: { donatedAt: "desc" },
    }),
    getFurusatoDonationSummary(userId, selectedYear),
    db.furusatoDonation.findMany({
      where: { userId, deletedAt: null },
      select: { year: true },
      distinct: ["year"],
      orderBy: { year: "desc" },
    }),
  ]);

  const donations = JSON.parse(JSON.stringify(rows)) as FurusatoDonationDTO[];
  const years = Array.from(
    new Set([...yearRows.map((row) => row.year), selectedYear, currentYear])
  ).sort((a, b) => b - a);

  const visibleDonations = donations.filter(activeFilter.match);
  const switchedToTaxReturnCount = donations.filter(
    (donation) => donation.oneStopStatus === "switchedToTaxReturn"
  ).length;
  const overMunicipalityLimit = summary.municipalityCount > ONE_STOP_MUNICIPALITY_LIMIT;
  const showOneStopWarning = switchedToTaxReturnCount > 0 || overMunicipalityLimit;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold">ふるさと納税</h1>
        <div className="flex items-center gap-2">
          <FurusatoYearPicker years={years} selectedYear={selectedYear} />
          <Button asChild>
            <Link href={`/furusato/new?year=${selectedYear}`}>
              <Plus />
              寄付を追加
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="年間寄付額"
          value={summary.effectiveTotal}
          unit="円"
          note={
            summary.adjustment === 0
              ? `寄付明細${summary.count}件の合計`
              : `明細${summary.count}件 ${Math.round(summary.total).toLocaleString()}円 ＋ 調整額 ${Math.round(summary.adjustment).toLocaleString()}円`
          }
          tone="primary"
        />
        <StatTile
          label="寄付先自治体数"
          value={summary.municipalityCount}
          unit="自治体"
          note={
            overMunicipalityLimit
              ? `ワンストップ特例の上限（${ONE_STOP_MUNICIPALITY_LIMIT}自治体）超過`
              : `ワンストップ特例は${ONE_STOP_MUNICIPALITY_LIMIT}自治体まで`
          }
          tone={overMunicipalityLimit ? "attention" : "neutral"}
        />
        <StatTile
          label="ワンストップ 未申請"
          value={summary.oneStopPendingCount}
          unit="件"
          note={
            switchedToTaxReturnCount > 0
              ? `${switchedToTaxReturnCount}件は確定申告へ切替済み`
              : "申請書を自治体へ送っていない件数"
          }
          tone={summary.oneStopPendingCount > 0 ? "attention" : "neutral"}
        />
        <StatTile
          label="証明書 未取得"
          value={summary.certificatePendingCount}
          unit="件"
          note="確定申告に使う寄附金控除証明書"
          tone={summary.certificatePendingCount > 0 ? "attention" : "neutral"}
        />
      </div>

      {showOneStopWarning && (
        <Alert>
          <TriangleAlert />
          <AlertTitle>確定申告をする場合、ワンストップ特例の申請はすべて無効になります</AlertTitle>
          <AlertDescription>
            <p>
              {overMunicipalityLimit
                ? `${selectedYear}年分は寄付先が${summary.municipalityCount}自治体あり、ワンストップ特例の上限（${ONE_STOP_MUNICIPALITY_LIMIT}自治体）を超えています。`
                : `${selectedYear}年分には「確定申告へ切替」の寄付が${switchedToTaxReturnCount}件あります。`}
              受付済みの分も含めて、この年の寄付{summary.count}件すべてを確定申告で申告してください。
              一部だけをワンストップ特例で処理することはできません。
            </p>
            {summary.certificatePendingCount > 0 && (
              <p>
                証明書が未取得の{summary.certificatePendingCount}
                件は、確定申告までに各ポータルサイトまたは自治体から寄附金控除証明書を取得してください。
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {FURUSATO_STATUS_FILTERS.map((filter) => {
          const count = donations.filter(filter.match).length;
          const isActive = filter.key === activeFilter.key;
          return (
            <Link
              key={filter.key}
              href={buildFilterHref(selectedYear, filter)}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                isActive
                  ? "border-primary/35 bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {filter.label}
              <span
                className={cn(
                  "rounded-full px-1.5 tabular-nums",
                  isActive ? "bg-primary/20" : "bg-muted"
                )}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      <Card>
        <CardContent>
          <FurusatoDonationList
            donations={visibleDonations}
            isFiltered={activeFilter.key !== "all"}
          />
        </CardContent>
      </Card>
    </div>
  );
}
