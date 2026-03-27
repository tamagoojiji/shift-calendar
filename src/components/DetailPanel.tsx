import { useState } from 'react';
import type { DayData, DetailItem } from '../types';
import { SHIFT_COLORS, SHIFT_LABELS } from '../types';
import { saveDay } from '../utils/storage';
import { WEEKDAY_LABELS } from '../utils/dateUtils';

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
        <button className="detail-add-btn" onClick={() => setAdding(true)}>＋</button>
      </div>

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
