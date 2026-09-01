import { requireUserId } from "@/lib/auth-user";
import { db } from "@/lib/db";
import {
  isValidStatusCombination,
  STATUS_COMBINATION_MESSAGE,
  UpdateFurusatoDonationSchema,
} from "@/lib/validators";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.furusatoDonation.findFirst({ where: { id, userId, deletedAt: null } });
  if (!existing) return Response.json({ error: "Not Found" }, { status: 404 });

  const body = await request.json();
  const parsed = UpdateFurusatoDonationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { donatedAt, ...rest } = parsed.data;

  // 送られてこなかった項目は保存済みの値のままになるため、更新後の組み合わせで検証する
  const nextOneStopStatus = rest.oneStopStatus ?? existing.oneStopStatus;
  const nextCertificateStatus = rest.certificateStatus ?? existing.certificateStatus;
  if (!isValidStatusCombination(nextOneStopStatus, nextCertificateStatus)) {
    return Response.json(
      { error: { fieldErrors: { certificateStatus: [STATUS_COMBINATION_MESSAGE] } } },
      { status: 400 }
    );
  }

  const donatedAtDate = donatedAt !== undefined ? new Date(donatedAt) : undefined;

  const donation = await db.furusatoDonation.update({
    where: { id },
    data: {
      ...rest,
      // 寄付日を動かしたら year も追随させる（年をまたぐ修正で集計が食い違わないように）
      ...(donatedAtDate !== undefined
        ? { donatedAt: donatedAtDate, year: donatedAtDate.getFullYear() }
        : {}),
    },
  });
  return Response.json(donation);
}

export async function DELETE(_request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.furusatoDonation.findFirst({ where: { id, userId, deletedAt: null } });
  if (!existing) return Response.json({ error: "Not Found" }, { status: 404 });

  await db.furusatoDonation.update({ where: { id }, data: { deletedAt: new Date() } });
  return new Response(null, { status: 204 });
}
