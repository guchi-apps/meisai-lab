import type { Prisma } from "@prisma/client";

import {
  BONUS_DATE_CONFLICT_MESSAGE,
  conflictResponse,
  isUniqueConstraintError,
} from "@/lib/apiConflict";
import { requireUserId } from "@/lib/auth-user";
import { db } from "@/lib/db";
import { withItemSnapshots } from "@/lib/itemSnapshotServer";
import { UpdateBonusSchema } from "@/lib/validators";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = UpdateBonusSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await db.bonus.findFirst({ where: { id, userId, deletedAt: null } });
  if (!existing) return Response.json({ error: "Not Found" }, { status: 404 });

  const { bonusDate, data, ...rest } = parsed.data;
  const nextDate = bonusDate ? new Date(bonusDate) : undefined;
  const updateData = {
    ...rest,
    ...(nextDate && { bonusDate: nextDate }),
    ...(data && {
      data: (await withItemSnapshots(userId, data, existing.data)) as Prisma.InputJsonValue,
    }),
  };

  try {
    // 支給日を変える場合、変更先に削除済み（論理削除）の行があると一意制約に当たるため先に取り除く。
    // 有効な同日の行があればupdateが一意制約違反になり、トランザクションごと巻き戻る。
    const bonus = await db.$transaction(async (tx) => {
      if (nextDate) {
        await tx.bonus.deleteMany({
          where: { userId, bonusDate: nextDate, deletedAt: { not: null }, id: { not: id } },
        });
      }
      return tx.bonus.update({ where: { id }, data: updateData });
    });
    return Response.json(bonus);
  } catch (error) {
    if (isUniqueConstraintError(error)) return conflictResponse(BONUS_DATE_CONFLICT_MESSAGE);
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.bonus.findFirst({ where: { id, userId, deletedAt: null } });
  if (!existing) return Response.json({ error: "Not Found" }, { status: 404 });

  await db.bonus.update({ where: { id }, data: { deletedAt: new Date() } });
  return new Response(null, { status: 204 });
}
