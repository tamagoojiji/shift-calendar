import { useState, useRef } from 'react';
import type { NightShiftPlace, NightShiftTime } from '../types';
import { saveDay, getDay } from '../utils/storage';
import { getDaysInMonth, formatDate, getToday, WEEKDAY_LABELS } from '../utils/dateUtils';

// === 夜勤関連の型 ===
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

// === 日勤関連の型 ===
type DayShiftOption = 'eye_full' | 'eye_am' | 'facility' | 'off' | 'none';

interface DayShiftRow {
  day: number;
  dow: number;
  shift: DayShiftOption;
}

export default function ShiftImport() {
  const [mode, setMode] = useState<'day' | 'night' | 'event'>('day');

  return (
    <div className="shift-import">
      {/* モード切替 */}
      <div className="import-mode-tabs">
        <button
          className={`import-mode-tab ${mode === 'day' ? 'active' : ''}`}
          onClick={() => setMode('day')}
        >
          日勤入力
        </button>
        <button
          className={`import-mode-tab ${mode === 'night' ? 'active' : ''}`}
          onClick={() => setMode('night')}
        >
          夜勤読込
        </button>
        <button
          className={`import-mode-tab ${mode === 'event' ? 'active' : ''}`}
          onClick={() => setMode('event')}
        >
          イベント
        </button>
      </div>

      {mode === 'day' && <DayShiftInput />}
      {mode === 'night' && <NightShiftImport />}
      {mode === 'event' && <EventImport />}
    </div>
  );
}

