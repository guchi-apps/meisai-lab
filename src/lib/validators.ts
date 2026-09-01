import { z } from "zod";

export const CreateSalarySchema = z.object({
  salaryDate: z.string().datetime("無効な日付形式"),
  grossSalary: z.number().positive("支給額は0より大きい数値が必須"),
  netSalary: z.number().nonnegative("手取額は0以上が必須"),
  data: z.record(z.string(), z.unknown()).optional(),
  memo: z.string().optional(),
});
export type CreateSalary = z.infer<typeof CreateSalarySchema>;
export const UpdateSalarySchema = CreateSalarySchema.partial();

export const CreateBonusSchema = z.object({
  bonusDate: z.string().datetime("無効な日付形式"),
  amount: z.number().positive("支給額は0より大きい数値が必須"),
  data: z.record(z.string(), z.unknown()).optional(),
  memo: z.string().optional(),
});
export type CreateBonus = z.infer<typeof CreateBonusSchema>;
export const UpdateBonusSchema = CreateBonusSchema.partial();

export const ItemTypeEnum = z.enum([
  "earning",
  "otherEarning",
  "otherTaxable",
  "statutoryDeduction",
  "deduction",
]);
export const ItemScopeEnum = z.enum(["salary", "bonus", "both"]);

export const CreateItemSchema = z.object({
  itemName: z.string().min(1, "項目名は必須").max(50),
  itemType: ItemTypeEnum,
  scope: ItemScopeEnum.optional(),
  isTaxable: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});
export type CreateItem = z.infer<typeof CreateItemSchema>;
export const UpdateItemSchema = CreateItemSchema.partial();

const insuranceRateSchema = z
  .number()
  .positive()
  .multipleOf(0.0001, "小数点以下4桁までで入力してください");

export const CreateTaxSettingSchema = z.object({
  effectiveYear: z.number().int().min(2000).max(2100),
  effectiveMonth: z.number().int().min(1).max(12),
  healthInsuranceRate: insuranceRateSchema.optional(),
  pensionRate: insuranceRateSchema.optional(),
  employmentInsuranceRate: insuranceRateSchema.optional(),
  incomeRateTaxFormula: z.string().optional(),
});
export type CreateTaxSetting = z.infer<typeof CreateTaxSettingSchema>;
export const UpdateTaxSettingSchema = CreateTaxSettingSchema.partial();

export const DeductionTypeEnum = z.enum([
  "lifeInsuranceGeneral",
  "lifeInsuranceCareMedical",
  "lifeInsurancePension",
  "furusatoNozei",
]);

export const CreateDeductionSchema = z.object({
  deductionType: DeductionTypeEnum,
  amount: z.number().min(0),
  year: z.number().int().min(2000).max(2100),
  note: z.string().optional(),
});
export type CreateDeduction = z.infer<typeof CreateDeductionSchema>;
export const UpdateDeductionSchema = CreateDeductionSchema.partial();

export const CreateTaxCalculationOverrideSchema = z.object({
  field: z.string().min(1).max(50),
  amount: z.number(),
  year: z.number().int().min(2000).max(2100),
});
export type CreateTaxCalculationOverride = z.infer<typeof CreateTaxCalculationOverrideSchema>;

export const LockTaxCalculationSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  values: z.record(z.string(), z.number()),
});
export type LockTaxCalculation = z.infer<typeof LockTaxCalculationSchema>;

export const OneStopStatusEnum = z.enum([
  "notApplied",
  "applied",
  "accepted",
  "switchedToTaxReturn",
]);
export const CertificateStatusEnum = z.enum(["notReceived", "received", "notNeeded"]);

const furusatoDonationFields = z.object({
  donatedAt: z.string().datetime("無効な日付形式"),
  municipality: z.string().min(1, "自治体名は必須").max(100),
  amount: z.number().positive("寄付額は0より大きい数値が必須"),
  returnItem: z.string().max(200).optional(),
  category: z.string().max(50).optional(),
  portalSite: z.string().max(50).optional(),
  oneStopStatus: OneStopStatusEnum.optional(),
  certificateStatus: CertificateStatusEnum.optional(),
  memo: z.string().optional(),
});

// ワンストップ特例をやめて確定申告に切り替える場合、寄附金控除証明書は必ず要る。
// 「確定申告へ切替」なのに証明書が「不要（ワンストップ）」という組み合わせだけを弾く。
// PATCH は送られてこなかった項目を保存済みの値で埋めてから検証する必要があるため、
// スキーマではなく assertStatusCombination() をルート側で呼ぶ。
export function isValidStatusCombination(
  oneStopStatus: string,
  certificateStatus: string
): boolean {
  return !(oneStopStatus === "switchedToTaxReturn" && certificateStatus === "notNeeded");
}

export const STATUS_COMBINATION_MESSAGE =
  "確定申告へ切替の場合、証明書を「不要（ワンストップ）」にはできません";

export const CreateFurusatoDonationSchema = furusatoDonationFields.superRefine((value, ctx) => {
  if (
    !isValidStatusCombination(
      value.oneStopStatus ?? "notApplied",
      value.certificateStatus ?? "notReceived"
    )
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["certificateStatus"],
      message: STATUS_COMBINATION_MESSAGE,
    });
  }
});
export type CreateFurusatoDonation = z.infer<typeof CreateFurusatoDonationSchema>;

export const UpdateFurusatoDonationSchema = furusatoDonationFields.partial();
export type UpdateFurusatoDonation = z.infer<typeof UpdateFurusatoDonationSchema>;
