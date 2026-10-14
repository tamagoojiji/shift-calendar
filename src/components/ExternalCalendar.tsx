import { useState, useMemo, useCallback, useEffect } from 'react';
import { getDaysInMonth, getFirstDayOfWeek, formatDate, getToday, WEEKDAY_LABELS } from '../utils/dateUtils';
import { getSavedMonth, saveCurrentMonth } from '../utils/storage';
import { getHolidays } from '../utils/holidays';
import { useSwipe } from '../hooks/useSwipe';

interface ExternalDancer {
  name: string;
  role: string | null;
  times: string[];
}

interface ExternalEvent {
  date: string;
  show_name: string;
  times: string[];
  event_instagram_account: string | null;
  event_x_account: string | null;
  dancers: ExternalDancer[];
}

const API_URL = 'https://api.tamago-ai-world.com/dancers/external-events';
const TOKEN_KEY = 'external_events_token';
const CACHE_KEY = 'external_events_cache';
const EXTERNAL_COLOR = '#7E57C2';

function readStorage(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* noop */ }
}

function loadCache(): ExternalEvent[] {
  try {
    const raw = readStorage(CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

// 貼られた文字列が URL なら token クエリを、そうでなければ文字列そのものをトークンとして扱う
function extractToken(input: string): string {
  const s = input.trim();
  try {
    const t = new URL(s).searchParams.get('token');
    if (t) return t;
  } catch { /* URL ではない */ }
  return s;
}

// アカウント表記（URL / @handle / handle）をリンク先 URL に
function accountUrl(kind: 'X' | 'Instagram', v: string): string {
  if (/^https?:\/\//.test(v)) return v;
  const h = v.replace(/^@/, '');
  return kind === 'X' ? `https://x.com/${h}` : `https://www.instagram.com/${h}/`;
}

export default function ExternalCalendar() {
  const today = getToday();
  const saved = getSavedMonth();
  const [year, setYear] = useState(saved.year);
  const [month, setMonth] = useState(saved.month);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(() => readStorage(TOKEN_KEY));
  const [tokenInput, setTokenInput] = useState('');
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [events, setEvents] = useState<ExternalEvent[]>(loadCache);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // キャッシュで即描画済み。裏で再取得して差し替える
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}?token=${encodeURIComponent(token)}`);
        if (cancelled) return;
        if (res.status === 403) {
          writeStorage(TOKEN_KEY, null);
          setTokenError('トークンが無効です。URLを貼り直してください');
          setToken(null);
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const list: ExternalEvent[] = Array.isArray(data?.events) ? data.events : [];
        setEvents(list);
        writeStorage(CACHE_KEY, JSON.stringify(list));
        setFetchError(null);
      } catch (err) {
        if (cancelled) return;
        console.error('external events fetch error:', err);
        setFetchError('最新の情報を取得できませんでした（保存済みの情報を表示しています）');
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const saveToken = () => {
    const t = extractToken(tokenInput);
    if (!t) return;
    writeStorage(TOKEN_KEY, t);
    setTokenError(null);
    setTokenInput('');
    setToken(t);
  };

  const changeToken = () => {
    writeStorage(TOKEN_KEY, null);
    setTokenError(null);
    setToken(null);
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const holidays = useMemo(() => getHolidays(year), [year]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, ExternalEvent[]> = {};
    for (const ev of events) (map[ev.date] ||= []).push(ev);
    return map;
  }, [events]);

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

  const goToday = () => {
    const d = new Date();
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  const handleDateTap = (dateStr: string) => {
    setSelectedDate(selectedDate === dateStr ? null : dateStr);
  };

  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  const header = (
    <div className="cal-header">
      <div className="cal-header-left">
        <span className="cal-title">{monthNames[month - 1]} 外部</span>
        <span className="cal-year">{year}年</span>
      </div>
      {token && (
        <div className="cal-header-right">
          <button className="cal-today-btn" onClick={goToday}>今日</button>
          <button className="cal-nav-btn" onClick={prevMonth}>◀</button>
          <button className="cal-nav-btn" onClick={nextMonth}>▶</button>
        </div>
      )}
    </div>
  );

  // トークン未設定（または無効）時の設定カード
  if (!token) {
    return (
      <div className="month-calendar">
        {header}
        <div className="detail-panel">
          <div className="detail-header">
            <span className="detail-date">外部イベントの設定</span>
          </div>
          {tokenError && (
            <div style={{ color: '#D32F2F', fontSize: '14px', marginBottom: '8px' }}>{tokenError}</div>
          )}
          <div style={{ fontSize: '14px', color: '#333', lineHeight: '1.7', marginBottom: '8px' }}>
            ダンサー出演ボードのURLを貼り付けてください
          </div>
          <div className="detail-add-form">
            <input
              type="text"
              placeholder="https://..."
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveToken(); }}
              className="detail-input-content"
            />
            <button className="detail-save-btn" onClick={saveToken} disabled={!tokenInput.trim()}>保存</button>
          </div>
        </div>
      </div>
    );
  }

  const cells = [];
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
    const dayEvents = eventsByDate[dateStr] || [];
    const extraCount = dayEvents.length > 2 ? dayEvents.length - 2 : 0;

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
        {dayEvents.slice(0, 2).map(ev => (
          <div key={ev.show_name} className="cal-chip" style={{ background: EXTERNAL_COLOR }}>
            <span className="cal-chip-text">{ev.show_name}</span>
          </div>
        ))}
      </div>
    );
  }

  const selectedEvents = selectedDate ? eventsByDate[selectedDate] || [] : [];

  return (
    <div className="month-calendar">
      {header}

      {fetchError && (
        <div style={{ fontSize: '12px', color: '#D32F2F', padding: '0 16px 4px' }}>{fetchError}</div>
      )}

      <div className="cal-weekdays">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={label} className={`cal-weekday ${i === 0 ? 'cal-sun' : i === 6 ? 'cal-sat' : ''}`}>
            {label}
          </div>
        ))}
      </div>

      <div className="cal-grid-wrap">
        <div className="cal-grid" {...swipeHandlers}>
          {cells}
        </div>
      </div>

      <div style={{ textAlign: 'right', padding: '4px 16px' }}>
        <button
          onClick={changeToken}
          style={{ background: 'none', border: 'none', color: '#888', fontSize: '12px', textDecoration: 'underline', cursor: 'pointer' }}
        >
          トークンを変更
        </button>
      </div>

      {selectedDate && (
        <div className="detail-panel">
          <div className="detail-header">
            <span className="detail-date">
              {parseInt(selectedDate.slice(8))}日({WEEKDAY_LABELS[new Date(selectedDate).getDay()]})
            </span>
          </div>

          {selectedEvents.length === 0 && (
            <div className="detail-shift-empty">外部イベントはありません</div>
          )}

          {selectedEvents.map(ev => (
            <div key={ev.show_name} style={{ marginBottom: '12px' }}>
              <div className="detail-item">
                <div className="detail-item-time">{ev.times.length > 0 ? ev.times.join(' / ') : '時間未定'}</div>
                <div className="detail-item-content">
                  {ev.show_name}
                  {ev.times.length > 1 && `（${ev.times.length}回）`}
                </div>
              </div>
              {ev.dancers.length > 0 && (
                <div style={{ fontSize: '13px', color: '#444', lineHeight: '1.7', padding: '2px 8px' }}>
                  {ev.dancers.map(dn => (
                    <div key={dn.name}>
                      {dn.role ? `${dn.role}: ` : ''}{dn.name}
                      {dn.times.length > 0 && dn.times.length < ev.times.length && (
                        <span style={{ color: '#888' }}>（{dn.times.join(' / ')}）</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {ev.event_x_account && (
                <a className="detail-item-url" href={accountUrl('X', ev.event_x_account)} target="_blank" rel="noopener noreferrer">
                  🔗 X（公式）
                </a>
              )}
              {ev.event_instagram_account && (
                <a className="detail-item-url" href={accountUrl('Instagram', ev.event_instagram_account)} target="_blank" rel="noopener noreferrer">
                  🔗 Instagram（公式）
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
