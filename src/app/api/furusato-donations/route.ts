import { requireUserId } from "@/lib/auth-user";
import { db } from "@/lib/db";
import {
  CertificateStatusEnum,
  CreateFurusatoDonationSchema,
  OneStopStatusEnum,
} from "@/lib/validators";

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);

  const yearParam = searchParams.get("year");
  if (yearParam !== null && !/^\d{4}$/.test(yearParam)) {
    return Response.json({ error: "year は4桁の西暦で指定してください" }, { status: 400 });
  }

  const oneStopParam = searchParams.get("oneStopStatus");
  if (oneStopParam !== null && !OneStopStatusEnum.safeParse(oneStopParam).success) {
    return Response.json({ error: "oneStopStatus が不正です" }, { status: 400 });
  }

  const certificateParam = searchParams.get("certificateStatus");
  if (certificateParam !== null && !CertificateStatusEnum.safeParse(certificateParam).success) {
    return Response.json({ error: "certificateStatus が不正です" }, { status: 400 });
  }

  const donations = await db.furusatoDonation.findMany({
    where: {
      userId,
      deletedAt: null,
      ...(yearParam !== null ? { year: Number(yearParam) } : {}),
      ...(oneStopParam !== null ? { oneStopStatus: oneStopParam } : {}),
      ...(certificateParam !== null ? { certificateStatus: certificateParam } : {}),
    },
    orderBy: { donatedAt: "desc" },
  });
  return Response.json(donations);
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = CreateFurusatoDonationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { donatedAt, ...rest } = parsed.data;
  const donatedAtDate = new Date(donatedAt);

  const donation = await db.furusatoDonation.create({
    data: {
      userId,
      ...rest,
      donatedAt: donatedAtDate,
      // year は donatedAt から導出する。クライアントからは受け取らない
      year: donatedAtDate.getFullYear(),
    },
  });
  return Response.json(donation, { status: 201 });
}
