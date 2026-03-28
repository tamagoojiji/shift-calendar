import { useState, useEffect } from 'react';
import type { TabType } from './types';
import MonthCalendar from './components/MonthCalendar';
import ClinicCalendar from './components/ClinicCalendar';
import ShiftImport from './components/ShiftImport';
import Settings from './components/Settings';
import { onAuthChange, loadShiftsFromFirestore, loadClinicFromFirestore, loadStaffFromFirestore, loadSettingsFromFirestore } from './utils/firebase';
import { setCurrentUid, restoreToLocal } from './utils/storage';

export default function App() {
  const [tab, setTab] = useState<TabType>('calendar');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (u) => {
      if (u) {
        setCurrentUid(u.uid);
        try {
          const shifts = await loadShiftsFromFirestore(u.uid);
          const clinic = await loadClinicFromFirestore(u.uid);
          const staff = await loadStaffFromFirestore(u.uid);
          const settings = await loadSettingsFromFirestore(u.uid);
          restoreToLocal(shifts, clinic, staff);
          if (settings.geminiKey) {
            localStorage.setItem('shift_gemini_key', settings.geminiKey);
          }
        } catch (err) {
          console.error('Firestore restore error:', err);
        }
      } else {
        setCurrentUid(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="login-screen">
        <div className="login-loading">読み込み中...</div>
      </div>
    );
  }

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
