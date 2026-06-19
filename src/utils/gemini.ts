const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
];

export async function getGeminiApiKey(): Promise<string> {
  const key = localStorage.getItem('shift_gemini_key');
  if (key) return key;

  // localStorageにない場合、Firestoreから再取得を試みる
  try {
    const { auth, loadSettingsFromFirestore, loadSharedConfig } = await import('./firebase');
    const user = auth.currentUser;
    if (user) {
      const settings = await loadSettingsFromFirestore(user.uid);
      if (settings.geminiKey) {
        localStorage.setItem('shift_gemini_key', settings.geminiKey);
        return settings.geminiKey;
      }
    }
    const shared = await loadSharedConfig();
    if (shared.apiKey) {
      localStorage.setItem('shift_gemini_key', shared.apiKey);
      return shared.apiKey;
    }
  } catch (_) { /* ignore */ }

  // 最終手段: その場で入力してもらう
  const input = prompt('Gemini APIキーを入力してください（AIzaSy...）');
  if (input && input.trim()) {
    localStorage.setItem('shift_gemini_key', input.trim());
    return input.trim();
  }

  throw new Error('Gemini APIキーが未設定です。');
}

export async function callGemini(apiKey: string, prompt: string, imageBase64: string, mimeType: string): Promise<string> {
  const payload = {
    contents: [{
      parts: [
        { text: prompt },
        { inlineData: { mimeType, data: imageBase64 } },
      ],
    }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
  };

  const failures: string[] = [];
  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 200) {
        const json = await res.json();
        const parts = json.candidates?.[0]?.content?.parts || [];
        const textParts = parts.filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought);
        return textParts.map((p: { text: string }) => p.text).join('\n').trim();
      }

      const body = await res.text().catch(() => '');
      const reason = body.match(/"message"\s*:\s*"([^"]+)"/)?.[1] || body.slice(0, 120);
      failures.push(`${model}:${res.status}${reason ? ` ${reason}` : ''}`);

      if (res.status === 403 || res.status === 429 || res.status === 404 || res.status === 503) {
        continue;
      }

      throw new Error(`Gemini API HTTP ${res.status} ${reason}`);
    } catch (err) {
      if (model === GEMINI_MODELS[GEMINI_MODELS.length - 1]) {
        throw new Error(`Gemini全モデル失敗: ${failures.join(' / ')}`);
      }
    }
  }

  throw new Error(`Gemini全モデル失敗: ${failures.join(' / ')}`);
}

// シフト表解析
export async function analyzeShiftImage(apiKey: string, imageBase64: string, mimeType: string) {
  const prompt = `あなたは医療施設のシフト表画像を正確に読み取るエキスパートです。

## シフト表の構造
- 上部に「YYYY年 M月 勤務表」というタイトル
- 左上に施設名（「交野」「枚方」など）が大きく書かれている場合がある
- 下部に「夜非常勤」セクションがあり、スタッフ名の行が並ぶ
- 表は前半（1〜15日）と後半（16〜末日）の2ブロック構成

## 解析対象
「四ツ橋」（よつはし）という名前の行のみ。

## 手順
1. 年月をタイトルから取得
2. 施設名判定: 左上に「交野」→katano / 「枚方」→hirakata / 「守口」→moriguchi / なし→kadoma
3. 日付列を正確にマッピング（前半・後半2ブロック、曜日行も参考に）
4. 四ツ橋の行で「夜」が入っている日を抽出
5. 文字色判定: 黒→time:"20" / 赤・青・緑→time:"17"

## 出力（JSONのみ）
\`\`\`json
{"facility":"katano","year":2026,"month":4,"shifts":[{"day":1,"place":"katano","time":"20"}]}
\`\`\`
四ツ橋の行が見つからない場合はshiftsを空配列に。`;

  const text = await callGemini(apiKey, prompt, imageBase64, mimeType);

  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || [null, text];
  const braceMatch = (jsonMatch[1] || text).match(/\{[\s\S]*\}/);
  if (!braceMatch) throw new Error('解析結果を読み取れませんでした');

  const data = JSON.parse(braceMatch[0]);

  // 正規化
  const facilityMap: Record<string, string> = { '交野': 'katano', '枚方': 'hirakata', '門真': 'kadoma', '守口': 'moriguchi' };
  let facility = String(data.facility || 'kadoma').toLowerCase();
  if (!['katano', 'hirakata', 'kadoma', 'moriguchi'].includes(facility)) {
    facility = facilityMap[data.facility] || 'kadoma';
  }

  const shifts = (data.shifts || [])
    .map((s: { day: number; time: string }) => ({
      day: Number(s.day),
      place: facility,
      time: s.time === '17' ? '17' : '20',
    }))
    .filter((s: { day: number }) => s.day >= 1 && s.day <= 31)
    .sort((a: { day: number }, b: { day: number }) => a.day - b.day);

  return { facility, year: Number(data.year), month: Number(data.month), shifts };
}

// イベント解析
export async function analyzeEventImage(apiKey: string, imageBase64: string, mimeType: string) {
  const prompt = `この画像からイベント・予定情報を読み取ってください。

## 抽出する情報
- 日付（YYYY-MM-DD形式）
- 時間（HH:MM形式、不明なら空文字）
- 内容（30文字以内で簡潔に要約）
- URL（画像中にリンクやURLが含まれていれば抽出、なければ空文字）

## ルール
- 複数のイベントがあれば全て抽出
- 日付不明は空文字、年が書いてなければ2026年と仮定

## 出力（JSONのみ）
\`\`\`json
{"events":[{"date":"2026-04-15","time":"15:00","content":"イベント名","url":""}]}
\`\`\``;

  const text = await callGemini(apiKey, prompt, imageBase64, mimeType);

  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || [null, text];
  const braceMatch = (jsonMatch[1] || text).match(/\{[\s\S]*\}/);
  if (!braceMatch) throw new Error('イベント情報を読み取れませんでした');

  const data = JSON.parse(braceMatch[0]);
  return {
    events: (data.events || []).map((e: { date: string; time: string; content: string; url?: string }) => ({
      date: String(e.date || ''),
      time: String(e.time || ''),
      content: String(e.content || '').substring(0, 50),
      url: String(e.url || ''),
    })),
  };
}
