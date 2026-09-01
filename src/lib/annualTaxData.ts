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
): Promise<{ grossIncome: number; socialInsuranceTotal: number; incomeTaxWithheldTotal: number }> {
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

  return { grossIncome, socialInsuranceTotal, incomeTaxWithheldTotal };
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

// ふるさと納税の「寄付済額」を取り出す唯一の入口。
// いまは年次控除 `Deduction.furusatoNozei`（年間合計の手入力）を正としているが、
// #174 で寄付明細（FurusatoDonation）が入ったら、この関数の中身だけを明細の合算へ差し替える。
// 画面側はこのサマリーだけを見ているため、差し替え時にコンポーネントの変更は要らない。
export type FurusatoDonationSummary = {
  total: number;
  // "deduction": 年次控除の手入力額 / "donations": 寄付明細の合算
  source: "deduction" | "donations";
  donationCount: number | null;
  lastDonationDate: string | null;
};

export async function getFurusatoDonationSummaries(
  userId: string,
  years: number[]
): Promise<Record<number, FurusatoDonationSummary>> {
  const deductions = await db.deduction.findMany({
    where: { userId, year: { in: years }, deductionType: "furusatoNozei" },
    select: { year: true, amount: true },
  });

  const totalByYear = new Map<number, number>();
  for (const d of deductions) totalByYear.set(d.year, Number(d.amount));

  return Object.fromEntries(
    years.map((year) => [
      year,
      {
        total: totalByYear.get(year) ?? 0,
        source: "deduction" as const,
        donationCount: null,
        lastDonationDate: null,
      },
    ])
  );
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
  const [aggregates, deductions, overridesList] = await Promise.all([
    Promise.all(candidateYears.map((year) => getAnnualAggregate(userId, year))),
    db.deduction.findMany({ where: { userId, year: { in: candidateYears } } }),
    db.taxCalculationOverride.findMany({ where: { userId, year: { in: candidateYears } } }),
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
          furusatoNozei: perType?.furusatoNozei ?? 0,
          overrides: overridesByYear.get(year) ?? {},
        },
      ];
    })
  );
}

export async function getYearsWithTaxReturnData(userId: string): Promise<number[]> {
  const [salaries, bonuses, deductions, overrides] = await Promise.all([
    db.salary.findMany({ where: { userId, deletedAt: null }, select: { salaryDate: true } }),
    db.bonus.findMany({ where: { userId, deletedAt: null }, select: { bonusDate: true } }),
    db.deduction.findMany({ where: { userId }, select: { year: true } }),
    db.taxCalculationOverride.findMany({ where: { userId }, select: { year: true } }),
  ]);

  const years = new Set<number>();
  for (const s of salaries) years.add(s.salaryDate.getFullYear());
  for (const b of bonuses) years.add(b.bonusDate.getFullYear());
  for (const d of deductions) years.add(d.year);
  for (const o of overrides) years.add(o.year);

  return Array.from(years).sort((a, b) => b - a);
}
