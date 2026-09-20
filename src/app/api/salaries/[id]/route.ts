import type { Prisma } from "@prisma/client";

import { requireUserId } from "@/lib/auth-user";
import { db } from "@/lib/db";
import { withItemSnapshots } from "@/lib/itemSnapshotServer";
import { UpdateSalarySchema } from "@/lib/validators";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const salary = await db.salary.findFirst({
    where: { id, userId, deletedAt: null },
  });
  if (!salary) return Response.json({ error: "Not Found" }, { status: 404 });

  return Response.json(salary);
}

export async function PUT(request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = UpdateSalarySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await db.salary.findFirst({ where: { id, userId, deletedAt: null } });
  if (!existing) return Response.json({ error: "Not Found" }, { status: 404 });

  const { salaryDate, data, ...rest } = parsed.data;
  const salary = await db.salary.update({
    where: { id },
    data: {
      ...rest,
      ...(salaryDate && { salaryDate: new Date(salaryDate) }),
      ...(data && {
        data: (await withItemSnapshots(userId, data, existing.data)) as Prisma.InputJsonValue,
      }),
    },
  });
  return Response.json(salary);
}

export async function DELETE(_request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.salary.findFirst({ where: { id, userId, deletedAt: null } });
  if (!existing) return Response.json({ error: "Not Found" }, { status: 404 });

  await db.salary.update({ where: { id }, data: { deletedAt: new Date() } });
  return new Response(null, { status: 204 });
}
