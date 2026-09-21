// サーバー専用（`db` に依存する唯一の lib ファイル）。クライアントコンポーネントから import しないこと。
// 明細行から集計値を出す純粋な計算は `annualTaxAggregate.ts` にある（DB なしで単体テストするため）。
import { db } from "@/lib/db";
import type { ResidentTaxBreakdownField, ResidentTaxOverrides } from "@/lib/annualTax";
import {
  computeAnnualAggregate,
  computeFurusatoNozeiIncomeProjection,
  type AnnualAggregate,
  type CurrentItems,
  type FurusatoNozeiIncomeProjection,
} from "@/lib/annualTaxAggregate";
import { toItemMap } from "@/lib/itemSnapshot";

export type { FurusatoNozeiIncomeProjection };

async function getCurrentItems(userId: string): Promise<CurrentItems> {
  const items = await db.item.findMany({
    where: { userId },
    select: { id: true, itemName: true, itemType: true, isTaxable: true },
  });
  return toItemMap(items);
}

export async function getAnnualAggregate(userId: string, year: number): Promise<AnnualAggregate> {
  const gte = new Date(`${year}-01-01`);
  const lt = new Date(`${year + 1}-01-01`);

  const [salaries, bonuses, currentItems] = await Promise.all([
    db.salary.findMany({
      where: { userId, deletedAt: null, salaryDate: { gte, lt } },
      select: { grossSalary: true, data: true },
    }),
    db.bonus.findMany({
      where: { userId, deletedAt: null, bonusDate: { gte, lt } },
      select: { amount: true, data: true },
    }),
    getCurrentItems(userId),
  ]);

  return computeAnnualAggregate(salaries, bonuses, currentItems);
}

export async function getFurusatoNozeiIncomeProjection(
  userId: string,
  year: number
): Promise<FurusatoNozeiIncomeProjection> {
  const gte = new Date(`${year}-01-01`);
  const lt = new Date(`${year + 1}-01-01`);
  const prevGte = new Date(`${year - 1}-01-01`);
  const prevLt = new Date(`${year}-01-01`);

  const [salaries, bonuses, prevBonuses, currentItems] = await Promise.all([
    db.salary.findMany({
      where: { userId, deletedAt: null, salaryDate: { gte, lt } },
      select: { salaryDate: true, grossSalary: true, data: true },
      orderBy: { salaryDate: "asc" },
    }),
    db.bonus.findMany({
      where: { userId, deletedAt: null, bonusDate: { gte, lt } },
      select: { bonusDate: true, amount: true, data: true },
    }),
    db.bonus.findMany({
      where: { userId, deletedAt: null, bonusDate: { gte: prevGte, lt: prevLt } },
      select: { bonusDate: true, amount: true, data: true },
    }),
    getCurrentItems(userId),
  ]);

  return computeFurusatoNozeiIncomeProjection(salaries, bonuses, prevBonuses, currentItems);
}

// ふるさと納税の「寄付済額」を取り出す唯一の入口。画面側はこのサマリーだけを見る。
//
// 寄付明細（FurusatoDonation）を正本とし、年間合計は明細から積み上げる（#174）。
// 既存の年次控除 `Deduction.furusatoNozei` は「明細に載せていない調整額」として扱い、
// 税計算に使う額は 明細合計 + 調整額（effectiveTotal）とする。移行前のデータは明細が
// 0件なので effectiveTotal === adjustment となり、過去年の税計算結果は変わらない。
export type FurusatoDonationSummary = {
  /** 寄付明細の合計額 */
  total: number;
  /** 明細に載せていない調整額（移行前の Deduction.furusatoNozei） */
  adjustment: number;
  /** 税計算・残り枠の表示に使う額。total + adjustment */
  effectiveTotal: number;
  // "donations": 寄付明細がある / "deduction": 明細が無く年次控除の手入力額だけ
  source: "deduction" | "donations";
  /** 寄付明細の件数 */
  donationCount: number;
  /** 直近の寄付日（ISO文字列）。明細が無ければ null */
  lastDonationDate: string | null;
  /** 寄付先自治体数（重複を除く） */
  municipalityCount: number;
  /** ワンストップ特例が未申請の件数 */
  oneStopPendingCount: number;
  /** 寄附金控除証明書が未取得の件数 */
  certificatePendingCount: number;
};

const EMPTY_FURUSATO_SUMMARY: FurusatoDonationSummary = {
  total: 0,
  adjustment: 0,
  effectiveTotal: 0,
  source: "deduction",
  donationCount: 0,
  lastDonationDate: null,
  municipalityCount: 0,
  oneStopPendingCount: 0,
  certificatePendingCount: 0,
};

type FurusatoDonationRow = {
  year: number;
  donatedAt: Date;
  amount: unknown;
  municipality: string;
  oneStopStatus: string;
  certificateStatus: string;
};

function summarizeDonations(
  donations: FurusatoDonationRow[],
  adjustment: number
): FurusatoDonationSummary {
  const municipalities = new Set<string>();
  let total = 0;
  let oneStopPendingCount = 0;
  let certificatePendingCount = 0;
  let lastDonatedAt: Date | null = null;

  for (const d of donations) {
    total += Number(d.amount);
    municipalities.add(d.municipality);
    if (d.oneStopStatus === "notApplied") oneStopPendingCount += 1;
    if (d.certificateStatus === "notReceived") certificatePendingCount += 1;
    if (lastDonatedAt === null || d.donatedAt > lastDonatedAt) lastDonatedAt = d.donatedAt;
  }

  return {
    total,
    adjustment,
    effectiveTotal: total + adjustment,
    source: donations.length > 0 ? "donations" : "deduction",
    donationCount: donations.length,
    lastDonationDate: lastDonatedAt === null ? null : (lastDonatedAt as Date).toISOString(),
    municipalityCount: municipalities.size,
    oneStopPendingCount,
    certificatePendingCount,
  };
}

