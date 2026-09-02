// サーバー専用（`db` に依存する唯一の lib ファイル）。クライアントコンポーネントから import しないこと。
import { db } from "@/lib/db";
import { INCOME_TAX_ADJUSTMENT_ITEM_NAMES } from "@/lib/annualTax";
import type { ResidentTaxBreakdownField, ResidentTaxOverrides } from "@/lib/annualTax";

function sumAbsField(data: unknown, field: string): number {
  const d = (data ?? {}) as Record<string, unknown>;
  const value = d[field];
  return typeof value === "number" ? Math.abs(value) : 0;
}

function numberField(data: unknown, field: string): number {
  const d = (data ?? {}) as Record<string, unknown>;
  const value = d[field];
  return typeof value === "number" ? value : 0;
}

function insuranceFromData(data: unknown): number {
  return (
    sumAbsField(data, "healthInsurance") +
    sumAbsField(data, "pension") +
    sumAbsField(data, "employmentInsurance")
  );
}

function customItemValue(data: unknown, itemId: string): number {
  const d = (data ?? {}) as Record<string, unknown>;
  const raw = d.customItemValues;
  if (!raw || typeof raw !== "object") return 0;
  const value = (raw as Record<string, unknown>)[itemId];
  return typeof value === "number" ? value : 0;
}

// 通勤手当など、支給額(grossSalary/amount)には含まれるが所得税・住民税の課税対象にはならない項目の金額を合計する
function nonTaxableEarningFromData(data: unknown, nonTaxableItemIds: Set<string>): number {
  const d = (data ?? {}) as Record<string, unknown>;
  const raw = d.customItemValues;
  if (!raw || typeof raw !== "object") return 0;
  return Object.entries(raw as Record<string, unknown>).reduce((sum, [itemId, value]) => {
    if (!nonTaxableItemIds.has(itemId) || typeof value !== "number") return sum;
    return sum + Math.abs(value);
  }, 0);
}

async function getNonTaxableEarningItemIds(userId: string): Promise<Set<string>> {
  const items = await db.item.findMany({
    where: { userId, isTaxable: false, itemType: { in: ["earning", "otherEarning"] } },
    select: { id: true },
  });
  return new Set(items.map((item) => item.id));
}

// 年末調整・賞与の所得税(差額)を項目として手入力している場合、源泉徴収税額の集計から差し引く
// （追加徴収ならマイナス、還付ならプラスで保存されているため、差し引くことで実際の源泉徴収額に一致する）

export async function getAnnualAggregate(
  userId: string,
  year: number
): Promise<{
  grossIncome: number;
  socialInsuranceTotal: number;
  incomeTaxWithheldTotal: number;
  salaryCount: number;
  bonusCount: number;
}> {
  const gte = new Date(`${year}-01-01`);
  const lt = new Date(`${year + 1}-01-01`);

  const [salaries, bonuses, adjustmentItems, nonTaxableItemIds] = await Promise.all([
    db.salary.findMany({
      where: { userId, deletedAt: null, salaryDate: { gte, lt } },
      select: { grossSalary: true, data: true },
    }),
    db.bonus.findMany({
      where: { userId, deletedAt: null, bonusDate: { gte, lt } },
      select: { amount: true, data: true },
    }),
    db.item.findMany({
      where: { userId, itemName: { in: INCOME_TAX_ADJUSTMENT_ITEM_NAMES } },
      select: { id: true },
    }),
    getNonTaxableEarningItemIds(userId),
  ]);

  // 通勤手当など非課税支給項目は支給額(grossSalary/amount)に含まれるが、
  // 確定申告の「給与」(収入金額)には含めない
  const nonTaxableEarningTotal =
    salaries.reduce((sum, r) => sum + nonTaxableEarningFromData(r.data, nonTaxableItemIds), 0) +
    bonuses.reduce((sum, r) => sum + nonTaxableEarningFromData(r.data, nonTaxableItemIds), 0);

  const grossIncome =
    salaries.reduce((sum, r) => sum + Number(r.grossSalary), 0) +
    bonuses.reduce((sum, r) => sum + Number(r.amount), 0) -
    nonTaxableEarningTotal;
  const socialInsuranceTotal =
    salaries.reduce((sum, r) => sum + insuranceFromData(r.data), 0) +
    bonuses.reduce((sum, r) => sum + insuranceFromData(r.data), 0);

  const incomeTaxAdjustmentTotal = [...salaries, ...bonuses].reduce(
    (sum, r) =>
      sum + adjustmentItems.reduce((itemSum, item) => itemSum + customItemValue(r.data, item.id), 0),
    0
  );
  const incomeTaxWithheldTotal =
    salaries.reduce((sum, r) => sum + sumAbsField(r.data, "incomeTax"), 0) +
    bonuses.reduce((sum, r) => sum + sumAbsField(r.data, "incomeTax"), 0) -
    incomeTaxAdjustmentTotal;

  return {
    grossIncome,
    socialInsuranceTotal,
    incomeTaxWithheldTotal,
    salaryCount: salaries.length,
    bonusCount: bonuses.length,
  };
}

