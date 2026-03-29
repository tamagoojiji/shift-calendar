import { useState, useMemo } from 'react';
import { getDaysInMonth, formatDate, WEEKDAY_LABELS } from '../utils/dateUtils';
import { getSavedMonth, saveCurrentMonth } from '../utils/storage';
import { getHolidays } from '../utils/holidays';
import { parkHours } from '../data/hours';
import { ticketPrices, getPriceLevel, formatPrice } from '../data/tickets';
import { annualPassExcluded } from '../data/annual-pass';
import { privateEvents } from '../data/private-events';

type ParkTab = 'hours' | 'tickets' | 'annual' | 'private';

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

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const holidays = useMemo(() => getHolidays(year), [year]);

  const prevMonth = () => {
    const newY = month === 1 ? year - 1 : year;
    const newM = month === 1 ? 12 : month - 1;
    setYear(newY); setMonth(newM);
    saveCurrentMonth(newY, newM);
    setSelectedDate(null);
  };

  const nextMonth = () => {
    const newY = month === 12 ? year + 1 : year;
    const newM = month === 12 ? 1 : month + 1;
    setYear(newY); setMonth(newM);
    saveCurrentMonth(newY, newM);
    setSelectedDate(null);
  };

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
        onClick={() => setSelectedDate(selectedDate === dateStr ? null : dateStr)}
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
      <div className="cal-grid">
        {cells}
      </div>

      {/* 詳細パネル */}
      {selectedDate && (
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
