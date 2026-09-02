import { cn } from "@/lib/utils";
import {
  CERTIFICATE_STATUS_LABELS,
  ONE_STOP_STATUS_LABELS,
  type CertificateStatus,
  type FurusatoDonationDTO,
  type OneStopStatus,
} from "@/types";

// ワンストップ特例を使えるのは寄付先が5自治体までで、6自治体目からは確定申告が必要になる。
export const ONE_STOP_MUNICIPALITY_LIMIT = 5;

// 「手を動かす必要がある状態」だけを警告色にする。受付待ち(applied)は自治体側の処理待ちなので
// 中間色、確定申告へ切替・証明書不要は意図した状態なので無彩色にしている。
const STATUS_TONE = {
  attention: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  waiting: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  done: "border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300",
  neutral: "border-border bg-muted text-muted-foreground",
} as const;

type StatusTone = keyof typeof STATUS_TONE;

const ONE_STOP_TONE: Record<OneStopStatus, StatusTone> = {
  notApplied: "attention",
  applied: "waiting",
  accepted: "done",
  switchedToTaxReturn: "neutral",
};

const CERTIFICATE_TONE: Record<CertificateStatus, StatusTone> = {
  notReceived: "attention",
  received: "done",
  notNeeded: "neutral",
};

function StatusBadge({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        STATUS_TONE[tone]
      )}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

export function OneStopStatusBadge({ status }: { status: OneStopStatus }) {
  return <StatusBadge tone={ONE_STOP_TONE[status]}>{ONE_STOP_STATUS_LABELS[status]}</StatusBadge>;
}

export function CertificateStatusBadge({
  status,
  withPrefix = false,
}: {
  status: CertificateStatus;
  withPrefix?: boolean;
}) {
  return (
    <StatusBadge tone={CERTIFICATE_TONE[status]}>
      {withPrefix ? `証明書 ${CERTIFICATE_STATUS_LABELS[status]}` : CERTIFICATE_STATUS_LABELS[status]}
    </StatusBadge>
  );
}

/** 未申請・未取得のどちらかが残っている＝年末までに手を動かす必要がある明細 */
export function needsAction(donation: FurusatoDonationDTO): boolean {
  return donation.oneStopStatus === "notApplied" || donation.certificateStatus === "notReceived";
}
