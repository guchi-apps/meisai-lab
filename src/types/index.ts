// API レスポンスは Prisma の `Decimal` フィールドを JSON 化する際に文字列になる
// （Decimal.js の toJSON 実装のため）。クライアント側では Number() で変換して使う。

export type SalaryDTO = {
  id: string;
  userId: string;
  salaryDate: string;
  grossSalary: string;
  netSalary: string;
  data: Record<string, unknown>;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type BonusDTO = {
  id: string;
  userId: string;
  bonusDate: string;
  amount: string;
  data: Record<string, unknown>;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ItemType =
  | "earning"
  | "otherEarning"
  | "otherTaxable"
  | "statutoryDeduction"
  | "deduction";
export type ItemScope = "salary" | "bonus" | "both";

export type ItemDTO = {
  id: string;
  userId: string;
  itemName: string;
  itemType: ItemType;
  scope: ItemScope;
  isTaxable: boolean;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TaxSettingDTO = {
  id: string;
  userId: string;
  effectiveFrom: string;
  healthInsuranceRate: string;
  pensionRate: string;
  employmentInsuranceRate: string;
  incomeRateTaxFormula: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DeductionType =
  | "lifeInsuranceGeneral"
  | "lifeInsuranceCareMedical"
  | "lifeInsurancePension"
  | "furusatoNozei";

export type DeductionDTO = {
  id: string;
  userId: string;
  deductionType: DeductionType;
  amount: string;
  year: number;
  note: string | null;
  createdAt: string;
};

export type OneStopStatus = "notApplied" | "applied" | "accepted" | "switchedToTaxReturn";
export type CertificateStatus = "notReceived" | "received" | "notNeeded";

export const ONE_STOP_STATUSES: OneStopStatus[] = [
  "notApplied",
  "applied",
  "accepted",
  "switchedToTaxReturn",
];
export const CERTIFICATE_STATUSES: CertificateStatus[] = ["notReceived", "received", "notNeeded"];

export const ONE_STOP_STATUS_LABELS: Record<OneStopStatus, string> = {
  notApplied: "未申請",
  applied: "申請済み",
  accepted: "受付済み",
  switchedToTaxReturn: "確定申告へ切替",
};

export const CERTIFICATE_STATUS_LABELS: Record<CertificateStatus, string> = {
  notReceived: "未取得",
  received: "受領済み",
  notNeeded: "不要（ワンストップ）",
};

export type FurusatoDonationDTO = {
  id: string;
  userId: string;
  year: number;
  donatedAt: string;
  municipality: string;
  amount: string;
  returnItem: string | null;
  category: string | null;
  portalSite: string | null;
  oneStopStatus: OneStopStatus;
  certificateStatus: CertificateStatus;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};
