import { useState, useRef, useCallback } from 'react';
import type { DayData, DetailItem } from '../types';
import { SHIFT_COLORS, SHIFT_LABELS } from '../types';
import { saveDay, getDay } from '../utils/storage';
import { WEEKDAY_LABELS } from '../utils/dateUtils';
import { analyzeEventImage, getGeminiApiKey } from '../utils/gemini';

interface Props {
  dateStr: string;
  day: DayData;
  onUpdate: () => void;
  onEditShift: () => void;
}

export default function DetailPanel({ dateStr, day, onUpdate, onEditShift }: Props) {
  const [adding, setAdding] = useState(false);
  const [newTime, setNewTime] = useState('');
  const [newContent, setNewContent] = useState('');
  const [useRange, setUseRange] = useState(false);
  const [rangeEnd, setRangeEnd] = useState('');
  const [repeatType, setRepeatType] = useState<'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editTime, setEditTime] = useState('');
  const [editContent, setEditContent] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);

  const handleCompositionStart = useCallback(() => { composingRef.current = true; }, []);
  const handleCompositionEnd = useCallback(() => { composingRef.current = false; }, []);

  const dateNum = parseInt(dateStr.slice(8));
  const dow = new Date(dateStr).getDay();
  const dayLabel = WEEKDAY_LABELS[dow];

  const addDetail = () => {
    if (!newContent.trim()) return;
    const content = newContent.trim();
    const time = newTime;

    if (useRange && rangeEnd && rangeEnd >= dateStr) {
      const start = new Date(dateStr);
      const end = new Date(rangeEnd);
      let count = 0;

      const addToDate = (ds: string) => {
        const targetDay = ds === dateStr ? day : getDay(ds);
        const item: DetailItem = {
          id: Date.now().toString() + '_' + count,
          time,
          content,
        };
        targetDay.details = [...(targetDay.details || []), item];
        saveDay(targetDay);
        count++;
      };

      if (repeatType === 'daily') {
        // 毎日
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          addToDate(d.toISOString().slice(0, 10));
        }
      } else if (repeatType === 'weekly') {
        // 毎週（同じ曜日）
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
          addToDate(d.toISOString().slice(0, 10));
        }
      } else if (repeatType === 'monthly') {
        // 毎月（同じ日付）
        const dayOfMonth = start.getDate();
        for (let d = new Date(start); d <= end; ) {
          addToDate(d.toISOString().slice(0, 10));
          d.setMonth(d.getMonth() + 1);
          d.setDate(dayOfMonth);
        }
      } else if (repeatType === 'yearly') {
        // 毎年（同じ月日）
        for (let d = new Date(start); d <= end; ) {
          addToDate(d.toISOString().slice(0, 10));
          d.setFullYear(d.getFullYear() + 1);
        }
      }
    } else {
      // 単日
      const item: DetailItem = {
        id: Date.now().toString(),
        time,
        content,
      };
      day.details = [...(day.details || []), item];
      saveDay(day);
    }

    setAdding(false);
    setNewTime('');
    setNewContent('');
    setUseRange(false);
    setRangeEnd('');
    setRepeatType('daily');
    onUpdate();
  };

  const removeDetail = (id: string) => {
    day.details = (day.details || []).filter(d => d.id !== id);
    saveDay(day);
    onUpdate();
  };

  const startEditDetail = (item: DetailItem) => {
    setEditingItemId(item.id);
    setEditTime(item.time);
    setEditContent(item.content);
  };

  const saveEditDetail = () => {
    if (!editingItemId || !editContent.trim()) return;
    day.details = (day.details || []).map(d =>
      d.id === editingItemId ? { ...d, time: editTime, content: editContent.trim() } : d
    );
    saveDay(day);
    setEditingItemId(null);
    onUpdate();
  };

  // 画像からイベント読込
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportError(null);

    try {
      const apiKey = getGeminiApiKey();

      const base64 = await fileToBase64(file);
      const data = await analyzeEventImage(apiKey, base64, file.type);

      const events: { date: string; time: string; content: string }[] = data.events || [];
      let addedCount = 0;

      events.forEach((evt: { date: string; time: string; content: string }) => {
        const targetDate = evt.date || dateStr;
        const targetDay = getDay(targetDate);
        const item: DetailItem = {
          id: Date.now().toString() + '_' + addedCount,
          time: evt.time || '',
          content: evt.content || '',
        };
        targetDay.details = [...(targetDay.details || []), item];
        saveDay(targetDay);
        addedCount++;
      });

      if (addedCount > 0) {
        alert(`${addedCount}件のイベントを登録しました`);
        onUpdate();
      } else {
        setImportError('イベント情報を読み取れませんでした');
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : '読み取りに失敗しました');
    } finally {
      setImporting(false);
      if (imageRef.current) imageRef.current.value = '';
    }
  };

  // シフトサマリー
  const shiftSummary = [];
  if (day.isOff) {
    shiftSummary.push({ label: '休み', color: SHIFT_COLORS.off });
  } else {
    if (day.dayShift) {
      shiftSummary.push({ label: SHIFT_LABELS[day.dayShift], color: SHIFT_COLORS[day.dayShift] });
    }
    if (day.nightShift) {
      const timeLabel = day.nightTime === '17' ? '17:00〜' : '20:00〜';
      shiftSummary.push({ label: `${SHIFT_LABELS[day.nightShift]} ${timeLabel}`, color: SHIFT_COLORS[day.nightShift] });
    }
  }

  const sortedDetails = [...(day.details || [])].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <span className="detail-date">{dateNum}日({dayLabel})</span>
        <button className="detail-img-btn" onClick={() => imageRef.current?.click()}>
          {importing ? '読取中...' : '📷'}
        </button>
        <button className="detail-add-btn" onClick={() => setAdding(true)}>＋</button>
        <input
          ref={imageRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          hidden
        />
      </div>

      {importError && (
        <div className="detail-import-error">{importError}</div>
      )}

      {/* シフト表示（タップで編集） */}
      {shiftSummary.length > 0 ? (
        <div className="detail-shift-tap" onClick={onEditShift}>
          {shiftSummary.map((s, i) => (
            <div key={i} className="detail-shift-item" style={{ borderLeftColor: s.color }}>
              {s.label}
            </div>
          ))}
        </div>
      ) : (
        <div className="detail-shift-empty" onClick={onEditShift}>
          タップしてシフトを入力
        </div>
      )}

      {/* 詳細一覧（タップで編集） */}
      {sortedDetails.map(item => (
        editingItemId === item.id ? (
          <div key={item.id} className="detail-add-form">
            <input
              type="time"
              value={editTime}
              onChange={e => setEditTime(e.target.value)}
              className="detail-input-time"
            />
            <input
              type="text"
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              className="detail-input-content"
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              onKeyDown={e => { if (e.key === 'Enter' && !composingRef.current) saveEditDetail(); }}
              autoFocus
            />
            <button className="detail-save-btn" onClick={saveEditDetail}>保存</button>
            <button className="detail-cancel-btn" onClick={() => setEditingItemId(null)}>取消</button>
            <button className="detail-item-delete" onClick={() => { removeDetail(item.id); setEditingItemId(null); }}>削除</button>
          </div>
        ) : (
          <div key={item.id} className="detail-item" onClick={() => startEditDetail(item)}>
            <div className="detail-item-time">{item.time || '--:--'}</div>
            <div className="detail-item-content">{item.content}</div>
          </div>
        )
      ))}

      {/* 追加フォーム */}
      {adding && (
        <div className="detail-add-form">
          <input
            type="time"
            value={newTime}
            onChange={e => setNewTime(e.target.value)}
            className="detail-input-time"
          />
          <input
            type="text"
            placeholder="予定内容"
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            className="detail-input-content"
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            onKeyDown={e => { if (e.key === 'Enter' && !composingRef.current) addDetail(); }}
          />
          <div className="detail-range-row">
            <label className="detail-range-toggle">
              <input
                type="checkbox"
                checked={useRange}
                onChange={e => { setUseRange(e.target.checked); if (!e.target.checked) { setRangeEnd(''); setRepeatType('daily'); } }}
              />
              <span>期間指定</span>
            </label>
            {useRange && (
              <>
                <div className="detail-repeat-btns">
                  {([['daily', '毎日'], ['weekly', '毎週'], ['monthly', '毎月'], ['yearly', '毎年']] as const).map(([val, label]) => (
                    <button
                      key={val}
                      className={`detail-repeat-btn ${repeatType === val ? 'active' : ''}`}
                      onClick={() => setRepeatType(val)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="detail-range-dates">
                  <span className="detail-range-label">{dateStr.slice(5).replace('-', '/')}</span>
                  <span>〜</span>
                  <input
                    type="date"
                    value={rangeEnd}
                    min={dateStr}
                    onChange={e => setRangeEnd(e.target.value)}
                    className="detail-input-date"
                  />
                </div>
              </>
            )}
          </div>
          <button className="detail-save-btn" onClick={addDetail}>保存</button>
          <button className="detail-cancel-btn" onClick={() => { setAdding(false); setUseRange(false); setRangeEnd(''); setRepeatType('daily'); }}>取消</button>
        </div>
      )}
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
