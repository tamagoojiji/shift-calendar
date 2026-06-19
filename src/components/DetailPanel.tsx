import { useState, useRef, useCallback } from 'react';
import type { DayData, DetailItem } from '../types';
import { SHIFT_COLORS, SHIFT_LABELS } from '../types';
import { saveDay, getDay, addDeletedEvent } from '../utils/storage';
import { WEEKDAY_LABELS } from '../utils/dateUtils';
import { setReminder, removeReminder, hasReminder, getReminder, requestNotificationPermission, TIMING_LABELS } from '../utils/reminder';
import type { ReminderTiming } from '../utils/reminder';
import TimeField from './TimeField';

interface Props {
  dateStr: string;
  day: DayData;
  onUpdate: () => void;
  onEditShift: () => void;
  onAddEvent: () => void;
}

export default function DetailPanel({ dateStr, day, onUpdate, onEditShift, onAddEvent }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editTime, setEditTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editUseRange, setEditUseRange] = useState(false);
  const [editRangeEnd, setEditRangeEnd] = useState('');
  const [editRepeatType, setEditRepeatType] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [reminderItemId, setReminderItemId] = useState<string | null>(null);
  const composingRef = useRef(false);

  const handleCompositionStart = useCallback(() => { composingRef.current = true; }, []);
  const handleCompositionEnd = useCallback(() => { composingRef.current = false; }, []);

  const dateNum = parseInt(dateStr.slice(8));
  const dow = new Date(dateStr).getDay();
  const dayLabel = WEEKDAY_LABELS[dow];

  const removeDetail = (id: string) => {
    if (!confirm('削除しますか？')) return;
    const target = (day.details || []).find(d => d.id === id);
    if (target) addDeletedEvent(target, dateStr, 'personal');
    day.details = (day.details || []).filter(d => d.id !== id);
    saveDay(day);
    onUpdate();
  };

  const startEditDetail = (item: DetailItem) => {
    setEditingItemId(item.id);
    setEditTime(item.time);
    setEditEndTime(item.endTime || '');
    setEditContent(item.content);
    setEditUrl(item.url || '');
    setEditUseRange(false);
    setEditRangeEnd('');
    setEditRepeatType('daily');
  };

  const saveEditDetail = () => {
    if (!editingItemId || !editContent.trim()) return;
    const content = editContent.trim();
    const time = editTime;
    // 開始時間がない（終日）なら終了時間は保持しない
    const endTime = time && editEndTime ? editEndTime : undefined;

    const url = editUrl.trim() || undefined;
    day.details = (day.details || []).map(d =>
      d.id === editingItemId ? { ...d, time, endTime, content, url } : d
    );
    saveDay(day);

    // 既存リマインダーを編集後の状態に同期（終日化したら削除、時刻/内容変更は反映）
    const existingReminder = getReminder(editingItemId, dateStr);
    if (existingReminder) {
      if (time) {
        setReminder(editingItemId, dateStr, time, content, existingReminder.timings);
      } else {
        removeReminder(editingItemId, dateStr);
      }
    }

    if (editUseRange && editRangeEnd && editRangeEnd >= dateStr) {
      const start = new Date(dateStr);
      const end = new Date(editRangeEnd);
      let count = 0;

      const addToDate = (ds: string) => {
        if (ds === dateStr) return;
        const targetDay = getDay(ds);
        const item: DetailItem = {
          id: Date.now().toString() + '_e' + count,
          time,
          ...(endTime && { endTime }),
          content,
          ...(url && { url }),
        };
        targetDay.details = [...(targetDay.details || []), item];
        saveDay(targetDay);
        count++;
      };

      if (editRepeatType === 'daily') {
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          addToDate(d.toISOString().slice(0, 10));
        }
      } else if (editRepeatType === 'weekly') {
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
          addToDate(d.toISOString().slice(0, 10));
        }
      } else if (editRepeatType === 'monthly') {
        const dayOfMonth = start.getDate();
        for (let d = new Date(start); d <= end; ) {
          addToDate(d.toISOString().slice(0, 10));
          d.setMonth(d.getMonth() + 1);
          d.setDate(dayOfMonth);
        }
      } else if (editRepeatType === 'yearly') {
        for (let d = new Date(start); d <= end; ) {
          addToDate(d.toISOString().slice(0, 10));
          d.setFullYear(d.getFullYear() + 1);
        }
      }
    }

    setEditingItemId(null);
    setEditEndTime('');
    setEditUseRange(false);
    setEditRangeEnd('');
    setEditRepeatType('daily');
    onUpdate();
  };

  // シフトサマリー（常に2ブロック: 日勤 | 夜勤）
  const shiftSummary: { label: string; color: string }[] = [];
  if (day.isOff) {
    shiftSummary.push({ label: '休み', color: SHIFT_COLORS.off });
    shiftSummary.push({ label: '', color: 'transparent' });
  } else {
    if (day.dayShift) {
      shiftSummary.push({ label: SHIFT_LABELS[day.dayShift], color: SHIFT_COLORS[day.dayShift] });
    } else {
      shiftSummary.push({ label: '', color: 'transparent' });
    }
    if (day.nightShift) {
      const timeLabel = day.nightTime === '17' ? '17:00〜' : '20:00〜';
      shiftSummary.push({ label: `${SHIFT_LABELS[day.nightShift]} ${timeLabel}`, color: SHIFT_COLORS[day.nightShift] });
    } else {
      shiftSummary.push({ label: '', color: 'transparent' });
    }
  }

  const sortedDetails = [...(day.details || [])].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <span className="detail-date">{dateNum}日({dayLabel})</span>
        <button className="detail-add-btn" onClick={onAddEvent}>＋</button>
      </div>

      {/* シフト表示（タップで編集） */}
      {shiftSummary.length > 0 ? (
        <div className="detail-shift-tap detail-shift-row" onClick={onEditShift}>
          {shiftSummary.map((s, i) => (
            <div key={i} className={`detail-shift-item ${!s.label ? 'detail-shift-empty-block' : ''}`} style={{ borderLeftColor: s.color }}>
              {s.label || '\u00A0'}
            </div>
          ))}
        </div>
      ) : (
        <div className="detail-shift-empty" onClick={onEditShift}>
          タップしてシフトを入力
        </div>
      )}

      {/* 詳細一覧（タップで編集） */}
      {(showAll ? sortedDetails : sortedDetails.slice(0, 3)).map(item => (
        editingItemId === item.id ? (
          <div key={item.id} className="detail-add-form">
            <div className="detail-time-row">
              <div className="detail-time-field">
                <label className="detail-time-label">開始</label>
                <TimeField value={editTime} onChange={setEditTime} placeholder="時間を入力" />
              </div>
              <div className="detail-time-field">
                <label className="detail-time-label">終了</label>
                <TimeField value={editEndTime} onChange={setEditEndTime} placeholder="時間を入力" />
              </div>
            </div>
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
            <input
              type="url"
              placeholder="URL（任意）"
              value={editUrl}
              onChange={e => setEditUrl(e.target.value)}
              className="detail-input-url"
            />
            <div className="detail-range-row">
              <label className="detail-range-toggle">
                <input
                  type="checkbox"
                  checked={editUseRange}
                  onChange={e => { setEditUseRange(e.target.checked); if (!e.target.checked) { setEditRangeEnd(''); setEditRepeatType('daily'); } }}
                />
                <span>期間指定</span>
              </label>
              {editUseRange && (
                <>
                  <div className="detail-repeat-btns">
                    {([['daily', '毎日'], ['weekly', '毎週'], ['monthly', '毎月'], ['yearly', '毎年']] as const).map(([val, label]) => (
                      <button
                        key={val}
                        className={`detail-repeat-btn ${editRepeatType === val ? 'active' : ''}`}
                        onClick={() => setEditRepeatType(val)}
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
                      value={editRangeEnd}
                      min={dateStr}
                      onChange={e => setEditRangeEnd(e.target.value)}
                      className="detail-input-date"
                    />
                  </div>
                </>
              )}
            </div>
            <button className="detail-save-btn" onClick={saveEditDetail}>保存</button>
            <button className="detail-cancel-btn" onClick={() => { setEditingItemId(null); setEditEndTime(''); setEditUseRange(false); setEditRangeEnd(''); setEditRepeatType('daily'); }}>取消</button>
            <button className="detail-item-delete" onClick={() => { removeDetail(item.id); setEditingItemId(null); }}>削除</button>
          </div>
        ) : (
          <div key={item.id}>
            <div className="detail-item">
              <div className="detail-item-time" onClick={() => startEditDetail(item)}>{item.time || '終日'}</div>
              <div className="detail-item-content" onClick={() => startEditDetail(item)}>{item.content}</div>
              {item.time && (
                <button
                  className={`detail-reminder-btn ${hasReminder(item.id, dateStr) ? 'active' : ''}`}
                  onClick={() => setReminderItemId(reminderItemId === item.id ? null : item.id)}
                >
                  {hasReminder(item.id, dateStr) ? '🔔' : '🔕'}
                </button>
              )}
            </div>
            {item.url && (
              <a className="detail-item-url" href={item.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                🔗 {item.url.replace(/^https?:\/\//, '').slice(0, 40)}{item.url.replace(/^https?:\/\//, '').length > 40 ? '...' : ''}
              </a>
            )}
            {reminderItemId === item.id && item.time && (
              <ReminderTimingPicker
                eventId={item.id}
                date={dateStr}
                time={item.time}
                content={item.content}
                onUpdate={onUpdate}
              />
            )}
          </div>
        )
      ))}
      {!showAll && sortedDetails.length > 3 && (
        <div className="detail-more-count" onClick={() => setShowAll(true)}>他 {sortedDetails.length - 3}件 ▼</div>
      )}
      {showAll && sortedDetails.length > 3 && (
        <div className="detail-more-count" onClick={() => setShowAll(false)}>閉じる ▲</div>
      )}
    </div>
  );
}

function ReminderTimingPicker({ eventId, date, time, content, onUpdate }: {
  eventId: string;
  date: string;
  time: string;
  content: string;
  onUpdate: () => void;
}) {
  const existing = getReminder(eventId, date);
  const currentTimings = existing?.timings || [];

  const toggle = async (timing: ReminderTiming) => {
    const ok = await requestNotificationPermission();
    if (!ok) {
      alert('通知を許可してください');
      return;
    }
    const newTimings = currentTimings.includes(timing)
      ? currentTimings.filter(t => t !== timing)
      : [...currentTimings, timing];

    if (newTimings.length === 0) {
      removeReminder(eventId, date);
    } else {
      setReminder(eventId, date, time, content, newTimings);
    }
    onUpdate();
  };

  return (
    <div className="reminder-timing-picker">
      {(Object.entries(TIMING_LABELS) as [ReminderTiming, string][]).map(([key, label]) => (
        <label key={key} className="reminder-timing-item">
          <input
            type="checkbox"
            checked={currentTimings.includes(key)}
            onChange={() => toggle(key)}
          />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}
