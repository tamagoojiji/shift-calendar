import { useState, useMemo, useCallback } from 'react';
import { getDaysInMonth, formatDate, WEEKDAY_LABELS } from '../utils/dateUtils';
import { getSavedMonth, saveCurrentMonth, loadShifts, getDay, saveDay } from '../utils/storage';
import { getHolidays } from '../utils/holidays';
import { useSwipe } from '../hooks/useSwipe';
import { parkHours } from '../data/hours';
import { ticketPrices, getPriceLevel, formatPrice } from '../data/tickets';
import { annualPassExcluded } from '../data/annual-pass';
import { privateEvents } from '../data/private-events';
import type { DetailItem } from '../types';

type ParkTab = 'hours' | 'tickets' | 'annual' | 'private' | 'events';

const PRICE_COLORS: Record<string, string> = {
  low: '#4CAF50',
  mid: '#2196F3',
  high: '#FF9800',
  peak: '#E91E63',
};

export default function ParkCalendar() {
  const saved = getSavedMonth();
  const [year, setYear] = useState(saved.year);
  const [month, setMonth] = useState(saved.month);
  const [activeTab, setActiveTab] = useState<ParkTab>('hours');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // イベント編集用state
  const [adding, setAdding] = useState(false);
  const [newTime, setNewTime] = useState('');
  const [newContent, setNewContent] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editTime, setEditTime] = useState('');
  const [editContent, setEditContent] = useState('');

  // イベントデータ読込（refreshKeyで再読込トリガー）
  const allShifts = useMemo(() => {
    void refreshKey; // dependency
    return loadShifts();
  }, [refreshKey]);

  const refreshData = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  // イベント追加
  const addEvent = useCallback(() => {
    if (!selectedDate || !newContent.trim()) return;
    const day = getDay(selectedDate);
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
    refreshData();
  }, [selectedDate, newTime, newContent, refreshData]);

  // イベント削除
  const removeEvent = useCallback((id: string) => {
    if (!selectedDate) return;
    const day = getDay(selectedDate);
    day.details = (day.details || []).filter(d => d.id !== id);
    saveDay(day);
    setEditingItemId(null);
    refreshData();
  }, [selectedDate, refreshData]);

  // イベント編集保存
  const saveEditEvent = useCallback(() => {
    if (!selectedDate || !editingItemId || !editContent.trim()) return;
    const day = getDay(selectedDate);
    day.details = (day.details || []).map(d =>
      d.id === editingItemId ? { ...d, time: editTime, content: editContent.trim() } : d
    );
    saveDay(day);
    setEditingItemId(null);
    refreshData();
  }, [selectedDate, editingItemId, editTime, editContent, refreshData]);

  const startEditEvent = useCallback((item: DetailItem) => {
    setEditingItemId(item.id);
    setEditTime(item.time);
    setEditContent(item.content);
  }, []);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const holidays = useMemo(() => getHolidays(year), [year]);

  const prevMonth = useCallback(() => {
    const newY = month === 1 ? year - 1 : year;
    const newM = month === 1 ? 12 : month - 1;
    setYear(newY); setMonth(newM);
    saveCurrentMonth(newY, newM);
    setSelectedDate(null);
  }, [year, month]);

  const nextMonth = useCallback(() => {
    const newY = month === 12 ? year + 1 : year;
    const newM = month === 12 ? 1 : month + 1;
    setYear(newY); setMonth(newM);
    saveCurrentMonth(newY, newM);
    setSelectedDate(null);
  }, [year, month]);

  const swipeHandlers = useSwipe(nextMonth, prevMonth);

  const getCellContent = (dateStr: string) => {
    switch (activeTab) {
      case 'hours': {
        const h = parkHours[dateStr];
        if (!h) return null;
        const [open, close] = h.split('~');
        return { text: `${open}\n${close}`, color: '#0f6784' };
      }
      case 'tickets': {
        const price = ticketPrices[dateStr];
        if (!price) return null;
        const level = getPriceLevel(price);
        return { text: `${(price / 1000).toFixed(1)}k`, color: PRICE_COLORS[level] };
      }
      case 'annual': {
        const excluded = annualPassExcluded.has(dateStr);
        return { text: excluded ? '✕' : '○', color: excluded ? '#E91E63' : '#4CAF50' };
      }
      case 'private': {
        const evt = privateEvents[dateStr];
        if (!evt) return null;
        return { text: '貸切', color: '#9C27B0' };
      }
      case 'events': {
        const dayData = allShifts[dateStr];
        const count = dayData?.details?.length || 0;
        if (count === 0) return null;
        return { text: `${count}件`, color: '#FF5722' };
      }
    }
  };

  const getDetailContent = (dateStr: string) => {
    const details: { label: string; value: string; color?: string }[] = [];

    const h = parkHours[dateStr];
    if (h) details.push({ label: '営業時間', value: h, color: '#0f6784' });

    const price = ticketPrices[dateStr];
    if (price) {
      const level = getPriceLevel(price);
      details.push({ label: 'チケット(大人)', value: formatPrice(price), color: PRICE_COLORS[level] });
    }

    const excluded = annualPassExcluded.has(dateStr);
    details.push({
      label: '年パス',
      value: excluded ? '除外日' : '利用可',
      color: excluded ? '#E91E63' : '#4CAF50',
    });

    const evt = privateEvents[dateStr];
    if (evt) {
      details.push({ label: '貸切', value: `${evt.name} ${evt.time}`, color: '#9C27B0' });
    }

    return details;
  };

  const today = new Date();
  const todayStr = formatDate(today.getFullYear(), today.getMonth() + 1, today.getDate());

  const cells = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`empty-${i}`} className="park-cell park-cell-empty" />);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDate(year, month, d);
    const dow = new Date(year, month - 1, d).getDay();
    const holidayName = holidays.get(dateStr);
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === selectedDate;
    const content = getCellContent(dateStr);

    cells.push(
      <div
        key={dateStr}
        className={`park-cell ${isToday ? 'park-today' : ''} ${isSelected ? 'park-selected' : ''} ${dow === 0 || holidayName ? 'cal-sun' : dow === 6 ? 'cal-sat' : ''}`}
        onClick={() => {
          setSelectedDate(selectedDate === dateStr ? null : dateStr);
          setEditingItemId(null);
          setAdding(false);
        }}
      >
        <div className="park-date">{d}</div>
        {content && (
          <div className="park-cell-value" style={{ color: content.color }}>
            {content.text}
          </div>
        )}
      </div>
    );
  }

  const tabs: { id: ParkTab; label: string; icon: string }[] = [
    { id: 'hours', label: '営業時間', icon: '🕐' },
    { id: 'tickets', label: 'チケット', icon: '💰' },
    { id: 'annual', label: '年パス', icon: '🎫' },
    { id: 'private', label: '貸切', icon: '🔒' },
    { id: 'events', label: 'イベント', icon: '🗓' },
  ];

  return (
    <div className="park-calendar">
      <div className="cal-header">
        <button className="cal-nav-btn" onClick={prevMonth}>◀</button>
        <span className="cal-title">{year}年 {month}月 パーク</span>
        <button className="cal-nav-btn" onClick={nextMonth}>▶</button>
      </div>

      {/* サブタブ */}
      <div className="park-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`park-tab ${activeTab === tab.id ? 'park-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="park-tab-icon">{tab.icon}</span>
            <span className="park-tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 曜日ヘッダー */}
      <div className="cal-weekdays">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={label} className={`cal-weekday ${i === 0 ? 'cal-sun' : i === 6 ? 'cal-sat' : ''}`}>
            {label}
          </div>
        ))}
      </div>

      {/* グリッド */}
      <div className="cal-grid" {...swipeHandlers}>
        {cells}
      </div>

      {/* 詳細パネル */}
      {selectedDate && activeTab !== 'events' && (
        <div className="park-detail">
          <div className="park-detail-header">
            {parseInt(selectedDate.slice(8))}日({WEEKDAY_LABELS[new Date(selectedDate).getDay()]})
          </div>
          {getDetailContent(selectedDate).map((item, i) => (
            <div key={i} className="park-detail-row">
              <span className="park-detail-label">{item.label}</span>
              <span className="park-detail-value" style={{ color: item.color }}>{item.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* イベント詳細パネル */}
      {selectedDate && activeTab === 'events' && (() => {
        const dayData = allShifts[selectedDate];
        const details = [...(dayData?.details || [])].sort((a, b) => a.time.localeCompare(b.time));
        return (
          <div className="park-detail">
            <div className="park-detail-header">
              <span>{parseInt(selectedDate.slice(8))}日({WEEKDAY_LABELS[new Date(selectedDate).getDay()]})</span>
              <button className="detail-add-btn" onClick={() => setAdding(true)}>＋</button>
            </div>

            {details.length === 0 && !adding && (
              <div className="park-event-empty" onClick={() => setAdding(true)}>タップして予定を追加</div>
            )}

            {details.map(item => (
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
                    onKeyDown={e => e.key === 'Enter' && saveEditEvent()}
                    autoFocus
                  />
                  <button className="detail-save-btn" onClick={saveEditEvent}>保存</button>
                  <button className="detail-cancel-btn" onClick={() => setEditingItemId(null)}>取消</button>
                  <button className="detail-item-delete" onClick={() => removeEvent(item.id)}>削除</button>
                </div>
              ) : (
                <div key={item.id} className="detail-item" onClick={() => startEditEvent(item)}>
                  <div className="detail-item-time">{item.time || '--:--'}</div>
                  <div className="detail-item-content">{item.content}</div>
                </div>
              )
            ))}

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
                  onKeyDown={e => e.key === 'Enter' && addEvent()}
                  autoFocus
                />
                <button className="detail-save-btn" onClick={addEvent}>保存</button>
                <button className="detail-cancel-btn" onClick={() => { setAdding(false); setNewTime(''); setNewContent(''); }}>取消</button>
              </div>
            )}
          </div>
        );
      })()}

      {/* チケット凡例 */}
      {activeTab === 'tickets' && (
        <div className="park-legend">
          <span style={{ color: PRICE_COLORS.low }}>● ~¥8,900</span>
          <span style={{ color: PRICE_COLORS.mid }}>● ~¥9,400</span>
          <span style={{ color: PRICE_COLORS.high }}>● ~¥9,900</span>
          <span style={{ color: PRICE_COLORS.peak }}>● ¥10,900~</span>
        </div>
      )}
    </div>
  );
}
