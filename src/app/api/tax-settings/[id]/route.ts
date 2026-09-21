import {
  TAX_SETTING_CONFLICT_MESSAGE,
  conflictResponse,
  isUniqueConstraintError,
} from "@/lib/apiConflict";
import { requireUserId } from "@/lib/auth-user";
import { db } from "@/lib/db";
import { buildEffectiveFrom } from "@/lib/taxSetting";
import { UpdateTaxSettingSchema } from "@/lib/validators";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = UpdateTaxSettingSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await db.taxSetting.findFirst({ where: { id, userId } });
  if (!existing) return Response.json({ error: "Not Found" }, { status: 404 });

  const { effectiveYear, effectiveMonth, ...rates } = parsed.data;
  const data =
    effectiveYear !== undefined && effectiveMonth !== undefined
      ? { ...rates, effectiveFrom: buildEffectiveFrom(effectiveYear, effectiveMonth) }
      : rates;

  try {
    const taxSetting = await db.taxSetting.update({ where: { id }, data });
    return Response.json(taxSetting);
  } catch (error) {
    if (isUniqueConstraintError(error)) return conflictResponse(TAX_SETTING_CONFLICT_MESSAGE);
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.taxSetting.findFirst({ where: { id, userId } });
  if (!existing) return Response.json({ error: "Not Found" }, { status: 404 });

  await db.taxSetting.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
