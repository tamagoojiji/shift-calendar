import { useState, useRef } from 'react';
import type { DayData, DetailItem } from '../types';
import { SHIFT_COLORS, SHIFT_LABELS } from '../types';
import { saveDay, getDay } from '../utils/storage';
import { WEEKDAY_LABELS } from '../utils/dateUtils';
import { analyzeEventImage } from '../utils/gemini';

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
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  const dateNum = parseInt(dateStr.slice(8));
  const dow = new Date(dateStr).getDay();
  const dayLabel = WEEKDAY_LABELS[dow];

  const addDetail = () => {
    if (!newContent.trim()) return;
    const item: DetailItem = {
      id: Date.now().toString(),
      time: newTime,
      content: newContent.trim(),
    };
    day.details = [...(day.details || []), item];
    saveDay(day);
    setAdding(false);
    setNewTime('');
    setNewContent('');
    onUpdate();
  };

  const removeDetail = (id: string) => {
    day.details = (day.details || []).filter(d => d.id !== id);
    saveDay(day);
    onUpdate();
  };

  // 画像からイベント読込
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportError(null);

    try {
      const apiKey = localStorage.getItem('shift_gemini_key') || '';
      if (!apiKey) {
        throw new Error('設定タブでGemini APIキーを設定してください');
      }

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
        <button className="detail-edit-btn" onClick={onEditShift}>シフト編集</button>
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

      {/* シフト表示 */}
      {shiftSummary.map((s, i) => (
        <div key={i} className="detail-shift-item" style={{ borderLeftColor: s.color }}>
          {s.label}
        </div>
      ))}

      {/* 詳細一覧 */}
      {sortedDetails.map(item => (
        <div key={item.id} className="detail-item">
          <div className="detail-item-time">{item.time || '--:--'}</div>
          <div className="detail-item-content">{item.content}</div>
          <button className="detail-item-delete" onClick={() => removeDetail(item.id)}>×</button>
        </div>
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
            onKeyDown={e => e.key === 'Enter' && addDetail()}
          />
          <button className="detail-save-btn" onClick={addDetail}>保存</button>
          <button className="detail-cancel-btn" onClick={() => setAdding(false)}>取消</button>
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
