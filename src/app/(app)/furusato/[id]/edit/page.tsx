import { notFound, redirect } from "next/navigation";

import { requireUserId } from "@/lib/auth-user";
import { db } from "@/lib/db";
import { FurusatoDonationForm } from "@/components/FurusatoDonationForm";
import type { FurusatoDonationDTO } from "@/types";

export default async function EditFurusatoDonationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await requireUserId();
  if (!userId) redirect("/auth/signin");

  const { id } = await params;
  const donation = await db.furusatoDonation.findFirst({
    where: { id, userId, deletedAt: null },
  });
  if (!donation) notFound();

  const donationDto = JSON.parse(JSON.stringify(donation)) as FurusatoDonationDTO;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">寄付を編集</h1>
      <FurusatoDonationForm donation={donationDto} />
    </div>
  );
}
