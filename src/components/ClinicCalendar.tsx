import { useState, useMemo } from 'react';
import type { ClinicShiftPattern, Staff } from '../types';
import { getDaysInMonth, formatDate, WEEKDAY_LABELS, getPrevDate } from '../utils/dateUtils';
import { loadClinicData, saveClinicData, loadStaff, saveStaff, loadShifts, getDay, saveDay, getSavedMonth, saveCurrentMonth } from '../utils/storage';
import { generateClinicPDF } from '../utils/pdfExport';
import { getHolidays } from '../utils/holidays';

const PATTERN_LABELS: Record<string, string> = {
  am: '午前',
  pm: '午後',
  am_pm: '全日',
  am_ten: '午前\n(10時〜)',
  am_pm_ten: '全日\n(10時〜)',
  late: '11:30',
  off: '休',
};

const PATTERN_COLORS: Record<string, string> = {
  am: '#E91E63',
  pm: '#FF9800',
  am_pm: '#E91E63',
  am_ten: '#E91E63',
  am_pm_ten: '#E91E63',
  late: '#9C27B0',
  off: '#9E9E9E',
};

// 2段ブロック表示用
const BLOCK_CONFIG: Record<string, { line1: string; line2?: string; bg: string; color: string }> = {
  am:       { line1: '午前', bg: '#FCE4EC', color: '#E91E63' },
  pm:       { line1: '午後', bg: '#FFF3E0', color: '#FF9800' },
  am_pm:    { line1: '全日', bg: '#FCE4EC', color: '#E91E63' },
  am_ten:   { line1: '午前', line2: '10時〜', bg: '#FCE4EC', color: '#E91E63' },
  am_pm_ten:{ line1: '全日', line2: '10時〜', bg: '#FCE4EC', color: '#E91E63' },
  late:     { line1: '11:30', bg: '#F3E5F5', color: '#9C27B0' },
  off:      { line1: '休', bg: '#F5F5F5', color: '#9E9E9E' },
};

