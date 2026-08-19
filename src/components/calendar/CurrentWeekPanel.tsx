import { dateKey, getWeekDates, startOfWeek, WEEKDAY_LABELS } from '../../lib/calendar';
import { isoWeekInfo } from '../../lib/analytics';
import { openTaskInDashboard } from '../../lib/navigation';
import type { TaskWithMeta } from '../../store/dataStore';
import { useDataStore } from '../../store/dataStore';
import { compareTaskColors } from '../../lib/taskColors';

export default function CurrentWeekPanel({ tasksWithDate }: { tasksWithDate: TaskWithMeta[] }) {
  const colorOrder = useDataStore((state) => state.taskColorOrder);
  const today = new Date();
  const monday = startOfWeek(today);
  const days = getWeekDates(monday);
  const todayKey = dateKey(today);
  const { year, week } = isoWeekInfo(today.toISOString());

  const byDay: Record<string, TaskWithMeta[]> = {};
  tasksWithDate.forEach((t) => {
    (byDay[t.faelligAm] = byDay[t.faelligAm] || []).push(t);
  });

  return (
    <div className="current-week-panel">
      <div className="current-week-head">
        <h3>Diese Woche</h3>
        <span className="current-week-kw">
          KW {week} · {year}
        </span>
      </div>
      <div className="current-week-grid">
        {days.map((d, i) => {
          const key = dateKey(d);
          const dayTasks = (byDay[key] || [])
            .slice()
            .sort((a, b) => compareTaskColors(a, b, colorOrder));
          const isToday = key === todayKey;
          return (
            <div className={`current-week-day${isToday ? ' today' : ''}`} key={key}>
              <div className="current-week-day-head">
                <span className="current-week-weekday">{WEEKDAY_LABELS[i]}</span>
                <span className="current-week-date">
                  {d.getDate()}.{d.getMonth() + 1}.
                </span>
              </div>
              {dayTasks.length === 0 ? (
                <div className="current-week-empty">–</div>
              ) : (
                <div className="current-week-tasks">
                  {dayTasks.map((t) => (
                    <div
                      key={t.id}
                      className={`current-week-task${t.farbe ? ` task-color-border-${t.farbe}` : ''}`}
                      title={`${t.projectName}: ${t.titel}`}
                      onClick={() => openTaskInDashboard(t.id)}
                    >
                      <span className="current-week-task-title">{t.titel}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
