import { useState, useEffect } from 'react';
import type { TabType } from './types';
import type { User } from 'firebase/auth';
import MonthCalendar from './components/MonthCalendar';
import ClinicCalendar from './components/ClinicCalendar';
import ShiftImport from './components/ShiftImport';
import Settings from './components/Settings';
import { onAuthChange, loginWithGoogle, handleRedirectResult, loadShiftsFromFirestore, loadClinicFromFirestore, loadStaffFromFirestore, loadSettingsFromFirestore } from './utils/firebase';
import { setCurrentUid, restoreToLocal } from './utils/storage';

export default function App() {
  const [tab, setTab] = useState<TabType>('calendar');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // リダイレクトログインの結果を処理
    handleRedirectResult();

    const unsubscribe = onAuthChange(async (u) => {
      setUser(u);
      if (u) {
        setCurrentUid(u.uid);
        // Firestoreからデータ復元（localStorageが空の場合）
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

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (err) {
      console.error('Login error:', err);
    }
  };

  if (loading) {
    return (
      <div className="login-screen">
        <div className="login-loading">読み込み中...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <h1 className="login-title">勤務表カレンダー</h1>
          <p className="login-desc">シフト管理をもっと簡単に</p>
          <button className="login-btn" onClick={handleLogin}>
            Googleでログイン
          </button>
        </div>
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