// ========================================
// 日勤一括入力コンポーネント
// ========================================
function DayShiftInput() {
  const today = getToday();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const daysInMonth = getDaysInMonth(year, month);

  // プリセット生成: 月火水金=全日、木=午前、土=午前、日=休み
  const generatePreset = (): DayShiftRow[] => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      const dow = new Date(year, month - 1, d).getDay();
      let shift: DayShiftOption = 'none';
      if (dow === 0) shift = 'off';           // 日曜=休み
      else if (dow === 4) shift = 'eye_am';   // 木=午前
      else if (dow === 6) shift = 'eye_am';   // 土=午前
      else shift = 'eye_full';                // 月火水金=全日
      return { day: d, dow, shift };
    });
  };

  const [rows, setRows] = useState<DayShiftRow[]>(generatePreset());

  // 月変更時にプリセット再生成
  const handleMonthChange = (newYear: number, newMonth: number) => {
    setYear(newYear);
    setMonth(newMonth);
    const days = getDaysInMonth(newYear, newMonth);
    setRows(Array.from({ length: days }, (_, i) => {
      const d = i + 1;
      const dow = new Date(newYear, newMonth - 1, d).getDay();
      let shift: DayShiftOption = 'none';
      if (dow === 0) shift = 'off';
      else if (dow === 4) shift = 'eye_am';
      else if (dow === 6) shift = 'eye_am';
      else shift = 'eye_full';
      return { day: d, dow, shift };
    }));
  };

  const prevMonth = () => {
    if (month === 1) handleMonthChange(year - 1, 12);
    else handleMonthChange(year, month - 1);
  };

  const nextMonth = () => {
    if (month === 12) handleMonthChange(year + 1, 1);
    else handleMonthChange(year, month + 1);
  };

  const updateRow = (index: number, shift: DayShiftOption) => {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, shift } : r));
  };

  const applyDayShifts = () => {
    let count = 0;
    rows.forEach(row => {
      const dateStr = formatDate(year, month, row.day);
      const day = getDay(dateStr);

      if (row.shift === 'off') {
        day.isOff = true;
        day.dayShift = null;
      } else if (row.shift === 'eye_full' || row.shift === 'eye_am') {
        day.dayShift = 'eye';
        day.isOff = false;
      } else if (row.shift === 'facility') {
        day.dayShift = 'facility';
        day.isOff = false;
      } else {
        day.dayShift = null;
        day.isOff = false;
      }

      saveDay(day);
      count++;
    });

    alert(`${count}日分の日勤シフトを反映しました`);
  };

  const shiftOptions: { value: DayShiftOption; label: string; color: string }[] = [
    { value: 'eye_full', label: '眼科(全日)', color: '#E91E63' },
    { value: 'eye_am', label: '眼科(午前)', color: '#E91E63' },
    { value: 'facility', label: '施設', color: '#4CAF50' },
    { value: 'off', label: '休み', color: '#9E9E9E' },
    { value: 'none', label: 'なし', color: '#ccc' },
  ];

  return (
    <div>
      {/* 月選択 */}
      <div className="import-month-nav">
        <button onClick={prevMonth}>◀</button>
        <span>{year}年 {month}月</span>
        <button onClick={nextMonth}>▶</button>
      </div>

      <p className="import-desc">眼科プリセット: 月火水金=全日、木土=午前、日=休み</p>

      {/* 一括入力テーブル */}
      <div className="import-preview">
        <table className="import-table">
          <thead>
            <tr>
              <th>日</th>
              <th>曜日</th>
              <th>シフト</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const currentOpt = shiftOptions.find(o => o.value === row.shift);
              return (
                <tr key={row.day} style={{ background: row.dow === 0 ? '#fff5f5' : row.dow === 6 ? '#f5f8ff' : undefined }}>
                  <td style={{ fontWeight: 600 }}>{row.day}</td>
                  <td style={{ color: row.dow === 0 ? '#E91E63' : row.dow === 6 ? '#2196F3' : '#333' }}>
                    {WEEKDAY_LABELS[row.dow]}
                  </td>
                  <td>
                    <select
                      value={row.shift}
                      onChange={e => updateRow(i, e.target.value as DayShiftOption)}
                      className="import-select"
                      style={{ color: currentOpt?.color, fontWeight: 600 }}
                    >
                      {shiftOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="import-actions">
        <button className="import-apply-btn" onClick={applyDayShifts}>カレンダーに反映</button>
      </div>
    </div>
  );
}

// ========================================
// 夜勤読込コンポーネント（画像OCR + 手動修正）
// ========================================
function NightShiftImport() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [editShifts, setEditShifts] = useState<ParsedShift[]>([]);
  const [error, setError] = useState<string | null>(null);
  const gasUrl = 'https://script.google.com/macros/s/AKfycbyoz4fFLLQx0Ot2aM_94ut8eT9OU9a5eEN6urWNMR-LXlBLGefznSwSRIqq4N8Ityo7Fw/exec';
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const base64 = await fileToBase64(file);

      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ image: base64, mimeType: 'image/jpeg' }),
      });

      const text = await response.text();

      if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
        throw new Error('GASエラー。再度お試しください。');
      }

      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error);

      setResult(data);
      setEditShifts(data.shifts.map((s: ParsedShift) => ({ ...s })));
    } catch (err) {
      setError(err instanceof Error ? err.message : '読み取りに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const applyShifts = () => {
    if (!result) return;

    editShifts.forEach(shift => {
      const dateStr = `${result.year}-${String(result.month).padStart(2, '0')}-${String(shift.day).padStart(2, '0')}`;
      const day = getDay(dateStr);
      day.nightShift = shift.place;
      day.nightTime = shift.time;
      saveDay(day);
    });

    alert(`${editShifts.length}件のシフトを反映しました`);
    setResult(null);
    setEditShifts([]);
  };

  const updateShift = (index: number, field: keyof ParsedShift, value: unknown) => {
    setEditShifts(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const removeShift = (index: number) => {
    setEditShifts(prev => prev.filter((_, i) => i !== index));
  };

  const addShift = () => {
    setEditShifts(prev => [...prev, { day: 1, place: result?.facility as NightShiftPlace || 'kadoma', time: '20' as NightShiftTime }]);
  };

  const placeLabels: Record<string, string> = {
    katano: '交野',
    hirakata: '枚方',
    kadoma: '門真',
    moriguchi: '守口',
  };

  return (
    <div>
      <div className="import-section">
        <p className="import-desc">夜勤シフト表のスクリーンショットをアップロード。「四ツ橋」の行を自動で読み取ります。</p>

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
          <h3>{result.year}年{result.month}月 - {placeLabels[result.facility] || result.facility}</h3>
          <div className="import-preview">
            <table className="import-table">
              <thead>
                <tr>
                  <th>日</th>
                  <th>施設</th>
                  <th>時間</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {editShifts.map((s, i) => (
                  <tr key={i}>
                    <td>
                      <select value={s.day} onChange={e => updateShift(i, 'day', Number(e.target.value))} className="import-select">
                        {Array.from({ length: 31 }, (_, d) => (
                          <option key={d + 1} value={d + 1}>{d + 1}日</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select value={s.place || ''} onChange={e => updateShift(i, 'place', e.target.value || null)} className="import-select">
                        <option value="katano">交野</option>
                        <option value="hirakata">枚方</option>
                        <option value="kadoma">門真</option>
                        <option value="moriguchi">守口</option>
                      </select>
                    </td>
                    <td>
                      <select value={s.time || '20'} onChange={e => updateShift(i, 'time', e.target.value)} className="import-select">
                        <option value="17">17時〜</option>
                        <option value="20">20時〜</option>
                      </select>
                    </td>
                    <td>
                      <button className="import-remove-btn" onClick={() => removeShift(i)}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="import-add-btn" onClick={addShift}>＋ 行を追加</button>
          </div>
          <div className="import-actions">
            <button className="import-apply-btn" onClick={applyShifts}>カレンダーに反映</button>
            <button className="import-cancel-btn" onClick={() => { setResult(null); setEditShifts([]); }}>キャンセル</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ========================================
// イベント読込コンポーネント
// ========================================
interface EventItem {
  date: string;
  time: string;
  content: string;
}

function EventImport() {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const gasUrl = 'https://script.google.com/macros/s/AKfycbyoz4fFLLQx0Ot2aM_94ut8eT9OU9a5eEN6urWNMR-LXlBLGefznSwSRIqq4N8Ityo7Fw/exec';
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setEvents([]);

    try {
      const base64 = await fileToBase64(file);

      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ image: base64, mimeType: 'image/jpeg', action: 'event' }),
      });

      const text = await response.text();

      if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
        throw new Error('読み取りに失敗しました。再度お試しください。');
      }

      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error);

      if (data.events && data.events.length > 0) {
        setEvents(data.events);
      } else {
        setError('イベント情報を読み取れませんでした');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '読み取りに失敗しました');
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const updateEvent = (index: number, field: keyof EventItem, value: string) => {
    setEvents(prev => prev.map((ev, i) => i === index ? { ...ev, [field]: value } : ev));
  };

  const removeEvent = (index: number) => {
    setEvents(prev => prev.filter((_, i) => i !== index));
  };

  const applyEvents = () => {
    let count = 0;
    events.forEach(evt => {
      if (!evt.date || !evt.content) return;
      const day = getDay(evt.date);
      day.details = [...(day.details || []), {
        id: Date.now().toString() + '_' + count,
        time: evt.time,
        content: evt.content,
      }];
      saveDay(day);
      count++;
    });

    alert(`${count}件のイベントを登録しました`);
    setEvents([]);
  };

  return (
    <div>
      <div className="import-section">
        <p className="import-desc">イベントのチラシやスクショをアップロード。日付・時間・内容を自動で読み取りカレンダーに登録します。</p>

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

      {events.length > 0 && (
        <div className="import-result">
          <h3>読み取り結果</h3>
          <div className="import-preview">
            <table className="import-table">
              <thead>
                <tr>
                  <th>日付</th>
                  <th>時間</th>
                  <th>内容</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {events.map((evt, i) => (
                  <tr key={i}>
                    <td>
                      <input
                        type="date"
                        value={evt.date}
                        onChange={e => updateEvent(i, 'date', e.target.value)}
                        className="import-select"
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        value={evt.time}
                        onChange={e => updateEvent(i, 'time', e.target.value)}
                        className="import-select"
                        style={{ width: '80px' }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={evt.content}
                        onChange={e => updateEvent(i, 'content', e.target.value)}
                        className="import-select"
                      />
                    </td>
                    <td>
                      <button className="import-remove-btn" onClick={() => removeEvent(i)}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="import-actions">
            <button className="import-apply-btn" onClick={applyEvents}>カレンダーに反映</button>
            <button className="import-cancel-btn" onClick={() => setEvents([])}>キャンセル</button>
          </div>
        </div>
      )}
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxSize = 1600;
      let w = img.width;
      let h = img.height;

      if (w > maxSize || h > maxSize) {
        if (w > h) {
          h = Math.round(h * maxSize / w);
          w = maxSize;
        } else {
          w = Math.round(w * maxSize / h);
          h = maxSize;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      resolve(dataUrl.split(',')[1]);
    };
    img.onerror = reject;

    const reader = new FileReader();
    reader.onload = () => { img.src = reader.result as string; };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
