import type { Prisma } from "@prisma/client";

import {
  SALARY_DATE_CONFLICT_MESSAGE,
  conflictResponse,
  isUniqueConstraintError,
} from "@/lib/apiConflict";
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

  const salaryDate = new Date(parsed.data.salaryDate);
  const data = (await withItemSnapshots(userId, parsed.data.data ?? {})) as Prisma.InputJsonValue;

  try {
    // 削除済み（論理削除）の同日の行が一意制約に残っていると登録できないため、先に取り除く。
    // 有効な同日の行があればcreateが一意制約違反になり、トランザクションごと巻き戻る。
    const salary = await db.$transaction(async (tx) => {
      await tx.salary.deleteMany({ where: { userId, salaryDate, deletedAt: { not: null } } });
      return tx.salary.create({ data: { userId, ...parsed.data, salaryDate, data } });
    });
    return Response.json(salary, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) return conflictResponse(SALARY_DATE_CONFLICT_MESSAGE);
    throw error;
  }
}
