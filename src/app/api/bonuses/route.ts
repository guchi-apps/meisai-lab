import type { Prisma } from "@prisma/client";

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

  const bonus = await db.bonus.create({
    data: {
      userId,
      ...parsed.data,
      bonusDate: new Date(parsed.data.bonusDate),
      data: (await withItemSnapshots(userId, parsed.data.data ?? {})) as Prisma.InputJsonValue,
    },
  });
  return Response.json(bonus, { status: 201 });
}
