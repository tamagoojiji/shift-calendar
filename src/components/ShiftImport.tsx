import { useState, useRef } from 'react';
import type { NightShiftPlace, NightShiftTime } from '../types';
import { saveDay, getDay } from '../utils/storage';

interface ParsedShift {
  day: number;
  place: NightShiftPlace;
  time: NightShiftTime;
}

interface ImportResult {
  facility: string;
  year: number;
  month: number;
  shifts: ParsedShift[];
}

export default function ShiftImport() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const gasUrl = 'https://script.google.com/macros/s/AKfycbyoz4fFLLQx0Ot2aM_94ut8eT9OU9a5eEN6urWNMR-LXlBLGefznSwSRIqq4N8Ityo7Fw/exec';
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!gasUrl) {
      setError('設定タブでGAS URLを設定してください');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // 画像をBase64に変換
      const base64 = await fileToBase64(file);

      // デバッグ: URL確認
      console.log('GAS URL:', gasUrl);
      console.log('Image size:', Math.round(base64.length / 1024), 'KB');

      // GAS経由でGemini APIに送信（text/plainでCORS対策）
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ image: base64, mimeType: file.type }),
      });

      const text = await response.text();
      console.log('Response:', text.substring(0, 200));

      // HTMLが返ってきた場合はエラー
      if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
        throw new Error('GASからHTMLエラーが返されました。GAS URLを確認してください。現在のURL: ' + gasUrl.substring(0, 50) + '...');
      }

      const data = JSON.parse(text);

      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '読み取りに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const applyShifts = () => {
    if (!result) return;

    result.shifts.forEach(shift => {
      const dateStr = `${result.year}-${String(result.month).padStart(2, '0')}-${String(shift.day).padStart(2, '0')}`;
      const day = getDay(dateStr);
      day.nightShift = shift.place;
      day.nightTime = shift.time;
      saveDay(day);
    });

    alert(`${result.shifts.length}件のシフトを反映しました`);
    setResult(null);
  };

  const placeLabels: Record<string, string> = {
    katano: '交野',
    hirakata: '枚方',
    kadoma: '門真',
    moriguchi: '守口',
  };

  return (
    <div className="shift-import">
      <h2 className="import-title">シフト読込</h2>

      {false && (
        <div className="import-warning">
          設定タブでGAS URLを設定してください
        </div>
      )}

      <div className="import-section">
        <p className="import-desc">夜勤シフト表のスクリーンショットをアップロードしてください。「四ツ橋」の行を自動で読み取ります。</p>

        <div className="import-upload-area" onClick={() => fileRef.current?.click()}>
          <div className="import-upload-icon">📷</div>
          <div>タップして画像を選択</div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            hidden
          />
        </div>
      </div>

      {loading && (
        <div className="import-loading">
          <div className="spinner" />
          <p>読み取り中...</p>
        </div>
      )}

      {error && (
        <div className="import-error">{error}</div>
      )}

      {result && (
        <div className="import-result">
          <h3>{result.year}年{result.month}月 - {result.facility}</h3>
          <div className="import-preview">
            <table className="import-table">
              <thead>
                <tr>
                  <th>日</th>
                  <th>施設</th>
                  <th>時間</th>
                </tr>
              </thead>
              <tbody>
                {result.shifts.map((s, i) => (
                  <tr key={i}>
                    <td>{s.day}日</td>
                    <td>{s.place ? placeLabels[s.place] : '-'}</td>
                    <td>{s.time === '17' ? '17時〜' : '20時〜'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="import-actions">
            <button className="import-apply-btn" onClick={applyShifts}>カレンダーに反映</button>
            <button className="import-cancel-btn" onClick={() => setResult(null)}>キャンセル</button>
          </div>
        </div>
      )}

      {/* 手入力エリア（守口用） */}
      <div className="import-section">
        <h3>手入力（守口など）</h3>
        <p className="import-desc">マイカレンダーで日付を長押しするとシフト入力できます。</p>
      </div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // data:...;base64, の後ろだけ
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