// ふるさと納税の残り枠カードで「どこまでが実績で、どこからが見込みか」を画面に出すための内訳。
export type FurusatoNozeiIncomeProjection = {
  estimatedGrossIncome: number;
  estimatedSocialInsuranceTotal: number;
  // 見込みを含まない、登録済みの実績だけの合計
  actualGrossIncome: number;
  actualSocialInsuranceTotal: number;
  registeredSalaryMonths: number[];
  missingSalaryMonths: number[];
  projectedSalaryMonthCount: number;
  registeredBonusMonths: number[];
  projectedBonusMonths: number[];
  projectedBonusTotal: number;
};

// ふるさと納税上限額の見込み計算用に、その年の残り月分の給与・賞与を推定する。
// - 給与: 直近の給与明細と同じ基本給(baseGrossSalary)の月だけを対象に平均し、未登録の残り月数分を加算する
//   （昇給があった場合、昇給前の月を平均に混ぜないようにするため）
// - 賞与: 前年に支給があった月のうち、その年にまだ登録がない月については前年同月の支給額を見込みとして加算する
export async function getFurusatoNozeiIncomeProjection(
  userId: string,
  year: number
): Promise<FurusatoNozeiIncomeProjection> {
  const gte = new Date(`${year}-01-01`);
  const lt = new Date(`${year + 1}-01-01`);
  const prevGte = new Date(`${year - 1}-01-01`);
  const prevLt = new Date(`${year}-01-01`);

  const [salaries, bonuses, prevBonuses, nonTaxableItemIds] = await Promise.all([
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
    getNonTaxableEarningItemIds(userId),
  ]);

  // 通勤手当など非課税支給項目は支給額(grossSalary/amount)に含まれるが、収入金額の見込みには含めない
  const taxableGross = (grossSalary: number, data: unknown) =>
    grossSalary - nonTaxableEarningFromData(data, nonTaxableItemIds);

  const actualSalaryGross = salaries.reduce((sum, s) => sum + taxableGross(Number(s.grossSalary), s.data), 0);
  const actualSalaryInsurance = salaries.reduce((sum, s) => sum + insuranceFromData(s.data), 0);
  let estimatedSalaryGross = actualSalaryGross;
  let estimatedSalaryInsurance = actualSalaryInsurance;

  const registeredSalaryMonths = Array.from(
    new Set(salaries.map((s) => s.salaryDate.getMonth() + 1))
  ).sort((a, b) => a - b);
  const missingSalaryMonths = Array.from({ length: 12 }, (_, i) => i + 1).filter(
    (month) => !registeredSalaryMonths.includes(month)
  );

  const remainingMonths = Math.max(12 - salaries.length, 0);
  if (remainingMonths > 0 && salaries.length > 0) {
    const currentBaseSalary = numberField(salaries[salaries.length - 1].data, "baseGrossSalary");
    const currentRegime = salaries.filter(
      (s) => numberField(s.data, "baseGrossSalary") === currentBaseSalary
    );
    const avgGross =
      currentRegime.reduce((sum, s) => sum + taxableGross(Number(s.grossSalary), s.data), 0) /
      currentRegime.length;
    const avgInsurance =
      currentRegime.reduce((sum, s) => sum + insuranceFromData(s.data), 0) / currentRegime.length;

    estimatedSalaryGross += avgGross * remainingMonths;
    estimatedSalaryInsurance += avgInsurance * remainingMonths;
  }

  const enteredBonusMonths = new Set(bonuses.map((b) => b.bonusDate.getMonth() + 1));
  const actualBonusGross = bonuses.reduce((sum, b) => sum + taxableGross(Number(b.amount), b.data), 0);
  const actualBonusInsurance = bonuses.reduce((sum, b) => sum + insuranceFromData(b.data), 0);
  let estimatedBonusGross = actualBonusGross;
  let estimatedBonusInsurance = actualBonusInsurance;

  const projectedBonusMonths: number[] = [];
  let projectedBonusTotal = 0;
  for (const prevBonus of prevBonuses) {
    if (enteredBonusMonths.has(prevBonus.bonusDate.getMonth() + 1)) continue;
    const gross = taxableGross(Number(prevBonus.amount), prevBonus.data);
    estimatedBonusGross += gross;
    estimatedBonusInsurance += insuranceFromData(prevBonus.data);
    projectedBonusMonths.push(prevBonus.bonusDate.getMonth() + 1);
    projectedBonusTotal += gross;
  }

  return {
    estimatedGrossIncome: Math.round(estimatedSalaryGross + estimatedBonusGross),
    estimatedSocialInsuranceTotal: Math.round(estimatedSalaryInsurance + estimatedBonusInsurance),
    actualGrossIncome: Math.round(actualSalaryGross + actualBonusGross),
    actualSocialInsuranceTotal: Math.round(actualSalaryInsurance + actualBonusInsurance),
    registeredSalaryMonths,
    missingSalaryMonths,
    projectedSalaryMonthCount: remainingMonths > 0 && salaries.length > 0 ? remainingMonths : 0,
    registeredBonusMonths: Array.from(enteredBonusMonths).sort((a, b) => a - b),
    projectedBonusMonths: projectedBonusMonths.sort((a, b) => a - b),
    projectedBonusTotal: Math.round(projectedBonusTotal),
  };
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
