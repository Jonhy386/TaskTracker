import { useEffect, useState } from 'react';
import { Text, type TextStyle } from 'react-native';
import { formatDuration } from '../lib/format';

// Ticks visually every second, but the source of truth is always
// (now - startTime); nothing here is relied on for the persisted duration.
export function ElapsedTime({ startTime, style }: { startTime: string; style?: TextStyle }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const elapsedSeconds = Math.max(0, Math.round((now - new Date(startTime).getTime()) / 1000));

  return <Text style={style}>{formatDuration(elapsedSeconds)}</Text>;
}
