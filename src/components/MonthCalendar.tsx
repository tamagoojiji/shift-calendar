import { useState, useMemo, useRef, useCallback } from 'react';
import type { DayData, DayShiftType, NightShiftPlace, NightShiftTime } from '../types';
import { SHIFT_COLORS, SHIFT_LABELS } from '../types';
import { getDaysInMonth, getFirstDayOfWeek, formatDate, getToday, WEEKDAY_LABELS } from '../utils/dateUtils';
import { getDay, saveDay, loadShifts } from '../utils/storage';
import DetailPanel from './DetailPanel';

export default function MonthCalendar() {
  const today = getToday();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  const allShifts = useMemo(() => loadShifts(), [refreshKey, year, month]);

  const refresh = () => setRefreshKey(k => k + 1);

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
    setSelectedDate(null);
    setEditingDate(null);
  };

  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
    setSelectedDate(null);
    setEditingDate(null);
  };

  const goToday = () => {
    const d = new Date();
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  const handleDateTap = (dateStr: string) => {
    if (longPressTriggered.current) return;
    if (selectedDate === dateStr) {
      setSelectedDate(null);
    } else {
      setSelectedDate(dateStr);
    }
    setEditingDate(null);
  };

  const handleDateLongPress = (dateStr: string) => {
    setEditingDate(dateStr);
    setSelectedDate(null);
  };

  const handleTouchStart = useCallback((dateStr: string) => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      handleDateLongPress(dateStr);
    }, 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleShiftSelect = (dateStr: string, field: 'dayShift' | 'nightShift' | 'nightTime' | 'isOff', value: unknown) => {
    const day = getDay(dateStr);
    if (field === 'isOff') {
      day.isOff = value as boolean;
      if (day.isOff) {
        day.dayShift = null;
        day.nightShift = null;
        day.nightTime = null;
      }
    } else if (field === 'dayShift') {
      day.dayShift = value as DayShiftType;
      day.isOff = false;
    } else if (field === 'nightShift') {
      day.nightShift = value as NightShiftPlace;
      day.isOff = false;
    } else if (field === 'nightTime') {
      day.nightTime = value as NightShiftTime;
    }
    saveDay(day);
    refresh();
  };

  // カレンダーセルの描画
  const cells = [];

  // 空白セル（月初の曜日まで）
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`empty-${i}`} className="cal-cell cal-cell-empty" />);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDate(year, month, d);
    const day: DayData = allShifts[dateStr] || { date: dateStr, dayShift: null, nightShift: null, nightTime: null, isOff: false, details: [] };
    const dow = new Date(year, month - 1, d).getDay();
    const isToday = dateStr === today;
    const isSelected = dateStr === selectedDate;
    const detailCount = day.details?.length || 0;

    cells.push(
      <div
        key={dateStr}
        className={`cal-cell ${isToday ? 'cal-today' : ''} ${isSelected ? 'cal-selected' : ''} ${dow === 0 ? 'cal-sun' : dow === 6 ? 'cal-sat' : ''}`}
        onClick={() => handleDateTap(dateStr)}
        onTouchStart={() => handleTouchStart(dateStr)}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchEnd}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="cal-date">
          {d}
          {detailCount > 0 && <span className="cal-badge">+{detailCount}</span>}
        </div>
        {day.isOff ? (
          <div className="cal-shift" style={{ color: SHIFT_COLORS.off }}>休み</div>
        ) : (
          <>
            <div className="cal-shift" style={{ color: day.dayShift ? SHIFT_COLORS[day.dayShift] : 'transparent' }}>
              {day.dayShift ? SHIFT_LABELS[day.dayShift] : '\u00A0'}
            </div>
            {day.nightShift ? (
              <>
                <div className="cal-shift cal-night-time" style={{ color: SHIFT_COLORS[day.nightShift] }}>
                  {day.nightTime === '17' ? '17時' : '20時'}
                </div>
                <div className="cal-shift" style={{ color: SHIFT_COLORS[day.nightShift] }}>
                  {SHIFT_LABELS[day.nightShift]}
                </div>
              </>
            ) : (
              <>
                <div className="cal-shift">&nbsp;</div>
                <div className="cal-shift">&nbsp;</div>
              </>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="month-calendar">
      {/* ヘッダー */}
      <div className="cal-header">
        <button className="cal-nav-btn" onClick={prevMonth}>◀</button>
        <span className="cal-title">{year}年 {month}月</span>
        <button className="cal-nav-btn" onClick={nextMonth}>▶</button>
        <button className="cal-today-btn" onClick={goToday}>今日</button>
      </div>

      {/* 曜日ヘッダー */}
      <div className="cal-weekdays">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={label} className={`cal-weekday ${i === 0 ? 'cal-sun' : i === 6 ? 'cal-sat' : ''}`}>
            {label}
          </div>
        ))}
      </div>

      {/* カレンダーグリッド */}
      <div className="cal-grid">
        {cells}
      </div>

      {/* シフト入力パネル */}
      {editingDate && (
        <ShiftEditor
          dateStr={editingDate}
          day={getDay(editingDate)}
          onSelect={handleShiftSelect}
          onClose={() => setEditingDate(null)}
        />
      )}

      {/* 詳細パネル */}
      {selectedDate && (
        <DetailPanel
          dateStr={selectedDate}
          day={getDay(selectedDate)}
          onUpdate={refresh}
          onEditShift={() => { setEditingDate(selectedDate); setSelectedDate(null); }}
        />
      )}
    </div>
  );
}

