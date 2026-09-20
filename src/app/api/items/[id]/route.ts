import { requireUserId } from "@/lib/auth-user";
import { db } from "@/lib/db";
import { freezeItemDefinition } from "@/lib/itemSnapshotServer";
import { UpdateItemSchema } from "@/lib/validators";

type Params = { params: Promise<{ id: string }> };

// 明細を1件ずつ更新するため、明細数が多いユーザーでも既定の5秒で打ち切られないようにする
const TRANSACTION_OPTIONS = { timeout: 30_000 };

export async function PUT(request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = UpdateItemSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await db.item.findFirst({ where: { id, userId } });
  if (!existing) return Response.json({ error: "Not Found" }, { status: 404 });

  // 名前・種別・課税対象を変えると、明細の集計が現在の項目定義を見ている限り過去年の計算まで変わる。
  // 変更前の定義を既存の明細へ写してから更新する（#212）
  const changesDefinition =
    (parsed.data.itemName !== undefined && parsed.data.itemName !== existing.itemName) ||
    (parsed.data.itemType !== undefined && parsed.data.itemType !== existing.itemType) ||
    (parsed.data.isTaxable !== undefined && parsed.data.isTaxable !== existing.isTaxable);

  const item = await db.$transaction(async (tx) => {
    if (changesDefinition) await freezeItemDefinition(tx, userId, existing);
    return tx.item.update({ where: { id }, data: parsed.data });
  }, TRANSACTION_OPTIONS);
  return Response.json(item);
}

export async function DELETE(_request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.item.findFirst({ where: { id, userId } });
  if (!existing) return Response.json({ error: "Not Found" }, { status: 404 });

  // 削除後も過去の明細の集計が変わらないよう、削除前の定義を既存の明細へ写しておく（#212）
  await db.$transaction(async (tx) => {
    await freezeItemDefinition(tx, userId, existing);
    await tx.item.delete({ where: { id } });
  }, TRANSACTION_OPTIONS);
  return new Response(null, { status: 204 });
}
