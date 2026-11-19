import type { CSSProperties } from 'react';
import { useThemeColors } from '../lib/theme';

interface ChangeEvent {
  type: 'set' | 'dismissed';
}

interface Props {
  value: Date;
  mode?: 'date' | 'datetime' | 'time';
  display?: string;
  onChange: (event: ChangeEvent, selected?: Date) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

function toInputValue(date: Date, mode: Props['mode']): string {
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  if (mode === 'time') {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  if (mode === 'datetime') {
    return `${y}-${m}-${d}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  return `${y}-${m}-${d}`;
}

function fromInputValue(raw: string, previous: Date, mode: Props['mode']): Date | undefined {
  if (!raw) return undefined;
  if (mode === 'time') {
    const [h, min] = raw.split(':').map(Number);
    const next = new Date(previous);
    next.setHours(h, min, 0, 0);
    return next;
  }
  if (mode === 'datetime') {
    const next = new Date(raw);
    return Number.isNaN(next.getTime()) ? undefined : next;
  }
  const [y, m, d] = raw.split('-').map(Number);
  const next = new Date(previous);
  next.setFullYear(y, m - 1, d);
  return next;
}

// Web has no native picker UI to match @react-native-community/datetimepicker,
// so this renders a plain HTML date/datetime input with the same value/mode/
// onChange contract the call sites already use.
export default function DateTimePickerCompat({ value, mode = 'date', onChange }: Props) {
  const c = useThemeColors();
  const style: CSSProperties = {
    fontSize: 15,
    padding: '10px 12px',
    borderRadius: 8,
    border: `1px solid ${c.border}`,
    backgroundColor: c.surface,
    color: c.text,
    marginTop: 8,
    marginBottom: 8,
  };

  return (
    <input
      type={mode === 'time' ? 'time' : mode === 'datetime' ? 'datetime-local' : 'date'}
      value={toInputValue(value, mode)}
      autoFocus
      onChange={(e) => {
        const selected = fromInputValue(e.target.value, value, mode);
        onChange({ type: selected ? 'set' : 'dismissed' }, selected);
      }}
      style={style}
    />
  );
}
