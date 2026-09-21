import type { Prisma } from "@prisma/client";

import {
  BONUS_DATE_CONFLICT_MESSAGE,
  conflictResponse,
  isUniqueConstraintError,
} from "@/lib/apiConflict";
import { requireUserId } from "@/lib/auth-user";
import { db } from "@/lib/db";
import { withItemSnapshots } from "@/lib/itemSnapshotServer";
import { CreateBonusSchema } from "@/lib/validators";

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year");

  const bonuses = await db.bonus.findMany({
    where: {
      userId,
      deletedAt: null,
      ...(year && {
        bonusDate: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${Number(year) + 1}-01-01`),
        },
      }),
    },
    orderBy: { bonusDate: "desc" },
  });
  return Response.json(bonuses);
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = CreateBonusSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const bonusDate = new Date(parsed.data.bonusDate);
  const data = (await withItemSnapshots(userId, parsed.data.data ?? {})) as Prisma.InputJsonValue;

  try {
    // 削除済み（論理削除）の同日の行が一意制約に残っていると登録できないため、先に取り除く。
    // 有効な同日の行があればcreateが一意制約違反になり、トランザクションごと巻き戻る。
    const bonus = await db.$transaction(async (tx) => {
      await tx.bonus.deleteMany({ where: { userId, bonusDate, deletedAt: { not: null } } });
      return tx.bonus.create({ data: { userId, ...parsed.data, bonusDate, data } });
    });
    return Response.json(bonus, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) return conflictResponse(BONUS_DATE_CONFLICT_MESSAGE);
    throw error;
  }
}
