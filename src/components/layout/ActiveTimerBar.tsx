import { useEffect, useState } from 'react';
import { useDataStore } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';
import { formatRunningDuration } from '../../lib/timeTracking';

export default function ActiveTimerBar() {
  const timer = useDataStore((s) => s.activeTimer); const projects = useDataStore((s) => s.projects) || []; const cache = useDataStore((s) => s.cache); const stopTimer = useDataStore((s) => s.stopTimer); const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!timer) return; const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, [timer]);
  if (!timer) return null;
  const project = projects.find((item) => item.id === timer.projectId); const task = timer.taskId ? cache[timer.projectId]?.tasks.find((item) => item.id === timer.taskId) : null;
  return <div className="active-timer-bar"><button className="active-timer-target" onClick={() => useUiStore.setState({ view: 'project', selectedId: timer.projectId, activeTab: timer.taskId ? 'aufgaben' : 'auswertung' })}><span className="timer-pulse" /><strong>{formatRunningDuration(timer.startedAt, now)}</strong><span>{project?.name || 'Projekt'}{task ? ` · ${task.titel}` : ' · Allgemeine Projektzeit'}</span></button><button className="active-timer-stop" onClick={stopTimer}>■ Stoppen</button></div>;
}
