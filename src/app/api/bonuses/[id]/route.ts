import type { Prisma } from "@prisma/client";

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
  const bonus = await db.bonus.update({
    where: { id },
    data: {
      ...rest,
      ...(bonusDate && { bonusDate: new Date(bonusDate) }),
      ...(data && {
        data: (await withItemSnapshots(userId, data, existing.data)) as Prisma.InputJsonValue,
      }),
    },
  });
  return Response.json(bonus);
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
