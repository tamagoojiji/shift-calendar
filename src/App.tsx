import { useState, useEffect } from 'react';
import type { TabType } from './types';
import MonthCalendar from './components/MonthCalendar';
import ClinicCalendar from './components/ClinicCalendar';
import ShiftImport from './components/ShiftImport';
import Settings from './components/Settings';
import { onAuthChange, loadShiftsFromFirestore, loadClinicFromFirestore, loadStaffFromFirestore, loadSettingsFromFirestore, loadSharedConfig } from './utils/firebase';
import { setCurrentUid, restoreToLocal } from './utils/storage';

export default function App() {
  const [tab, setTab] = useState<TabType>('calendar');
  const [loading, setLoading] = useState(true);
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    // 3秒でタイムアウト（Firebase初期化が遅い場合）
    const timeout = setTimeout(() => setLoading(false), 3000);

    const unsubscribe = onAuthChange(async (u) => {
      clearTimeout(timeout);
      if (u) {
        setCurrentUid(u.uid);
        try {
          const shifts = await loadShiftsFromFirestore(u.uid);
          const clinic = await loadClinicFromFirestore(u.uid);
          const staff = await loadStaffFromFirestore(u.uid);
          const settings = await loadSettingsFromFirestore(u.uid);
          restoreToLocal(shifts, clinic, staff);
          // APIキー: ユーザー個別設定 → 共有設定の優先順位で取得
          if (settings.geminiKey) {
            localStorage.setItem('shift_gemini_key', settings.geminiKey);
          } else {
            try {
              const shared = await loadSharedConfig();
              if (shared.apiKey) {
                localStorage.setItem('shift_gemini_key', shared.apiKey);
              }
            } catch (e) {
              console.error('Shared config load error:', e);
            }
          }
          // Firestore復元後にコンポーネントを再マウントさせる
          setDataVersion(v => v + 1);
        } catch (err) {
          console.error('Firestore restore error:', err);
        }
      } else {
        setCurrentUid(null);
      }
      setLoading(false);
    });
    return () => { unsubscribe(); clearTimeout(timeout); };
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
        {tab === 'calendar' && <MonthCalendar key={dataVersion} />}
        {tab === 'clinic' && <ClinicCalendar key={dataVersion} />}
        {tab === 'import' && <ShiftImport key={dataVersion} />}
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
