import type { Prisma } from "@prisma/client";

import { requireUserId } from "@/lib/auth-user";
import { db } from "@/lib/db";
import { withItemSnapshots } from "@/lib/itemSnapshotServer";
import { CreateSalarySchema } from "@/lib/validators";

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  const salaries = await db.salary.findMany({
    where: {
      userId,
      deletedAt: null,
      ...(year && {
        salaryDate: month
          ? {
              gte: new Date(`${year}-${month.padStart(2, "0")}-01`),
              lt: new Date(
                Number(month) === 12
                  ? `${Number(year) + 1}-01-01`
                  : `${year}-${String(Number(month) + 1).padStart(2, "0")}-01`
              ),
            }
          : {
              gte: new Date(`${year}-01-01`),
              lt: new Date(`${Number(year) + 1}-01-01`),
            },
      }),
    },
    orderBy: { salaryDate: "desc" },
  });
  return Response.json(salaries);
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = CreateSalarySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const salary = await db.salary.create({
    data: {
      userId,
      ...parsed.data,
      salaryDate: new Date(parsed.data.salaryDate),
      data: (await withItemSnapshots(userId, parsed.data.data ?? {})) as Prisma.InputJsonValue,
    },
  });
  return Response.json(salary, { status: 201 });
}
