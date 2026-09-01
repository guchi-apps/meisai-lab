import { redirect } from "next/navigation";

import { requireUserId } from "@/lib/auth-user";
import { FurusatoDonationForm } from "@/components/FurusatoDonationForm";

export default async function NewFurusatoDonationPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const userId = await requireUserId();
  if (!userId) redirect("/auth/signin");

  const { year: yearParam } = await searchParams;
  const parsedYear = Number(yearParam);
  const defaultYear = Number.isInteger(parsedYear) ? parsedYear : undefined;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">寄付を登録</h1>
      <FurusatoDonationForm defaultYear={defaultYear} />
    </div>
  );
}
