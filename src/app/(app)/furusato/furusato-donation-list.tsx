"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { format } from "date-fns";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CertificateStatusBadge,
  OneStopStatusBadge,
  needsAction,
} from "./furusato-status";
import type { FurusatoDonationDTO } from "@/types";

function formatDate(iso: string) {
  return format(new Date(iso), "yyyy/MM/dd");
}

function formatYen(amount: number) {
  return `${Math.round(amount).toLocaleString()} 円`;
}

function DeleteDonationButton({
  donation,
  onDelete,
  isDeleting,
  className,
}: {
  donation: FurusatoDonationDTO;
  onDelete: (id: string) => void;
  isDeleting: boolean;
  className?: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={className}
          aria-label={`${donation.municipality}への寄付を削除`}
          disabled={isDeleting}
        >
          {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>この寄付を削除しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            {donation.municipality}・{formatDate(donation.donatedAt)}・
            {formatYen(Number(donation.amount))}の明細を削除します。年間寄付額や未完了件数の集計も
            あわせて変わります。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction onClick={() => onDelete(donation.id)}>削除する</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function FurusatoDonationList({
  donations,
  isFiltered,
}: {
  donations: FurusatoDonationDTO[];
  isFiltered: boolean;
}) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/furusato-donations/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("削除に失敗しました");
        return;
      }
      toast.success("寄付を削除しました");
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  if (donations.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        {isFiltered
          ? "この絞り込みに該当する寄付はありません。"
          : "この年の寄付はまだ登録されていません。「寄付を追加」から登録してください。"}
      </p>
    );
  }

  const total = donations.reduce((sum, donation) => sum + Number(donation.amount), 0);

  return (
    <>
      {/* PC・タブレット: 表 */}
      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>自治体</TableHead>
              <TableHead>寄付日</TableHead>
              <TableHead className="text-right">寄付額</TableHead>
              <TableHead>返礼品・ポータル</TableHead>
              <TableHead>ワンストップ特例</TableHead>
              <TableHead>証明書</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {donations.map((donation) => (
              <TableRow key={donation.id}>
                <TableCell
                  className={cn(
                    "font-medium",
                    needsAction(donation) && "border-l-[3px] border-l-amber-500"
                  )}
                >
                  {donation.municipality}
                  {donation.category && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {donation.category}
                    </span>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">{formatDate(donation.donatedAt)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {Math.round(Number(donation.amount)).toLocaleString()}
                </TableCell>
                <TableCell>
                  {donation.returnItem ?? <span className="text-muted-foreground">—</span>}
                  {donation.portalSite && (
                    <span className="block text-xs text-muted-foreground">{donation.portalSite}</span>
                  )}
                </TableCell>
                <TableCell>
                  <OneStopStatusBadge status={donation.oneStopStatus} />
                </TableCell>
                <TableCell>
                  <CertificateStatusBadge status={donation.certificateStatus} />
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" asChild>
                      <Link
                        href={`/furusato/${donation.id}/edit`}
                        aria-label={`${donation.municipality}への寄付を編集`}
                      >
                        <Pencil />
                      </Link>
                    </Button>
                    <DeleteDonationButton
                      donation={donation}
                      onDelete={handleDelete}
                      isDeleting={deletingId === donation.id}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2}>表示中の {donations.length} 件</TableCell>
              <TableCell className="text-right tabular-nums">{Math.round(total).toLocaleString()}</TableCell>
              <TableCell colSpan={4} />
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      {/* スマホ: カード */}
      <div className="divide-y md:hidden">
        {donations.map((donation) => (
          <div
            key={donation.id}
            className={cn(
              "space-y-2 py-3",
              needsAction(donation) && "-ml-3 border-l-[3px] border-l-amber-500 pl-3"
            )}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-semibold">{donation.municipality}</span>
              <span className="shrink-0 font-semibold tabular-nums">
                {formatYen(Number(donation.amount))}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {[formatDate(donation.donatedAt), donation.returnItem, donation.portalSite]
                .filter(Boolean)
                .join(" ・ ")}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <OneStopStatusBadge status={donation.oneStopStatus} />
              <CertificateStatusBadge status={donation.certificateStatus} withPrefix />
              <div className="ml-auto flex gap-1">
                <Button variant="ghost" size="icon" asChild>
                  <Link
                    href={`/furusato/${donation.id}/edit`}
                    aria-label={`${donation.municipality}への寄付を編集`}
                  >
                    <Pencil />
                  </Link>
                </Button>
                <DeleteDonationButton
                  donation={donation}
                  onDelete={handleDelete}
                  isDeleting={deletingId === donation.id}
                />
              </div>
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between py-3 text-sm font-semibold tabular-nums">
          <span>表示中の {donations.length} 件</span>
          <span>{formatYen(total)}</span>
        </div>
      </div>
    </>
  );
}
