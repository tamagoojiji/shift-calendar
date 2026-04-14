import { useState, useMemo, useRef, useCallback } from 'react';
import type { DayData, DayShiftType, NightShiftPlace, NightShiftTime } from '../types';
import { SHIFT_COLORS, SHIFT_LABELS } from '../types';
import { getDaysInMonth, getFirstDayOfWeek, formatDate, getToday, WEEKDAY_LABELS } from '../utils/dateUtils';
import { getDay, saveDay, loadShifts, getSavedMonth, saveCurrentMonth, loadClinicData, saveClinicData } from '../utils/storage';
import { getHolidays } from '../utils/holidays';
import DetailPanel from './DetailPanel';
import EventAddScreen from './EventAddScreen';
import { useSwipe } from '../hooks/useSwipe';

export default function MonthCalendar() {
  const today = getToday();
  const todayDate = new Date();
  const todayYM = { y: todayDate.getFullYear(), m: todayDate.getMonth() + 1 };
  const saved = getSavedMonth();
  const [year, setYear] = useState(saved.year);
  const [month, setMonth] = useState(saved.month);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [addingEventDate, setAddingEventDate] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  const allShifts = useMemo(() => loadShifts(), [refreshKey, year, month]);
  const holidays = useMemo(() => getHolidays(year), [year]);

  const refresh = () => setRefreshKey(k => k + 1);

  const prevMonth = useCallback(() => {
    setYear(y => { const newY = month === 1 ? y - 1 : y; return newY; });
    setMonth(m => m === 1 ? 12 : m - 1);
    saveCurrentMonth(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1);
    setSelectedDate(null);
    setEditingDate(null);
  }, [year, month]);

  const nextMonth = useCallback(() => {
    setYear(y => { const newY = month === 12 ? y + 1 : y; return newY; });
    setMonth(m => m === 12 ? 1 : m + 1);
    saveCurrentMonth(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1);
    setSelectedDate(null);
    setEditingDate(null);
  }, [year, month]);

  const swipeHandlers = useSwipe(nextMonth, prevMonth);

  const goToday = () => {
    const d = new Date();
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  const openPicker = () => {
    setPickerYear(year);
    setShowPicker(true);
  };

  const selectMonth = (m: number) => {
    setYear(pickerYear);
    setMonth(m);
    saveCurrentMonth(pickerYear, m);
    setSelectedDate(null);
    setEditingDate(null);
    setShowPicker(false);
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

  // 通常カレンダー → 眼科カレンダーへの自動同期
  const syncToClinic = (dateStr: string, day: DayData) => {
    const monthKey = dateStr.slice(0, 7);
    const data = loadClinicData();
    if (!data[monthKey]) data[monthKey] = {};
    if (!data[monthKey][dateStr]) data[monthKey][dateStr] = {};

    if (day.isOff) {
      data[monthKey][dateStr]['yotsuhashi'] = 'off';
    } else if (day.dayShift === 'eye') {
      // 眼科の場合、既にクリニック側にパターンがあればそのまま、なければ'am_pm'をセット
      const current = data[monthKey][dateStr]['yotsuhashi'];
      if (!current || current === 'off') {
        data[monthKey][dateStr]['yotsuhashi'] = 'am_pm';
      }
    } else {
      // 眼科以外の日勤 or 日勤なし → クリニック側をクリア
      data[monthKey][dateStr]['yotsuhashi'] = null;
    }
    saveClinicData(data);
  };

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
      if (day.nightShift === 'hazushi') {
        day.nightTime = null;
      }
      day.isOff = false;
    } else if (field === 'nightTime') {
      day.nightTime = value as NightShiftTime;
    }
    saveDay(day);
    // 日勤・休みの変更は眼科カレンダーに自動同期
    if (field === 'dayShift' || field === 'isOff') {
      syncToClinic(dateStr, day);
    }
    refresh();
  };

  // 月名（日本語）
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
    const day: DayData = allShifts[dateStr] || { date: dateStr, dayShift: null, nightShift: null, nightTime: null, isOff: false, details: [] };
    const dow = new Date(year, month - 1, d).getDay();
    const holidayName = holidays.get(dateStr);
    const isToday = dateStr === today;
    const isSelected = dateStr === selectedDate;
    const detailCount = day.details?.length || 0;

    cells.push(
      <div
        key={dateStr}
        className={`cal-cell ${isToday ? 'cal-today' : ''} ${isSelected ? 'cal-selected' : ''} ${dow === 0 || holidayName ? 'cal-sun' : dow === 6 ? 'cal-sat' : ''}`}
        onClick={() => handleDateTap(dateStr)}
        onTouchStart={() => handleTouchStart(dateStr)}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchEnd}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="cal-date">
          {d}
          {holidayName && <span className="cal-holiday">{holidayName}</span>}
          {detailCount > 0 && <span className="cal-badge">+{detailCount}</span>}
        </div>
        {day.isOff && !day.nightShift ? (
          <div className="cal-chip cal-chip-off">
            <span className="cal-chip-text">休み</span>
          </div>
        ) : (
          <>
            {day.isOff ? (
              <div className="cal-chip-spacer" />
            ) : day.dayShift ? (
              <div className={`cal-chip cal-chip-${day.dayShift}`}>
                <span className="cal-chip-text">{SHIFT_LABELS[day.dayShift]}</span>
              </div>
            ) : (
              <div className="cal-chip-spacer" />
            )}
            {day.nightShift && (
              <>
                {day.nightShift !== 'hazushi' && (
                  <div className={`cal-chip cal-chip-${day.nightShift}`}>
                    <span className="cal-chip-text">{day.nightTime === '17' ? '17時' : '20時'}</span>
                  </div>
                )}
                <div className={`cal-chip cal-chip-${day.nightShift}`}>
                  <span className="cal-chip-text">{SHIFT_LABELS[day.nightShift]}</span>
                </div>
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
        <div className="cal-header-left" onClick={openPicker} style={{ cursor: 'pointer' }}>
          <span className="cal-title">{monthNames[month - 1]}</span>
          <span className="cal-year">{year}年 ▾</span>
        </div>
        <div className="cal-header-right">
          <button className="cal-today-btn" onClick={goToday}>今日</button>
          <button className="cal-nav-btn" onClick={prevMonth}>◀</button>
          <button className="cal-nav-btn" onClick={nextMonth}>▶</button>
        </div>
      </div>

      {/* 年月ピッカー */}
      {showPicker && (
        <div className="cal-picker-overlay" onClick={() => setShowPicker(false)}>
          <div className="cal-picker" onClick={e => e.stopPropagation()}>
            <div className="cal-picker-year-row">
              <button className="cal-picker-year-btn" onClick={() => setPickerYear(y => y - 1)}>◀</button>
              <span className="cal-picker-year">{pickerYear}年</span>
              <button className="cal-picker-year-btn" onClick={() => setPickerYear(y => y + 1)}>▶</button>
            </div>
            <div className="cal-picker-months">
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                <button
                  key={m}
                  className={`cal-picker-month ${pickerYear === year && m === month ? 'active' : ''} ${pickerYear === todayYM.y && m === todayYM.m ? 'today' : ''}`}
                  onClick={() => selectMonth(m)}
                >
                  {m}月
                </button>
              ))}
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
          onAddEvent={() => setAddingEventDate(selectedDate)}
        />
      )}
      {/* イベント追加画面 */}
      {addingEventDate && (
        <EventAddScreen
          dateStr={addingEventDate}
          onSave={() => { setAddingEventDate(null); refresh(); }}
          onClose={() => setAddingEventDate(null)}
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
    { value: 'hazushi', label: '外し' },
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
                {dayOptions.map(opt => {
                  const isActive = day.dayShift === opt.value;
                  return (
                    <button
                      key={opt.value ?? 'day-none'}
                      className={`shift-btn ${isActive ? 'active' : ''}`}
                      style={isActive ? {
                        background: opt.value ? SHIFT_COLORS[opt.value] : '#999',
                        color: '#fff',
                      } : {}}
                      onClick={() => onSelect(dateStr, 'dayShift', opt.value)}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 夜勤 */}
            <div className="shift-section">
              <div className="shift-section-label">夜勤</div>
              <div className="shift-btn-group">
                {nightOptions.map(opt => {
                  const isActive = day.nightShift === opt.value;
                  return (
                    <button
                      key={opt.value ?? 'night-none'}
                      className={`shift-btn ${isActive ? 'active' : ''}`}
                      style={isActive ? {
                        background: opt.value ? SHIFT_COLORS[opt.value] : '#999',
                        color: '#fff',
                      } : {}}
                      onClick={() => onSelect(dateStr, 'nightShift', opt.value)}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 夜勤時間 */}
            {day.nightShift && day.nightShift !== 'hazushi' && (
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
