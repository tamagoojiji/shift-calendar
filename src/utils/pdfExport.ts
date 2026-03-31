import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { ClinicShiftPattern } from '../types';
import { getFirstDayOfWeek, WEEKDAY_LABELS } from './dateUtils';

const PATTERN_LABELS: Record<string, string> = {
  am: '午前',
  pm: '午後',
  am_pm: '全日',
  am_ten: '午前(10時〜)',
  am_pm_ten: '全日(10時〜)',
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

const BLOCK_BG: Record<string, string> = {
  am: '#FCE4EC',
  pm: '#FFF3E0',
  am_pm: '#FCE4EC',
  am_ten: '#FCE4EC',
  am_pm_ten: '#FCE4EC',
  late: '#F3E5F5',
  off: '#F5F5F5',
};


export async function generateClinicPDF(
  year: number,
  month: number,
  rows: { id: string; name: string; patterns: (ClinicShiftPattern)[] }[]
) {
  const daysInMonth = rows[0]?.patterns.length || 30;
  const firstDow = getFirstDayOfWeek(year, month);

  // 週ごとにグループ化（日曜始まり）
  const weeks: (number | null)[][] = [];
  let currentWeek: (number | null)[] = [];

  // 月初の空白
  for (let i = 0; i < firstDow; i++) {
    currentWeek.push(null);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    currentWeek.push(d);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  // HTMLを生成
  const container = document.createElement('div');
  container.style.cssText = `
    position: absolute; left: -9999px; top: 0;
    width: 780px; background: #fff; padding: 16px;
    font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif;
  `;

  // タイトル
  const title = document.createElement('div');
  title.style.cssText = 'font-size: 18px; font-weight: 700; margin-bottom: 12px; text-align: center;';
  title.textContent = `${year}年 ${month}月 勤務表`;
  container.appendChild(title);

  // カレンダーテーブル
  const table = document.createElement('table');
  table.style.cssText = 'width: 100%; border-collapse: collapse; table-layout: fixed;';

  // 曜日ヘッダー
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  WEEKDAY_LABELS.forEach((label, i) => {
    const th = document.createElement('th');
    th.style.cssText = `
      padding: 6px 2px; text-align: center; font-size: 12px; font-weight: 600;
      background: #fce4ec; border: 1px solid #ddd;
      color: ${i === 0 ? '#E91E63' : i === 6 ? '#2196F3' : '#333'};
    `;
    th.textContent = label;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // 週ごとの行
  const tbody = document.createElement('tbody');
  weeks.forEach(week => {
    const tr = document.createElement('tr');
    week.forEach((day, dowIndex) => {
      const td = document.createElement('td');
      td.style.cssText = `
        border: 1px solid #ddd; vertical-align: top; padding: 3px 4px;
        height: ${rows.length <= 2 ? '80px' : '60px'}; font-size: 11px;
      `;

      if (day !== null) {
        // 日付
        const dateDiv = document.createElement('div');
        dateDiv.style.cssText = `
          font-size: 13px; font-weight: 700; margin-bottom: 2px;
          color: ${dowIndex === 0 ? '#E91E63' : dowIndex === 6 ? '#2196F3' : '#333'};
        `;
        dateDiv.textContent = String(day);
        td.appendChild(dateDiv);

        // 各スタッフのシフト（ブロック形式）
        rows.forEach(staff => {
          const pattern = staff.patterns[day - 1];
          if (pattern) {
            const shiftDiv = document.createElement('div');
            let textColor = PATTERN_COLORS[pattern] || '#333';
            let bgColor = BLOCK_BG[pattern] || '#f5f5f5';

            if (staff.name === '四ツ橋') {
              textColor = '#333';
              bgColor = '#E3F2FD';
            } else if (staff.name === '玉城') {
              textColor = '#333';
              bgColor = '#FCE4EC';
            }

            shiftDiv.style.cssText = `
              font-size: 9px; font-weight: 600; line-height: 1.3;
              color: ${textColor};
              background: ${bgColor};
              border-radius: 2px;
              padding: 2px 3px;
              margin-top: 2px;
            `;
            shiftDiv.textContent = `${staff.name}: ${PATTERN_LABELS[pattern] || ''}`;
            td.appendChild(shiftDiv);
          }
        });
      }

      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);


  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, { scale: 2, useCORS: true });

    // A5横向き
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5' });
    const pageWidth = 210;
    const pageHeight = 148;
    const margin = 5;
    const maxWidth = pageWidth - margin * 2;
    const maxHeight = pageHeight - margin * 2;

    const imgRatio = canvas.width / canvas.height;
    let imgWidth = maxWidth;
    let imgHeight = imgWidth / imgRatio;

    if (imgHeight > maxHeight) {
      imgHeight = maxHeight;
      imgWidth = imgHeight * imgRatio;
    }

    const x = (pageWidth - imgWidth) / 2;
    const y = (pageHeight - imgHeight) / 2;

    const imgData = canvas.toDataURL('image/png');
    doc.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
    doc.save(`clinic_${year}_${String(month).padStart(2, '0')}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
