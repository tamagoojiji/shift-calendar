// 画像解析API（print-to-calendar バックエンド相乗り）
// 旧: ユーザー入力のAPIキーでGeminiを直叩き
// 新: サーバー側で Vertex（特典クレジット・キー不要）解析。プロンプト・正規化もサーバーに移植済み。
const API_BASE = 'https://print-to-calendar.tamago-ai-world.com';

async function callAnalyzeApi<T>(kind: 'shift' | 'event', imageBase64: string, mimeType: string): Promise<T> {
  const res = await fetch(`${API_BASE}/api/shift-analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, imageBase64, mimeType }),
  });

  const json = await res.json().catch(() => null) as { ok?: boolean; result?: T; error?: string } | null;
  if (!res.ok || !json?.ok || !json.result) {
    throw new Error(json?.error || `解析サーバーエラー (HTTP ${res.status})`);
  }
  return json.result;
}

// シフト表解析
export async function analyzeShiftImage(imageBase64: string, mimeType: string) {
  return callAnalyzeApi<{
    facility: 'katano' | 'hirakata' | 'kadoma' | 'moriguchi';
    year: number;
    month: number;
    shifts: { day: number; place: 'katano' | 'hirakata' | 'kadoma' | 'moriguchi'; time: '17' | '20' }[];
  }>('shift', imageBase64, mimeType);
}

// イベント解析
export async function analyzeEventImage(imageBase64: string, mimeType: string) {
  return callAnalyzeApi<{
    events: { date: string; time: string; content: string; url: string }[];
  }>('event', imageBase64, mimeType);
}
