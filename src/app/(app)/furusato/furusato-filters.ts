import type { FurusatoDonationDTO } from "@/types";

// 絞り込みの状態はURLに載せる（例: /furusato?year=2026&oneStopStatus=notApplied）。
// クエリのキーと値は `GET /api/furusato-donations` の絞り込みと同じものを使い、
// 画面のURLをそのままAPIの問い合わせに読み替えられるようにしている。
export type FurusatoStatusFilter = {
  key: string;
  label: string;
  query: { oneStopStatus?: string; certificateStatus?: string };
  match: (donation: FurusatoDonationDTO) => boolean;
};

export const FURUSATO_STATUS_FILTERS: FurusatoStatusFilter[] = [
  {
    key: "all",
    label: "すべて",
    query: {},
    match: () => true,
  },
  {
    key: "oneStopNotApplied",
    label: "ワンストップ未申請",
    query: { oneStopStatus: "notApplied" },
    match: (donation) => donation.oneStopStatus === "notApplied",
  },
  {
    key: "certificateNotReceived",
    label: "証明書 未取得",
    query: { certificateStatus: "notReceived" },
    match: (donation) => donation.certificateStatus === "notReceived",
  },
  {
    key: "switchedToTaxReturn",
    label: "確定申告へ切替",
    query: { oneStopStatus: "switchedToTaxReturn" },
    match: (donation) => donation.oneStopStatus === "switchedToTaxReturn",
  },
];

function normalize(value: string | undefined): string | undefined {
  return value ? value : undefined;
}

/** 未知の値が来たときは「すべて」に落とす（URLを手で編集されても壊れないように） */
export function resolveStatusFilter(
  oneStopStatus: string | undefined,
  certificateStatus: string | undefined
): FurusatoStatusFilter {
  const one = normalize(oneStopStatus);
  const certificate = normalize(certificateStatus);
  return (
    FURUSATO_STATUS_FILTERS.find(
      (filter) =>
        filter.query.oneStopStatus === one && filter.query.certificateStatus === certificate
    ) ?? FURUSATO_STATUS_FILTERS[0]
  );
}

export function buildFilterHref(year: number, filter: FurusatoStatusFilter): string {
  const params = new URLSearchParams({ year: String(year) });
  if (filter.query.oneStopStatus) params.set("oneStopStatus", filter.query.oneStopStatus);
  if (filter.query.certificateStatus) params.set("certificateStatus", filter.query.certificateStatus);
  return `/furusato?${params.toString()}`;
}