export async function getFurusatoDonationSummaries(
  userId: string,
  years: number[]
): Promise<Record<number, FurusatoDonationSummary>> {
  if (years.length === 0) return {};

  const [donations, adjustments] = await Promise.all([
    db.furusatoDonation.findMany({
      where: { userId, year: { in: years }, deletedAt: null },
      select: {
        year: true,
        donatedAt: true,
        amount: true,
        municipality: true,
        oneStopStatus: true,
        certificateStatus: true,
      },
    }),
    db.deduction.findMany({
      where: { userId, year: { in: years }, deductionType: "furusatoNozei" },
      select: { year: true, amount: true },
    }),
  ]);

  const donationsByYear = new Map<number, FurusatoDonationRow[]>();
  for (const d of donations) {
    const group = donationsByYear.get(d.year) ?? [];
    group.push(d);
    donationsByYear.set(d.year, group);
  }

  const adjustmentByYear = new Map<number, number>();
  for (const a of adjustments) adjustmentByYear.set(a.year, Number(a.amount));

  return Object.fromEntries(
    years.map((year) => [
      year,
      summarizeDonations(donationsByYear.get(year) ?? [], adjustmentByYear.get(year) ?? 0),
    ])
  );
}

export async function getFurusatoDonationSummary(
  userId: string,
  year: number
): Promise<FurusatoDonationSummary> {
  const summaries = await getFurusatoDonationSummaries(userId, [year]);
  return summaries[year] ?? EMPTY_FURUSATO_SUMMARY;
}

export type AnnualTaxEntry = {
  grossIncome: number;
  socialInsuranceTotal: number;
  incomeTaxWithheldTotal: number;
  lifeInsuranceGeneral: number;
  lifeInsuranceCareMedical: number;
  lifeInsurancePension: number;
  furusatoNozei: number;
  overrides: ResidentTaxOverrides;
};

export async function buildAnnualTaxData(
  userId: string,
  candidateYears: number[]
): Promise<Record<number, AnnualTaxEntry>> {
  const [aggregates, deductions, overridesList, furusatoSummaries] = await Promise.all([
    Promise.all(candidateYears.map((year) => getAnnualAggregate(userId, year))),
    db.deduction.findMany({ where: { userId, year: { in: candidateYears } } }),
    db.taxCalculationOverride.findMany({ where: { userId, year: { in: candidateYears } } }),
    getFurusatoDonationSummaries(userId, candidateYears),
  ]);

  const deductionsByYear = new Map<number, Record<string, number>>();
  for (const d of deductions) {
    const entry = deductionsByYear.get(d.year) ?? {};
    entry[d.deductionType] = Number(d.amount);
    deductionsByYear.set(d.year, entry);
  }

  const overridesByYear = new Map<number, ResidentTaxOverrides>();
  for (const o of overridesList) {
    const entry = overridesByYear.get(o.year) ?? {};
    entry[o.field as ResidentTaxBreakdownField] = Number(o.amount);
    overridesByYear.set(o.year, entry);
  }

  return Object.fromEntries(
    candidateYears.map((year, i) => {
      const perType = deductionsByYear.get(year);
      return [
        year,
        {
          grossIncome: aggregates[i].grossIncome,
          socialInsuranceTotal: aggregates[i].socialInsuranceTotal,
          incomeTaxWithheldTotal: aggregates[i].incomeTaxWithheldTotal,
          lifeInsuranceGeneral: perType?.lifeInsuranceGeneral ?? 0,
          lifeInsuranceCareMedical: perType?.lifeInsuranceCareMedical ?? 0,
          lifeInsurancePension: perType?.lifeInsurancePension ?? 0,
          // 寄付明細の合計 + 調整額。明細が正本のため perType?.furusatoNozei は直接使わない
          furusatoNozei: furusatoSummaries[year]?.effectiveTotal ?? 0,
          overrides: overridesByYear.get(year) ?? {},
        },
      ];
    })
  );
}

export async function getYearsWithTaxReturnData(userId: string): Promise<number[]> {
  const [salaries, bonuses, deductions, overrides, donations] = await Promise.all([
    db.salary.findMany({ where: { userId, deletedAt: null }, select: { salaryDate: true } }),
    db.bonus.findMany({ where: { userId, deletedAt: null }, select: { bonusDate: true } }),
    db.deduction.findMany({ where: { userId }, select: { year: true } }),
    db.taxCalculationOverride.findMany({ where: { userId }, select: { year: true } }),
    db.furusatoDonation.findMany({ where: { userId, deletedAt: null }, select: { year: true } }),
  ]);

  const years = new Set<number>();
  for (const s of salaries) years.add(s.salaryDate.getFullYear());
  for (const b of bonuses) years.add(b.bonusDate.getFullYear());
  for (const d of deductions) years.add(d.year);
  for (const o of overrides) years.add(o.year);
  for (const d of donations) years.add(d.year);

  return Array.from(years).sort((a, b) => b - a);
}
