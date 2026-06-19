import { useRef } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

// 入力欄は常に存在させ、空のときは「時間を入力」ボタンで覆う。
// ボタンのクリック（＝ユーザー操作）から直接showPickerを呼ぶのでピッカーが確実に開く。
export default function TimeField({ value, onChange, placeholder }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="time-field">
      <input
        ref={inputRef}
        type="time"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="detail-input-time"
      />
      {value ? (
        <button
          type="button"
          className="time-field-clear"
          onClick={() => onChange('')}
        >
          終日
        </button>
      ) : (
        <button
          type="button"
          className="time-field-empty"
          onClick={() => {
            const el = inputRef.current;
            if (!el) return;
            el.focus();
            try {
              (el as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
            } catch {
              /* showPicker非対応ブラウザはfocusのみ */
            }
          }}
        >
          🕐 {placeholder}
        </button>
      )}
    </div>
  );
}
