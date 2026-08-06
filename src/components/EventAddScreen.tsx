import { useState, useRef, useCallback } from 'react';
import type { DetailItem } from '../types';
import { FRIEND_EVENT_COLORS } from '../types';
import { getDay, saveDay, getFriendDayEvents, saveFriendDayEvents } from '../utils/storage';
import { analyzeEventImage } from '../utils/gemini';
import { setReminder, requestNotificationPermission, TIMING_LABELS } from '../utils/reminder';
import type { ReminderTiming } from '../utils/reminder';
import TimeField from './TimeField';

interface Props {
  dateStr: string;
  onSave: () => void;
  onClose: () => void;
  target?: 'personal' | 'friend';
}

interface PendingEvent {
  id: string;
  date: string;
  time: string;
  content: string;
  url: string;
  checked: boolean;
}

export default function EventAddScreen({ dateStr, onSave, onClose, target = 'personal' }: Props) {
  const [date, setDate] = useState(dateStr);
  const [time, setTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [color, setColor] = useState(FRIEND_EVENT_COLORS[0]);
  const [rangeEnd, setRangeEnd] = useState('');
  const [repeatType, setRepeatType] = useState<'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('none');
  const [reminderTimings, setReminderTimings] = useState<ReminderTiming[]>([]);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingEvents, setPendingEvents] = useState<PendingEvent[] | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);

  const handleCompositionStart = useCallback(() => { composingRef.current = true; }, []);
  const handleCompositionEnd = useCallback(() => { composingRef.current = false; }, []);

  const toggleReminderTiming = async (timing: ReminderTiming) => {
    if (!reminderTimings.includes(timing)) {
      const ok = await requestNotificationPermission();
      if (!ok) {
        alert('通知を許可してください');
        return;
      }
      setReminderTimings([...reminderTimings, timing]);
    } else {
      setReminderTimings(reminderTimings.filter(t => t !== timing));
    }
  };

  // 保存先の切り替え（個人カレンダー / 友達の予定）
  const addItemToDate = (ds: string, item: DetailItem) => {
    if (target === 'friend') {
      saveFriendDayEvents(ds, [...getFriendDayEvents(ds), item]);
    } else {
      const targetDay = getDay(ds);
      targetDay.details = [...(targetDay.details || []), item];
      saveDay(targetDay);
    }
  };

  const handleSave = () => {
    if (!content.trim()) return;
    const trimContent = content.trim();
    const trimUrl = url.trim() || undefined;

    if (repeatType !== 'none' && rangeEnd && rangeEnd >= date) {
      const start = new Date(date);
      const end = new Date(rangeEnd);
      let count = 0;

      const addToDate = (ds: string) => {
        const item: DetailItem = {
          id: Date.now().toString() + '_' + count,
          time,
          ...(time && endTime && { endTime }),
          content: trimContent,
          ...(trimUrl && { url: trimUrl }),
          ...(target === 'friend' && { color }),
        };
        addItemToDate(ds, item);
        // 友達の予定はアラーム対象外
        if (target !== 'friend' && time && reminderTimings.length > 0) {
          setReminder(item.id, ds, time, trimContent, reminderTimings);
        }
        count++;
      };

      if (repeatType === 'daily') {
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          addToDate(d.toISOString().slice(0, 10));
        }
      } else if (repeatType === 'weekly') {
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
          addToDate(d.toISOString().slice(0, 10));
        }
      } else if (repeatType === 'monthly') {
        const dayOfMonth = start.getDate();
        for (let d = new Date(start); d <= end; ) {
          addToDate(d.toISOString().slice(0, 10));
          d.setMonth(d.getMonth() + 1);
          d.setDate(dayOfMonth);
        }
      } else if (repeatType === 'yearly') {
        for (let d = new Date(start); d <= end; ) {
          addToDate(d.toISOString().slice(0, 10));
          d.setFullYear(d.getFullYear() + 1);
        }
      }
    } else {
      const item: DetailItem = {
        id: Date.now().toString(),
        time,
        ...(time && endTime && { endTime }),
        content: trimContent,
        ...(trimUrl && { url: trimUrl }),
        ...(target === 'friend' && { color }),
      };
      addItemToDate(date, item);
      // 友達の予定はアラーム対象外
      if (target !== 'friend' && time && reminderTimings.length > 0) {
        setReminder(item.id, date, time, trimContent, reminderTimings);
      }
    }

    onSave();
  };

  const updatePending = (id: string, patch: Partial<PendingEvent>) => {
    setPendingEvents(prev => prev?.map(p => p.id === id ? { ...p, ...patch } : p) ?? null);
  };

  const handleBulkRegister = () => {
    if (!pendingEvents) return;
    const targets = pendingEvents.filter(p => p.checked && p.content.trim());
    if (targets.length === 0) {
      alert('登録する予定を選択してください');
      return;
    }
    targets.forEach((evt, i) => {
      const item: DetailItem = {
        id: Date.now().toString() + '_b' + i,
        time: evt.time,
        content: evt.content.trim(),
        ...(evt.url.trim() && { url: evt.url.trim() }),
        ...(target === 'friend' && { color }),
      };
      addItemToDate(evt.date, item);
    });
    setPendingEvents(null);
    onSave();
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportError(null);

    try {
      const base64 = await fileToBase64(file);
      const data = await analyzeEventImage(base64, file.type);
      const events: { date: string; time: string; content: string; url: string }[] = data.events || [];

      if (events.length === 0) {
        setImportError('イベント情報を読み取れませんでした');
        return;
      }

      setPendingEvents(events.map((evt, i) => ({
        id: 'p_' + Date.now() + '_' + i,
        date: evt.date || dateStr,
        time: evt.time || '',
        content: evt.content || '',
        url: evt.url || '',
        checked: true,
      })));
    } catch (err) {
      setImportError(err instanceof Error ? err.message : '読み取りに失敗しました');
    } finally {
      setImporting(false);
      if (imageRef.current) imageRef.current.value = '';
    }
  };

  if (pendingEvents) {
    const checkedCount = pendingEvents.filter(p => p.checked).length;
    return (
      <div className="event-add-screen">
        <div className="event-add-header">
          <button className="event-add-back" onClick={() => setPendingEvents(null)}>← 戻る</button>
          <span className="event-add-title">読み取り結果の確認</span>
        </div>
        <div className="event-add-body">
          <div className="pending-events-summary">
            {pendingEvents.length}件読み取りました。登録する予定にチェックを入れてください。
          </div>
          {pendingEvents.map(p => (
            <div key={p.id} className={`pending-event-row ${p.checked ? '' : 'unchecked'}`}>
              <label className="pending-event-check">
                <input
                  type="checkbox"
                  checked={p.checked}
                  onChange={e => updatePending(p.id, { checked: e.target.checked })}
                />
              </label>
              <div className="pending-event-fields">
                <div className="pending-event-row-inline">
                  <input
                    type="date"
                    value={p.date}
                    onChange={e => updatePending(p.id, { date: e.target.value })}
                    className="detail-input-date"
                  />
                  <input
                    type="time"
                    value={p.time}
                    onChange={e => updatePending(p.id, { time: e.target.value })}
                    className="detail-input-time"
                  />
                </div>
                <input
                  type="text"
                  value={p.content}
                  onChange={e => updatePending(p.id, { content: e.target.value })}
                  placeholder="予定内容"
                  className="detail-input-content"
                />
                <input
                  type="url"
                  value={p.url}
                  onChange={e => updatePending(p.id, { url: e.target.value })}
                  placeholder="URL（任意）"
                  className="detail-input-url"
                />
              </div>
            </div>
          ))}
          <button
            className="detail-save-btn"
            style={{ width: '100%', marginTop: 8 }}
            onClick={handleBulkRegister}
            disabled={checkedCount === 0}
          >
            選択した{checkedCount}件を登録
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="event-add-screen">
      <div className="event-add-header">
        <button className="event-add-back" onClick={onClose}>← 戻る</button>
        <span className="event-add-title">予定を追加</span>
      </div>

      <div className="event-add-body">
        {/* 日付 */}
        <div className="event-add-field">
          <label className="event-add-label">📅 日付</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="detail-input-date"
          />
        </div>

        {/* 開始時間 + 終了時間 横並び（未入力なら終日） */}
        <div className="event-add-date-time-row">
          <div className="event-add-field">
            <label className="event-add-label">🕐 開始時間</label>
            <TimeField value={time} onChange={setTime} placeholder="時間を入力" />
          </div>
          <div className="event-add-field">
            <label className="event-add-label">🕐 終了時間</label>
            <TimeField value={endTime} onChange={setEndTime} placeholder="時間を入力" />
          </div>
        </div>

        {/* 内容 */}
        <div className="event-add-field">
          <label className="event-add-label">予定内容</label>
          <input
            type="text"
            placeholder="予定内容を入力"
            value={content}
            onChange={e => setContent(e.target.value)}
            className="detail-input-content"
            style={{ width: '100%', minWidth: 0 }}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            onKeyDown={e => { if (e.key === 'Enter' && !composingRef.current) handleSave(); }}
            autoFocus
          />
        </div>

        {/* カラー（友達の予定のみ） */}
        {target === 'friend' && (
          <div className="event-add-field">
            <label className="event-add-label">カラー</label>
            <div className="color-dot-row">
              {FRIEND_EVENT_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`color-dot ${color === c ? 'selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
        )}

        {/* アラーム（友達の予定では非表示） */}
        {time && target !== 'friend' && (
          <div className="event-add-field">
            <label className="event-add-label">🔔 アラーム</label>
            <div className="reminder-timing-picker">
              {(Object.entries(TIMING_LABELS) as [ReminderTiming, string][]).map(([key, label]) => (
                <label key={key} className="reminder-timing-item">
                  <input
                    type="checkbox"
                    checked={reminderTimings.includes(key)}
                    onChange={() => toggleReminderTiming(key)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* URL */}
        <div className="event-add-field">
          <label className="event-add-label">URL（任意）</label>
          <input
            type="url"
            placeholder="https://..."
            value={url}
            onChange={e => setUrl(e.target.value)}
            className="detail-input-url"
          />
        </div>

        {/* 画像OCR */}
        <button
          className="event-add-image-btn"
          onClick={() => imageRef.current?.click()}
          disabled={importing}
        >
          {importing ? '読取中...' : '📷 画像から読み取り'}
        </button>
        <input
          ref={imageRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          hidden
        />
        {importError && (
          <div className="detail-import-error">{importError}</div>
        )}

        {/* 期間指定 */}
        <div className="detail-range-row">
          <label className="event-add-label">期間指定</label>
          <div className="detail-repeat-btns">
            {([['none', 'なし'], ['daily', '毎日'], ['weekly', '毎週'], ['monthly', '毎月'], ['yearly', '毎年']] as const).map(([val, label]) => (
              <button
                key={val}
                className={`detail-repeat-btn ${repeatType === val ? 'active' : ''}`}
                onClick={() => { setRepeatType(val); if (val === 'none') setRangeEnd(''); }}
              >
                {label}
              </button>
            ))}
          </div>
          {repeatType !== 'none' && (
            <div className="detail-range-dates">
              <span className="detail-range-label">{date.slice(5).replace('-', '/')}</span>
              <span>〜</span>
              <input
                type="date"
                value={rangeEnd}
                min={date}
                onChange={e => setRangeEnd(e.target.value)}
                className="detail-input-date"
              />
            </div>
          )}
        </div>

        {/* 保存ボタン */}
        <button className="detail-save-btn" style={{ width: '100%', marginTop: 8 }} onClick={handleSave}>保存</button>
      </div>
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
