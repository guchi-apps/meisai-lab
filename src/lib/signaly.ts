type SignalyField = { name: string; value: string; inline: boolean };

export async function notifySignalyLogin(params: {
  email: string | null;
  ip: string | null;
}): Promise<void> {
  const webhookUrl = process.env.SIGNALY_LOGIN_WEBHOOK_URL;
  if (!webhookUrl) return;

  const timestamp = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  const fields: SignalyField[] = [{ name: "時刻", value: timestamp, inline: false }];
  if (params.email) {
    fields.push({ name: "メール", value: params.email, inline: false });
  }
  if (params.ip) {
    fields.push({ name: "IP", value: params.ip, inline: false });
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // 共通チャンネルではチャンネルから送信元を判別できないため、
        // Signalyが送信元を見分けるための source をリポジトリ名で明示する。
        source: "meisai-lab",
        embeds: [{ title: "🔐 meisai-lab にログイン", color: 5763719, fields }],
      }),
    });
  } catch (error) {
    console.error("Signaly notification failed:", error);
  }
}
