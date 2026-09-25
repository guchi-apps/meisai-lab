import { requireUserId } from "@/lib/auth-user";
import { readPayslipPdf } from "@/lib/payslipPdfServer";

// 給与明細PDFを読み取り、項目名と金額の行を返す（#256）。PDFは保存しない。
// 割り当て（どの入力欄へ入れるか）は利用者の項目・記憶に依存するため、クライアント側で行う。

const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "PDFファイルを選んでください" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "PDFが大きすぎます（2MBまで）" }, { status: 413 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") {
    return Response.json({ error: "PDFファイルを選んでください" }, { status: 400 });
  }
  const password = form?.get("password");

  const result = await readPayslipPdf(bytes, typeof password === "string" ? password : undefined);
  if (!result.ok) {
    return Response.json({ error: result.error, needsPassword: result.needsPassword }, { status: 422 });
  }
  return Response.json(result.parsed);
}