export default function ClinicCalendar() {
  const saved = getSavedMonth();
  const [year, setYear] = useState(saved.year);
  const [month, setMonth] = useState(saved.month);
  const [staffList, setStaffList] = useState<Staff[]>(loadStaff());
  const [editingCell, setEditingCell] = useState<{ date: string; staffId: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [newStaffName, setNewStaffName] = useState('');
  const [showAddStaff, setShowAddStaff] = useState(false);

  const clinicData = useMemo(() => loadClinicData(), [refreshKey]);
  const allShifts = useMemo(() => loadShifts(), [refreshKey]);
  const daysInMonth = getDaysInMonth(year, month);
  const holidays = useMemo(() => getHolidays(year), [year]);
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  const refresh = () => setRefreshKey(k => k + 1);

  const prevMonth = () => {
    const newY = month === 1 ? year - 1 : year;
    const newM = month === 1 ? 12 : month - 1;
    setYear(newY); setMonth(newM);
    saveCurrentMonth(newY, newM);
  };

  const nextMonth = () => {
    const newY = month === 12 ? year + 1 : year;
    const newM = month === 12 ? 1 : month + 1;
    setYear(newY); setMonth(newM);
    saveCurrentMonth(newY, newM);
  };

  const setPattern = (date: string, staffId: string, pattern: ClinicShiftPattern) => {
    const data = loadClinicData();
    if (!data[monthKey]) data[monthKey] = {};
    if (!data[monthKey][date]) data[monthKey][date] = {};
    data[monthKey][date][staffId] = pattern;
    saveClinicData(data);

    // yotsuhashiの変更はカレンダーに自動同期
    if (staffId === 'yotsuhashi') {
      const day = getDay(date);
      if (pattern === 'off') {
        day.isOff = true;
        day.dayShift = null;
      } else if (pattern) {
        day.dayShift = 'eye';
        day.isOff = false;
      }
      saveDay(day);
    }

    setEditingCell(null);
    refresh();
  };

  // 四ツ橋の自動判定
  const getYotsuhashiPattern = (dateStr: string): ClinicShiftPattern => {
    const dow = new Date(dateStr).getDay();
    const prevDateStr = getPrevDate(dateStr);
    const prevDay = allShifts[prevDateStr];
    const hasNightShiftPrev = prevDay?.nightShift != null;

    // 日曜・祝日は休み
    if (dow === 0 || holidays.has(dateStr)) return 'off';

    // マイカレンダーで眼科が入っていない日は休み
    const thisDay = allShifts[dateStr];
    if (thisDay && thisDay.dayShift !== 'eye' && thisDay.isOff) return 'off';

    // 木曜・土曜は午前のみ
    if (dow === 4 || dow === 6) {
      return hasNightShiftPrev ? 'am_ten' : 'am';
    }

    // 月火水金 → 全日（前日夜勤なら10時〜付き）
    return hasNightShiftPrev ? 'am_pm_ten' : 'am_pm';
  };

  const getPattern = (date: string, staffId: string): ClinicShiftPattern => {
    // 四ツ橋は自動判定（手動上書き可能）
    const manual = clinicData[monthKey]?.[date]?.[staffId];
    if (manual !== undefined) return manual;
    if (staffId === 'yotsuhashi') return getYotsuhashiPattern(date);
    return null;
  };

  const addStaff = () => {
    if (!newStaffName.trim()) return;
    const id = `staff_${Date.now()}`;
    const updated = [...staffList, { id, name: newStaffName.trim() }];
    setStaffList(updated);
    saveStaff(updated);
    setNewStaffName('');
    setShowAddStaff(false);
  };

  const removeStaff = (id: string) => {
    if (id === 'yotsuhashi') return;
    const updated = staffList.filter(s => s.id !== id);
    setStaffList(updated);
    saveStaff(updated);
  };

  // 四ツ橋のシフトをカレンダーに反映
  const syncToCalendar = () => {
    let count = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = formatDate(year, month, d);
      const pattern = getPattern(dateStr, 'yotsuhashi');
      const day = getDay(dateStr);

      if (pattern === 'off') {
        day.isOff = true;
        day.dayShift = null;
      } else if (pattern && pattern !== null) {
        day.dayShift = 'eye';
        day.isOff = false;
      } else {
        continue;
      }
      saveDay(day);
      count++;
    }
    alert(`${year}年${month}月の${count}日分をカレンダーに反映しました`);
  };

  const [exporting, setExporting] = useState(false);

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const rows: { id: string; name: string; patterns: (ClinicShiftPattern)[] }[] = staffList.map(staff => ({
        id: staff.id,
        name: staff.name,
        patterns: Array.from({ length: daysInMonth }, (_, i) => {
          const dateStr = formatDate(year, month, i + 1);
          return getPattern(dateStr, staff.id);
        }),
      }));
      await generateClinicPDF(year, month, rows);
    } finally {
      setExporting(false);
    }
  };

  const patternOptions: { value: ClinicShiftPattern; label: string }[] = [
    { value: 'am', label: '午前' },
    { value: 'pm', label: '午後' },
    { value: 'am_pm', label: '全日' },
    { value: 'am_ten', label: '午前(10時)' },
    { value: 'am_pm_ten', label: '全日(10時)' },
    { value: 'late', label: '11:30' },
    { value: 'off', label: '休' },
    { value: null, label: 'クリア' },
  ];

  return (
    <div className="clinic-calendar">
      {/* ヘッダー */}
      <div className="cal-header">
        <button className="cal-nav-btn" onClick={prevMonth}>◀</button>
        <span className="cal-title">{year}年 {month}月 眼科</span>
        <button className="cal-nav-btn" onClick={nextMonth}>▶</button>
      </div>

      <div className="clinic-actions">
        <button className="clinic-pdf-btn" onClick={syncToCalendar}>カレンダーに反映</button>
        <button className="clinic-pdf-btn" onClick={handleExportPDF} disabled={exporting}>
          {exporting ? '出力中...' : 'PDF出力'}
        </button>
        <button className="clinic-staff-btn" onClick={() => setShowAddStaff(!showAddStaff)}>スタッフ管理</button>
      </div>

      {showAddStaff && (
        <div className="staff-manager">
          {staffList.map(s => (
            <div key={s.id} className="staff-item">
              <span>{s.name}</span>
              {s.id !== 'yotsuhashi' && (
                <button className="staff-remove-btn" onClick={() => removeStaff(s.id)}>×</button>
              )}
            </div>
          ))}
          <div className="staff-add-form">
            <input
              type="text"
              placeholder="スタッフ名"
              value={newStaffName}
              onChange={e => setNewStaffName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addStaff()}
            />
            <button onClick={addStaff}>追加</button>
          </div>
        </div>
      )}

      {/* テーブル */}
      <div className="clinic-table-wrap">
        <table className="clinic-table">
          <thead>
            <tr>
              <th className="clinic-th-name">名前</th>
              {Array.from({ length: daysInMonth }, (_, i) => {
                const d = i + 1;
                const dateStr = formatDate(year, month, d);
                const dow = new Date(year, month - 1, d).getDay();
                const holidayName = holidays.get(dateStr);
                const isHoliday = !!holidayName;
                const isRed = dow === 0 || isHoliday;
                const isBlue = dow === 4 || dow === 6; // 木・土
                return (
                  <th key={d} className={`clinic-th-day ${isRed ? 'clinic-th-holiday' : isBlue ? 'clinic-th-blue' : ''}`}>
                    <div>{d}</div>
                    <div className="clinic-th-dow">{WEEKDAY_LABELS[dow]}</div>
                    {holidayName && <div className="clinic-th-holiday-name">{holidayName}</div>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {staffList.map(staff => (
              <tr key={staff.id} style={{ background: staff.name === '四ツ橋' ? 'rgba(187,222,251,0.15)' : staff.name === '玉城' ? 'rgba(255,205,210,0.15)' : undefined }}>
                <td className="clinic-td-name" style={{ background: staff.name === '四ツ橋' ? 'rgba(187,222,251,0.4)' : staff.name === '玉城' ? 'rgba(255,205,210,0.4)' : undefined }}>{staff.name}</td>
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const d = i + 1;
                  const dateStr = formatDate(year, month, d);
                  const pattern = getPattern(dateStr, staff.id);
                  const isEditing = editingCell?.date === dateStr && editingCell?.staffId === staff.id;

                  const block = pattern ? BLOCK_CONFIG[pattern] : null;
                  // スタッフ別カラー
                  let blockBg = block?.bg;
                  let blockColor = block?.color;
                  if (block && staff.name === '四ツ橋') {
                    blockBg = '#E3F2FD';
                    blockColor = '#333';
                  } else if (block && staff.name === '玉城') {
                    blockBg = '#FCE4EC';
                    blockColor = '#333';
                  }
                  return (
                    <td
                      key={d}
                      className={`clinic-td-shift ${isEditing ? 'clinic-td-editing' : ''}`}
                      onClick={() => setEditingCell({ date: dateStr, staffId: staff.id })}
                    >
                      {block && (
                        <div className="clinic-block" style={{ background: blockBg, color: blockColor }}>
                          <div className="clinic-block-line1">{block.line1}</div>
                          {block.line2 && <div className="clinic-block-line2">{block.line2}</div>}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* シフト入力オーバーレイ */}
      {editingCell && (
        <div className="shift-editor-overlay" onClick={() => setEditingCell(null)}>
          <div className="shift-editor" onClick={e => e.stopPropagation()}>
            <div className="shift-editor-header">
              <span>
                {staffList.find(s => s.id === editingCell.staffId)?.name} — {parseInt(editingCell.date.slice(8))}日({WEEKDAY_LABELS[new Date(editingCell.date).getDay()]})
              </span>
              <button onClick={() => setEditingCell(null)}>✕</button>
            </div>
            <div className="clinic-overlay-options">
              {patternOptions.map(opt => (
                <button
                  key={String(opt.value)}
                  className={`shift-btn ${getPattern(editingCell.date, editingCell.staffId) === opt.value ? 'active' : ''}`}
                  style={opt.value ? {
                    ...(getPattern(editingCell.date, editingCell.staffId) === opt.value
                      ? { background: PATTERN_COLORS[opt.value], color: '#fff' }
                      : {}),
                  } : {}}
                  onClick={() => setPattern(editingCell.date, editingCell.staffId, opt.value)}
                >
                  {opt.value && <span className="clinic-legend-dot" style={{ background: PATTERN_COLORS[opt.value] }} />}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 凡例 */}
      <div className="clinic-legend">
        {Object.entries(PATTERN_LABELS).map(([key, label]) => (
          <span key={key} className="clinic-legend-item">
            <span className="clinic-legend-dot" style={{ background: PATTERN_COLORS[key] }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
