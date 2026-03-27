import jsPDF from 'jspdf';
import type { ClinicShiftPattern } from '../types';
import { WEEKDAY_LABELS } from './dateUtils';

const PATTERN_LABELS: Record<string, string> = {
  am: '午前',
  pm: '午後',
  am_pm: '全日',
  late: '11:30',
  off: '休',
};

export function generateClinicPDF(
  year: number,
  month: number,
  rows: { name: string; patterns: (ClinicShiftPattern)[] }[]
) {
  // A5横向き (210mm x 148mm)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5' });

  const daysInMonth = rows[0]?.patterns.length || 30;
  const marginLeft = 5;
  const marginTop = 12;
  const nameColWidth = 18;
  const cellWidth = (210 - marginLeft - nameColWidth - 3) / daysInMonth;
  const cellHeight = 8;
  const headerHeight = 10;

  // フォント設定（日本語対応のため基本文字のみ）
  doc.setFontSize(10);

  // タイトル
  doc.setFontSize(11);
  doc.text(`${year}/${month}`, marginLeft, 8);
  doc.setFontSize(6);

  // ヘッダー（日付行）
  const tableTop = marginTop;
  doc.setFillColor(240, 240, 240);
  doc.rect(marginLeft, tableTop, nameColWidth + cellWidth * daysInMonth, headerHeight, 'F');

  for (let d = 0; d < daysInMonth; d++) {
    const x = marginLeft + nameColWidth + d * cellWidth;
    const dow = new Date(year, month - 1, d + 1).getDay();
    const dayNum = String(d + 1);
    const dowLabel = WEEKDAY_LABELS[dow];

    // 日曜は赤、土曜は青
    if (dow === 0) doc.setTextColor(220, 50, 50);
    else if (dow === 6) doc.setTextColor(50, 50, 220);
    else doc.setTextColor(0, 0, 0);

    doc.text(dayNum, x + cellWidth / 2, tableTop + 4, { align: 'center' });
    doc.text(dowLabel, x + cellWidth / 2, tableTop + 8, { align: 'center' });
  }

  // データ行
  doc.setTextColor(0, 0, 0);
  rows.forEach((row, rowIndex) => {
    const y = tableTop + headerHeight + rowIndex * cellHeight;

    // 名前
    doc.setFontSize(6);
    doc.text(row.name, marginLeft + 1, y + cellHeight / 2 + 1);

    // セル
    for (let d = 0; d < daysInMonth; d++) {
      const x = marginLeft + nameColWidth + d * cellWidth;
      const pattern = row.patterns[d];

      // セル枠線
      doc.setDrawColor(200, 200, 200);
      doc.rect(x, y, cellWidth, cellHeight);

      if (pattern) {
        const label = PATTERN_LABELS[pattern] || '';
        doc.setFontSize(5);
        doc.text(label, x + cellWidth / 2, y + cellHeight / 2 + 1, { align: 'center' });
      }
    }
  });

  // 外枠
  const tableHeight = headerHeight + rows.length * cellHeight;
  doc.setDrawColor(100, 100, 100);
  doc.rect(marginLeft, tableTop, nameColWidth + cellWidth * daysInMonth, tableHeight);

  // 名前列の右線
  doc.line(marginLeft + nameColWidth, tableTop, marginLeft + nameColWidth, tableTop + tableHeight);

  doc.save(`clinic_${year}_${String(month).padStart(2, '0')}.pdf`);
}
