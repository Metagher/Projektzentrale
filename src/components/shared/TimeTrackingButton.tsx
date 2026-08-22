import { useEffect, useState } from 'react';
import { useDataStore } from '../../store/dataStore';
import { formatRunningDuration } from '../../lib/timeTracking';

export default function TimeTrackingButton({ projectId, taskId = null, compact = false }: { projectId: string; taskId?: string | null; compact?: boolean }) {
  const timer = useDataStore((s) => s.activeTimer);
  const startTimer = useDataStore((s) => s.startTimer);
  const stopTimer = useDataStore((s) => s.stopTimer);
  const [now, setNow] = useState(Date.now());
  const active = timer?.projectId === projectId && timer.taskId === taskId;
  useEffect(() => { if (!active) return; const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, [active]);
  return <button type="button" className={`time-tracking-btn${active ? ' active' : ''}${compact ? ' compact' : ''}`} onClick={(event) => { event.stopPropagation(); if (active) void stopTimer(); else void startTimer(projectId, taskId); }} title={active ? 'Zeiterfassung stoppen' : timer ? 'Hier starten und laufenden Timer beenden' : 'Zeiterfassung starten'}>
    <span aria-hidden="true">{active ? '■' : '▶'}</span>{active ? formatRunningDuration(timer.startedAt, now) : compact ? 'Zeit' : 'Zeit starten'}
  </button>;
}
