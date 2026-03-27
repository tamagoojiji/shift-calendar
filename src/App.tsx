import { useState } from 'react';
import type { TabType } from './types';
import MonthCalendar from './components/MonthCalendar';
import ClinicCalendar from './components/ClinicCalendar';
import ShiftImport from './components/ShiftImport';
import Settings from './components/Settings';

export default function App() {
  const [tab, setTab] = useState<TabType>('calendar');

  return (
    <div className="app">
      <div className="app-content">
        {tab === 'calendar' && <MonthCalendar />}
        {tab === 'clinic' && <ClinicCalendar />}
        {tab === 'import' && <ShiftImport />}
        {tab === 'settings' && <Settings />}
      </div>

      <nav className="bottom-nav">
        <button
          className={`nav-item ${tab === 'calendar' ? 'active' : ''}`}
          onClick={() => setTab('calendar')}
        >
          <span className="nav-icon">📅</span>
          <span className="nav-label">カレンダー</span>
        </button>
        <button
          className={`nav-item ${tab === 'clinic' ? 'active' : ''}`}
          onClick={() => setTab('clinic')}
        >
          <span className="nav-icon">🏥</span>
          <span className="nav-label">眼科</span>
        </button>
        <button
          className={`nav-item ${tab === 'import' ? 'active' : ''}`}
          onClick={() => setTab('import')}
        >
          <span className="nav-icon">📷</span>
          <span className="nav-label">読込</span>
        </button>
        <button
          className={`nav-item ${tab === 'settings' ? 'active' : ''}`}
          onClick={() => setTab('settings')}
        >
          <span className="nav-icon">⚙️</span>
          <span className="nav-label">設定</span>
        </button>
      </nav>
    </div>
  );
}
