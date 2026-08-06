import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { DetailItem } from '../types';
import { FRIEND_EVENT_COLORS } from '../types';
import { getDaysInMonth, getFirstDayOfWeek, formatDate, getToday, WEEKDAY_LABELS } from '../utils/dateUtils';
import {
  loadFriendEvents, getFriendDayEvents, saveFriendDayEvents, getSavedMonth, saveCurrentMonth, addDeletedEvent,
  getFriendShareId, setFriendShareId, restoreToLocal, getLocalUpdatedAt, setLocalUpdatedAt,
} from '../utils/storage';
import { auth, subscribeFriendShare, saveFriendShareToFirestore } from '../utils/firebase';
import { getHolidays } from '../utils/holidays';
import EventAddScreen from './EventAddScreen';
import TimeField from './TimeField';
import { useSwipe } from '../hooks/useSwipe';

const FRIEND_COLOR = FRIEND_EVENT_COLORS[0];

export default function FriendCalendar() {
  const today = getToday();
  const saved = getSavedMonth();
  const [year, setYear] = useState(saved.year);
  const [month, setMonth] = useState(saved.month);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [addingEventDate, setAddingEventDate] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editColor, setEditColor] = useState(FRIEND_EVENT_COLORS[0]);
  const [editUseRange, setEditUseRange] = useState(false);
  const [editRangeEnd, setEditRangeEnd] = useState('');
  const [editRepeatType, setEditRepeatType] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [shareVersion, setShareVersion] = useState(0);
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [creatingShare, setCreatingShare] = useState(false);
  const composingRef = useRef(false);

  const shareId = useMemo(() => { void shareVersion; return getFriendShareId(); }, [shareVersion]);
  const shareUrl = shareId ? `${location.origin}${import.meta.env.BASE_URL}?share=${shareId}` : '';

  const handleCompositionStart = useCallback(() => { composingRef.current = true; }, []);
  const handleCompositionEnd = useCallback(() => { composingRef.current = false; }, []);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  const allEvents = useMemo(() => {
    void refreshKey;
    return loadFriendEvents();
  }, [refreshKey, year, month]);
  const holidays = useMemo(() => getHolidays(year), [year]);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  // 共有中はリアルタイム購読（相手の編集を反映）
  useEffect(() => {
    const sid = getFriendShareId();
    if (!sid) return;
    return subscribeFriendShare(sid, ({ exists, data, updatedAt }) => {
      if (!exists) return;
      if (updatedAt > getLocalUpdatedAt('friend')) {
        restoreToLocal('friend', data);
        setLocalUpdatedAt('friend', updatedAt);
        refresh();
      }
    });
  }, [shareVersion, refresh]);

  const createShare = async () => {
    setCreatingShare(true);
    try {
      const id = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '');
      const ts = getLocalUpdatedAt('friend') || Date.now();
      setLocalUpdatedAt('friend', ts);
      await saveFriendShareToFirestore(id, JSON.parse(JSON.stringify(loadFriendEvents())), ts);
      setFriendShareId(id);
      setShareVersion(v => v + 1);
    } catch (err) {
      console.error('friendShare create error:', err);
      alert('共有リンクの作成に失敗しました');
    } finally {
      setCreatingShare(false);
    }
  };

  const copyShareUrl = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stopShare = () => {
    if (!confirm('この端末を共有から切り離します。予定データは消えません。よろしいですか？')) return;
    setFriendShareId(null);
    setShareVersion(v => v + 1);
  };

  const prevMonth = useCallback(() => {
    const newY = month === 1 ? year - 1 : year;
    const newM = month === 1 ? 12 : month - 1;
    setYear(newY); setMonth(newM);
    saveCurrentMonth(newY, newM);
    setSelectedDate(null);
    setEditingItemId(null);
  }, [year, month]);

  const nextMonth = useCallback(() => {
    const newY = month === 12 ? year + 1 : year;
    const newM = month === 12 ? 1 : month + 1;
    setYear(newY); setMonth(newM);
    saveCurrentMonth(newY, newM);
    setSelectedDate(null);
    setEditingItemId(null);
  }, [year, month]);

  const swipeHandlers = useSwipe(nextMonth, prevMonth);

  const goToday = () => {
    const d = new Date();
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  const handleDateTap = (dateStr: string) => {
    setSelectedDate(selectedDate === dateStr ? null : dateStr);
    setEditingItemId(null);
  };

  const resetEditState = () => {
    setEditingItemId(null);
    setEditEndTime('');
    setEditUseRange(false);
    setEditRangeEnd('');
    setEditRepeatType('daily');
  };

  const startEditEvent = (item: DetailItem) => {
    setEditingItemId(item.id);
    setEditDate(selectedDate || '');
    setEditTime(item.time);
    setEditEndTime(item.endTime || '');
    setEditContent(item.content);
    setEditUrl(item.url || '');
    setEditColor(item.color || FRIEND_EVENT_COLORS[0]);
    setEditUseRange(false);
    setEditRangeEnd('');
    setEditRepeatType('daily');
  };

  const saveEditEvent = () => {
    if (!selectedDate || !editingItemId || !editContent.trim()) return;
    const content = editContent.trim();
    const time = editTime;
    // 開始時間がない（終日）なら終了時間は保持しない
    const endTime = time && editEndTime ? editEndTime : undefined;
    const url = editUrl.trim() || undefined;
    const color = editColor;
    const newDate = editDate || selectedDate;

    if (newDate !== selectedDate) {
      // 日付変更: 元の日から削除して移動先の日へ追加
      const events = getFriendDayEvents(selectedDate);
      const original = events.find(d => d.id === editingItemId);
      saveFriendDayEvents(selectedDate, events.filter(d => d.id !== editingItemId));
      saveFriendDayEvents(newDate, [
        ...getFriendDayEvents(newDate),
        { ...original, id: editingItemId, time, endTime, content, url, color },
      ]);
    } else {
      saveFriendDayEvents(selectedDate, getFriendDayEvents(selectedDate).map(d =>
        d.id === editingItemId ? { ...d, time, endTime, content, url, color } : d
      ));
    }

    if (editUseRange && editRangeEnd && editRangeEnd >= newDate) {
      const start = new Date(newDate);
      const end = new Date(editRangeEnd);
      let count = 0;

      const addToDate = (ds: string) => {
        if (ds === newDate) return;
        const item: DetailItem = {
          id: Date.now().toString() + '_e' + count,
          time,
          ...(endTime && { endTime }),
          content,
          ...(url && { url }),
          color,
        };
        saveFriendDayEvents(ds, [...getFriendDayEvents(ds), item]);
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

    resetEditState();
    refresh();
  };

  const removeEvent = (id: string) => {
    if (!selectedDate) return;
    if (!confirm('削除しますか？')) return;
    const events = getFriendDayEvents(selectedDate);
    const target = events.find(d => d.id === id);
    if (target) addDeletedEvent(target, selectedDate, 'friend');
    saveFriendDayEvents(selectedDate, events.filter(d => d.id !== id));
    setEditingItemId(null);
    refresh();
  };

  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  // カレンダーセルの描画
  const cells = [];

  // 空白セル（月初の曜日まで）- 前月の日付を表示
  const prevMonthDays = getDaysInMonth(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1);
  for (let i = 0; i < firstDay; i++) {
    const prevDay = prevMonthDays - firstDay + 1 + i;
    cells.push(
      <div key={`empty-${i}`} className="cal-cell cal-cell-empty">
        <span className="cal-date">{prevDay}</span>
      </div>
    );
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDate(year, month, d);
    const dow = new Date(year, month - 1, d).getDay();
    const holidayName = holidays.get(dateStr);
    const isToday = dateStr === today;
    const isSelected = dateStr === selectedDate;
    const events = [...(allEvents[dateStr] || [])].sort((a, b) => a.time.localeCompare(b.time));
    const extraCount = events.length > 2 ? events.length - 2 : 0;

    cells.push(
      <div
        key={dateStr}
        className={`cal-cell ${isToday ? 'cal-today' : ''} ${isSelected ? 'cal-selected' : ''} ${dow === 0 || holidayName ? 'cal-sun' : dow === 6 ? 'cal-sat' : ''}`}
        onClick={() => handleDateTap(dateStr)}
      >
        <div className="cal-date">
          {d}
          {holidayName && <span className="cal-holiday">{holidayName}</span>}
          {extraCount > 0 && <span className="cal-badge">+{extraCount}</span>}
        </div>
        {events.slice(0, 2).map(item => (
          <div key={item.id} className="cal-chip" style={{ background: item.color || FRIEND_COLOR }}>
            <span className="cal-chip-text">{item.content}</span>
          </div>
        ))}
      </div>
    );
  }

  const selectedEvents = selectedDate
    ? [...(allEvents[selectedDate] || [])].sort((a, b) => a.time.localeCompare(b.time))
    : [];

  return (
    <div className="month-calendar">
      {/* ヘッダー */}
      <div className="cal-header">
        <div className="cal-header-left">
          <span className="cal-title">{monthNames[month - 1]} 友達</span>
          <span className="cal-year">{year}年</span>
        </div>
        <div className="cal-header-right">
          <button className="cal-today-btn" onClick={() => setShowShare(true)}>{shareId ? '共有中' : '共有'}</button>
          <button className="cal-today-btn" onClick={goToday}>今日</button>
          <button className="cal-nav-btn" onClick={prevMonth}>◀</button>
          <button className="cal-nav-btn" onClick={nextMonth}>▶</button>
        </div>
      </div>

      {/* 共有モーダル */}
      {showShare && (
        <div className="shift-editor-overlay" onClick={() => { setShowShare(false); setCopied(false); }}>
          <div className="shift-editor" onClick={e => e.stopPropagation()}>
            <div className="shift-editor-header">
              <span>友達の予定を共有</span>
              <button onClick={() => { setShowShare(false); setCopied(false); }}>✕</button>
            </div>
            <div style={{ padding: '16px' }}>
              {shareId ? (
                <>
                  <div style={{ wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '12px', background: '#f5f5f5', padding: '10px', borderRadius: '8px', lineHeight: '1.6' }}>
                    {shareUrl}
                  </div>
                  <div style={{ textAlign: 'center', marginTop: '12px' }}>
                    <button className="cal-today-btn" style={{ padding: '8px 24px', fontSize: '14px' }} onClick={copyShareUrl}>
                      {copied ? 'コピーしました!' : 'リンクをコピー'}
                    </button>
                  </div>
                  <div style={{ marginTop: '12px', fontSize: '13px', color: '#666', lineHeight: '1.6' }}>
                    リンクを知っている人はこのカレンダーを閲覧・編集できます
                  </div>
                  <div style={{ textAlign: 'center', marginTop: '12px' }}>
                    <button className="cal-today-btn" style={{ padding: '8px 24px', fontSize: '14px' }} onClick={stopShare}>
                      共有をやめる（この端末のみ）
                    </button>
                  </div>
                </>
              ) : auth.currentUser ? (
                <>
                  <div style={{ fontSize: '14px', color: '#333', lineHeight: '1.7' }}>
                    共有リンクを知っている人は、このカレンダーを見る・編集することができます。
                  </div>
                  <div style={{ textAlign: 'center', marginTop: '16px' }}>
                    <button className="cal-today-btn" style={{ padding: '8px 24px', fontSize: '14px' }} onClick={createShare} disabled={creatingShare}>
                      共有リンクを作成
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: '14px', color: '#333', lineHeight: '1.7' }}>
                  共有リンクの作成にはGoogleログインが必要です。設定タブからログインしてください。
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 曜日ヘッダー */}
      <div className="cal-weekdays">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={label} className={`cal-weekday ${i === 0 ? 'cal-sun' : i === 6 ? 'cal-sat' : ''}`}>
            {label}
          </div>
        ))}
      </div>

      {/* カレンダーグリッド */}
      <div className="cal-grid-wrap">
        <div className="cal-grid" {...swipeHandlers}>
          {cells}
        </div>
      </div>

      {/* 詳細パネル */}
      {selectedDate && (
        <div className="detail-panel">
          <div className="detail-header">
            <span className="detail-date">
              {parseInt(selectedDate.slice(8))}日({WEEKDAY_LABELS[new Date(selectedDate).getDay()]})
            </span>
            <button className="detail-add-btn" onClick={() => setAddingEventDate(selectedDate)}>＋</button>
          </div>

          {selectedEvents.length === 0 && (
            <div className="detail-shift-empty" onClick={() => setAddingEventDate(selectedDate)}>
              タップして予定を追加
            </div>
          )}

          {selectedEvents.map(item => (
            editingItemId === item.id ? (
              <div key={item.id} className="detail-add-form">
                <div className="detail-time-row">
                  <div className="detail-time-field">
                    <label className="detail-time-label">日付</label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={e => setEditDate(e.target.value)}
                      className="detail-input-date"
                    />
                  </div>
                </div>
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
                  onKeyDown={e => { if (e.key === 'Enter' && !composingRef.current) saveEditEvent(); }}
                  autoFocus
                />
                <input
                  type="url"
                  placeholder="URL（任意）"
                  value={editUrl}
                  onChange={e => setEditUrl(e.target.value)}
                  className="detail-input-url"
                />
                <div className="color-dot-row">
                  {FRIEND_EVENT_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      className={`color-dot ${editColor === c ? 'selected' : ''}`}
                      style={{ background: c }}
                      onClick={() => setEditColor(c)}
                    />
                  ))}
                </div>
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
                        <span className="detail-range-label">{(editDate || selectedDate).slice(5).replace('-', '/')}</span>
                        <span>〜</span>
                        <input
                          type="date"
                          value={editRangeEnd}
                          min={editDate || selectedDate}
                          onChange={e => setEditRangeEnd(e.target.value)}
                          className="detail-input-date"
                        />
                      </div>
                    </>
                  )}
                </div>
                <button className="detail-save-btn" onClick={saveEditEvent}>保存</button>
                <button className="detail-cancel-btn" onClick={resetEditState}>取消</button>
                <button className="detail-item-delete" onClick={() => { removeEvent(item.id); setEditingItemId(null); }}>削除</button>
              </div>
            ) : (
              <div key={item.id}>
                <div className="detail-item" onClick={() => startEditEvent(item)}>
                  <div className="detail-item-time">{item.time || '終日'}</div>
                  <div className="detail-item-content">{item.content}</div>
                </div>
                {item.url && (
                  <a className="detail-item-url" href={item.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                    🔗 {item.url.replace(/^https?:\/\//, '').slice(0, 40)}{item.url.replace(/^https?:\/\//, '').length > 40 ? '...' : ''}
                  </a>
                )}
              </div>
            )
          ))}
        </div>
      )}

      {/* イベント追加画面 */}
      {addingEventDate && (
        <EventAddScreen
          dateStr={addingEventDate}
          target="friend"
          onSave={() => { setAddingEventDate(null); refresh(); }}
          onClose={() => setAddingEventDate(null)}
        />
      )}
    </div>
  );
}
