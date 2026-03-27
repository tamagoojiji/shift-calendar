import { useState, useMemo } from 'react';
import type { ClinicShiftPattern, Staff } from '../types';
import { getDaysInMonth, formatDate, getToday, WEEKDAY_LABELS, getPrevDate } from '../utils/dateUtils';
import { loadClinicData, saveClinicData, loadStaff, saveStaff, loadShifts } from '../utils/storage';
import { generateClinicPDF } from '../utils/pdfExport';

const PATTERN_LABELS: Record<string, string> = {
  am: '午前',
  pm: '午後',
  am_pm: '全日',
  late: '11:30',
  ten: '10時〜',
  off: '休',
};

const PATTERN_COLORS: Record<string, string> = {
  am: '#E91E63',
  pm: '#FF9800',
  am_pm: '#E91E63',
  late: '#9C27B0',
  ten: '#00897B',
  off: '#9E9E9E',
};

export default function ClinicCalendar() {
  const today = getToday();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [staffList, setStaffList] = useState<Staff[]>(loadStaff());
  const [editingCell, setEditingCell] = useState<{ date: string; staffId: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [newStaffName, setNewStaffName] = useState('');
  const [showAddStaff, setShowAddStaff] = useState(false);

  const clinicData = useMemo(() => loadClinicData(), [refreshKey]);
  const allShifts = useMemo(() => loadShifts(), [refreshKey]);
  const daysInMonth = getDaysInMonth(year, month);
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  const refresh = () => setRefreshKey(k => k + 1);

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const setPattern = (date: string, staffId: string, pattern: ClinicShiftPattern) => {
    const data = loadClinicData();
    if (!data[monthKey]) data[monthKey] = {};
    if (!data[monthKey][date]) data[monthKey][date] = {};
    data[monthKey][date][staffId] = pattern;
    saveClinicData(data);
    setEditingCell(null);
    refresh();
  };

  // 四ツ橋の自動判定
  const getYotsuhashiPattern = (dateStr: string): ClinicShiftPattern => {
    const dow = new Date(dateStr).getDay();
    const prevDateStr = getPrevDate(dateStr);
    const prevDay = allShifts[prevDateStr];
    const hasNightShiftPrev = prevDay?.nightShift != null;

    // 木曜・土曜は午前のみ
    if (dow === 4 || dow === 6) return 'am';
    // 日曜は休み
    if (dow === 0) return 'off';

    // マイカレンダーで眼科が入っていない日は休み
    const thisDay = allShifts[dateStr];
    if (thisDay && thisDay.dayShift !== 'eye' && thisDay.isOff) return 'off';

    // 前日夜勤 → 10時〜
    if (hasNightShiftPrev) return 'ten';

    // 月火水金 → 全日
    return 'am_pm';
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

  const [exporting, setExporting] = useState(false);

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const rows: { name: string; patterns: (ClinicShiftPattern)[] }[] = staffList.map(staff => ({
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
    { value: 'ten', label: '10時〜' },
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
                const dow = new Date(year, month - 1, d).getDay();
                return (
                  <th key={d} className={`clinic-th-day ${dow === 0 ? 'cal-sun' : dow === 6 ? 'cal-sat' : ''}`}>
                    <div>{d}</div>
                    <div className="clinic-th-dow">{WEEKDAY_LABELS[dow]}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {staffList.map(staff => (
              <tr key={staff.id}>
                <td className="clinic-td-name">{staff.name}</td>
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const d = i + 1;
                  const dateStr = formatDate(year, month, d);
                  const pattern = getPattern(dateStr, staff.id);
                  const isEditing = editingCell?.date === dateStr && editingCell?.staffId === staff.id;

                  return (
                    <td
                      key={d}
                      className="clinic-td-shift"
                      onClick={() => setEditingCell({ date: dateStr, staffId: staff.id })}
                    >
                      {isEditing ? (
                        <div className="clinic-pattern-picker">
                          {patternOptions.map(opt => (
                            <button
                              key={String(opt.value)}
                              className="clinic-pattern-btn"
                              style={opt.value ? { background: PATTERN_COLORS[opt.value], color: '#fff' } : {}}
                              onClick={(e) => { e.stopPropagation(); setPattern(dateStr, staff.id, opt.value); }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      ) : (
                        pattern && (
                          <span
                            className="clinic-pattern-label"
                            style={{ color: PATTERN_COLORS[pattern] || '#333' }}
                          >
                            {PATTERN_LABELS[pattern] || ''}
                          </span>
                        )
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
