// 画像解析API（print-to-calendar バックエンド相乗り）
// 旧: ユーザー入力のAPIキーでGeminiを直叩き
// 新: サーバー側で Vertex（特典クレジット・キー不要）解析。プロンプト・正規化もサーバーに移植済み。
const API_BASE = 'https://print-to-calendar.tamago-ai-world.com';

// バックエンド /api/shift-analyze の共有トークン。無差別なドライブバイ呼び出しを弾く水際用。
// ※公開SPAのためこの値はバンドルに載る（＝暗号学的な秘密ではない）。損害上限は$10予算ガードが担保。
const SHIFT_TOKEN = '6891a2835ad368580a57b7607f640b59349a444f63a5ec4b';

async function callAnalyzeApi<T>(kind: 'event', imageBase64: string, mimeType: string): Promise<T> {
  const res = await fetch(`${API_BASE}/api/shift-analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shift-Token': SHIFT_TOKEN },
    body: JSON.stringify({ kind, imageBase64, mimeType }),
  });

  const json = await res.json().catch(() => null) as { ok?: boolean; result?: T; error?: string } | null;
  if (!res.ok || !json?.ok || !json.result) {
    throw new Error(json?.error || `解析サーバーエラー (HTTP ${res.status})`);
  }
  return json.result;
}

// イベント解析
export async function analyzeEventImage(imageBase64: string, mimeType: string) {
  return callAnalyzeApi<{
    events: { date: string; time: string; content: string; url: string }[];
  }>('event', imageBase64, mimeType);
}
