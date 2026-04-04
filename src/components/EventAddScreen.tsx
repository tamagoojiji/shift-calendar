import { useState, useRef, useCallback } from 'react';
import type { DetailItem } from '../types';
import { getDay, saveDay } from '../utils/storage';
import { analyzeEventImage, getGeminiApiKey } from '../utils/gemini';

interface Props {
  dateStr: string;
  onSave: () => void;
  onClose: () => void;
}

export default function EventAddScreen({ dateStr, onSave, onClose }: Props) {
  const [date, setDate] = useState(dateStr);
  const [time, setTime] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [repeatType, setRepeatType] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);

  const handleCompositionStart = useCallback(() => { composingRef.current = true; }, []);
  const handleCompositionEnd = useCallback(() => { composingRef.current = false; }, []);

  const handleSave = () => {
    if (!content.trim()) return;
    const trimContent = content.trim();
    const trimUrl = url.trim() || undefined;

    if (rangeEnd && rangeEnd >= date) {
      const start = new Date(date);
      const end = new Date(rangeEnd);
      let count = 0;

      const addToDate = (ds: string) => {
        const targetDay = getDay(ds);
        const item: DetailItem = {
          id: Date.now().toString() + '_' + count,
          time,
          content: trimContent,
          ...(trimUrl && { url: trimUrl }),
        };
        targetDay.details = [...(targetDay.details || []), item];
        saveDay(targetDay);
        count++;
      };

      if (repeatType === 'daily') {
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          addToDate(d.toISOString().slice(0, 10));
        }
      } else if (repeatType === 'weekly') {
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
          addToDate(d.toISOString().slice(0, 10));
        }
      } else if (repeatType === 'monthly') {
        const dayOfMonth = start.getDate();
        for (let d = new Date(start); d <= end; ) {
          addToDate(d.toISOString().slice(0, 10));
          d.setMonth(d.getMonth() + 1);
          d.setDate(dayOfMonth);
        }
      } else if (repeatType === 'yearly') {
        for (let d = new Date(start); d <= end; ) {
          addToDate(d.toISOString().slice(0, 10));
          d.setFullYear(d.getFullYear() + 1);
        }
      }
    } else {
      const targetDay = getDay(date);
      const item: DetailItem = {
        id: Date.now().toString(),
        time,
        content: trimContent,
        ...(trimUrl && { url: trimUrl }),
      };
      targetDay.details = [...(targetDay.details || []), item];
      saveDay(targetDay);
    }

    onSave();
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportError(null);

    try {
      const apiKey = getGeminiApiKey();
      const base64 = await fileToBase64(file);
      const data = await analyzeEventImage(apiKey, base64, file.type);
      const events: { date: string; time: string; content: string; url: string }[] = data.events || [];

      if (events.length === 0) {
        setImportError('イベント情報を読み取れませんでした');
        return;
      }

      // 1件目をフォームにセット
      const first = events[0];
      if (first.date) setDate(first.date);
      if (first.time) setTime(first.time);
      if (first.content) setContent(first.content);
      if (first.url) setUrl(first.url);

      // 複数件の場合は残りを一括登録
      if (events.length > 1) {
        const rest = events.slice(1);
        const doBulk = confirm(`他${rest.length}件も一括登録しますか？`);
        if (doBulk) {
          let count = 0;
          rest.forEach((evt) => {
            const targetDate = evt.date || dateStr;
            const targetDay = getDay(targetDate);
            const item: DetailItem = {
              id: Date.now().toString() + '_b' + count,
              time: evt.time || '',
              content: evt.content || '',
              ...(evt.url && { url: evt.url }),
            };
            targetDay.details = [...(targetDay.details || []), item];
            saveDay(targetDay);
            count++;
          });
          if (count > 0) {
            alert(`${count}件のイベントを追加登録しました`);
            onSave();
            return;
          }
        }
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : '読み取りに失敗しました');
    } finally {
      setImporting(false);
      if (imageRef.current) imageRef.current.value = '';
    }
  };

  return (
    <div className="event-add-screen">
      <div className="event-add-header">
        <button className="event-add-back" onClick={onClose}>← 戻る</button>
        <span className="event-add-title">予定を追加</span>
      </div>

      <div className="event-add-body">
        {/* 日付 + 時間 横並び */}
        <div className="event-add-date-time-row">
          <div className="event-add-field">
            <label className="event-add-label">📅 日付</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="detail-input-date"
            />
          </div>
          <div className="event-add-field">
            <label className="event-add-label">🕐 時間</label>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="detail-input-time"
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {/* 内容 */}
        <div className="event-add-field">
          <label className="event-add-label">予定内容</label>
          <input
            type="text"
            placeholder="予定内容を入力"
            value={content}
            onChange={e => setContent(e.target.value)}
            className="detail-input-content"
            style={{ width: '100%', minWidth: 0 }}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            onKeyDown={e => { if (e.key === 'Enter' && !composingRef.current) handleSave(); }}
            autoFocus
          />
        </div>

        {/* URL */}
        <div className="event-add-field">
          <label className="event-add-label">URL（任意）</label>
          <input
            type="url"
            placeholder="https://..."
            value={url}
            onChange={e => setUrl(e.target.value)}
            className="detail-input-url"
          />
        </div>

        {/* 画像OCR */}
        <button
          className="event-add-image-btn"
          onClick={() => imageRef.current?.click()}
          disabled={importing}
        >
          {importing ? '読取中...' : '📷 画像から読み取り'}
        </button>
        <input
          ref={imageRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          hidden
        />
        {importError && (
          <div className="detail-import-error">{importError}</div>
        )}

        {/* 期間指定 */}
        <div className="detail-range-row">
          <label className="event-add-label">期間指定</label>
          <div className="detail-repeat-btns">
            {([['daily', '毎日'], ['weekly', '毎週'], ['monthly', '毎月'], ['yearly', '毎年']] as const).map(([val, label]) => (
              <button
                key={val}
                className={`detail-repeat-btn ${repeatType === val ? 'active' : ''}`}
                onClick={() => setRepeatType(val)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="detail-range-dates">
            <span className="detail-range-label">{date.slice(5).replace('-', '/')}</span>
            <span>〜</span>
            <input
              type="date"
              value={rangeEnd}
              min={date}
              onChange={e => setRangeEnd(e.target.value)}
              className="detail-input-date"
            />
          </div>
        </div>

        {/* 保存ボタン */}
        <button className="detail-save-btn" style={{ width: '100%', marginTop: 8 }} onClick={handleSave}>保存</button>
      </div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
