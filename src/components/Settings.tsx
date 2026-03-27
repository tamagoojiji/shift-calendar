import { useState } from 'react';
import { SHIFT_COLORS } from '../types';

export default function Settings() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('shift_gemini_key') || '');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem('shift_gemini_key', apiKey.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearData = () => {
    if (confirm('全データを削除しますか？この操作は取り消せません。')) {
      localStorage.removeItem('shift_calendar_data');
      localStorage.removeItem('shift_clinic_data');
      alert('データを削除しました');
    }
  };

  return (
    <div className="settings">
      <h2 className="settings-title">設定</h2>

      {/* Gemini APIキー */}
      <div className="settings-section">
        <h3>Gemini APIキー</h3>
        <p className="settings-desc">画像読み取り（シフト・イベント）に使用します。</p>
        <input
          type="password"
          className="settings-input"
          placeholder="AIzaSy..."
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
        />
        <button className="settings-save-btn" onClick={handleSave}>
          {saved ? '保存しました' : '保存'}
        </button>
        {localStorage.getItem('shift_gemini_key') && (
          <div style={{ fontSize: '11px', color: '#4CAF50', marginTop: '4px' }}>設定済み</div>
        )}
      </div>

      {/* 色凡例 */}
      <div className="settings-section">
        <h3>色設定</h3>
        <div className="settings-colors">
          {Object.entries(SHIFT_COLORS).map(([key, color]) => (
            <div key={key} className="settings-color-item">
              <span className="settings-color-dot" style={{ background: color }} />
              <span>{
                key === 'eye' ? '眼科' :
                key === 'facility' ? '施設' :
                key === 'katano' ? '交野' :
                key === 'hirakata' ? '枚方' :
                key === 'kadoma' ? '門真' :
                key === 'moriguchi' ? '守口' :
                key === 'off' ? '休み' : key
              }</span>
            </div>
          ))}
        </div>
      </div>

      {/* データ管理 */}
      <div className="settings-section">
        <h3>データ管理</h3>
        <button className="settings-danger-btn" onClick={handleClearData}>
          全データ削除
        </button>
      </div>
    </div>
  );
}