// シフト入力コンポーネント
function ShiftEditor({ dateStr, day, onSelect, onClose }: {
  dateStr: string;
  day: DayData;
  onSelect: (dateStr: string, field: 'dayShift' | 'nightShift' | 'nightTime' | 'isOff', value: unknown) => void;
  onClose: () => void;
}) {
  const dayOptions: { value: DayShiftType; label: string }[] = [
    { value: 'eye', label: '眼科' },
    { value: 'facility', label: '施設' },
    { value: null, label: 'なし' },
  ];

  const nightOptions: { value: NightShiftPlace; label: string }[] = [
    { value: 'katano', label: '交野' },
    { value: 'hirakata', label: '枚方' },
    { value: 'kadoma', label: '門真' },
    { value: 'moriguchi', label: '守口' },
    { value: null, label: 'なし' },
  ];

  const timeOptions: { value: NightShiftTime; label: string }[] = [
    { value: '17', label: '17時〜' },
    { value: '20', label: '20時〜' },
  ];

  const dow = new Date(dateStr).getDay();
  const dayLabel = WEEKDAY_LABELS[dow];

  return (
    <div className="shift-editor-overlay" onClick={onClose}>
      <div className="shift-editor" onClick={e => e.stopPropagation()}>
        <div className="shift-editor-header">
          <span>{parseInt(dateStr.slice(8))}日({dayLabel}) シフト入力</span>
          <button onClick={onClose}>✕</button>
        </div>

        {/* 休み */}
        <div className="shift-section">
          <button
            className={`shift-btn ${day.isOff ? 'active' : ''}`}
            style={day.isOff ? { background: SHIFT_COLORS.off, color: '#fff' } : {}}
            onClick={() => onSelect(dateStr, 'isOff', !day.isOff)}
          >
            休み
          </button>
        </div>

        {!day.isOff && (
          <>
            {/* 日勤 */}
            <div className="shift-section">
              <div className="shift-section-label">日勤</div>
              <div className="shift-btn-group">
                {dayOptions.map(opt => (
                  <button
                    key={String(opt.value)}
                    className={`shift-btn ${day.dayShift === opt.value ? 'active' : ''}`}
                    style={day.dayShift === opt.value && opt.value ? { background: SHIFT_COLORS[opt.value], color: '#fff' } : {}}
                    onClick={() => onSelect(dateStr, 'dayShift', opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 夜勤 */}
            <div className="shift-section">
              <div className="shift-section-label">夜勤</div>
              <div className="shift-btn-group">
                {nightOptions.map(opt => (
                  <button
                    key={String(opt.value)}
                    className={`shift-btn ${day.nightShift === opt.value ? 'active' : ''}`}
                    style={day.nightShift === opt.value && opt.value ? { background: SHIFT_COLORS[opt.value], color: '#fff' } : {}}
                    onClick={() => onSelect(dateStr, 'nightShift', opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 夜勤時間 */}
            {day.nightShift && (
              <div className="shift-section">
                <div className="shift-section-label">夜勤開始</div>
                <div className="shift-btn-group">
                  {timeOptions.map(opt => (
                    <button
                      key={String(opt.value)}
                      className={`shift-btn ${day.nightTime === opt.value ? 'active' : ''}`}
                      style={day.nightTime === opt.value ? { background: '#333', color: '#fff' } : {}}
                      onClick={() => onSelect(dateStr, 'nightTime', opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
