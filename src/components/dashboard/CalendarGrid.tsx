import { useUiStore } from '../../store/uiStore';
import { buildCalendarWeeks, dateKey, MONTH_NAMES, WEEKDAY_LABELS } from '../../lib/calendar';
import { slug } from '../../lib/format';
import type { TaskWithMeta } from '../../store/dataStore';

export default function CalendarGrid({ tasksWithDate }: { tasksWithDate: TaskWithMeta[] }) {
  const { calendarMonth, setCalendarMonth, setDashboardEditingTaskId, setDashboardTab } = useUiStore();
  const now = new Date();
  const { year, month } = calendarMonth || { year: now.getFullYear(), month: now.getMonth() };

  const tasksByDate: Record<string, TaskWithMeta[]> = {};
  tasksWithDate.forEach((t) => {
    (tasksByDate[t.faelligAm] = tasksByDate[t.faelligAm] || []).push(t);
  });
  const weeks = buildCalendarWeeks(year, month);
  const todayKey = dateKey(new Date());

  function go(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 0) {
      m = 11;
      y--;
    } else if (m > 11) {
      m = 0;
      y++;
    }
    setCalendarMonth({ year: y, month: m });
  }

  return (
    <>
      <div className="cal-nav">
        <div className="cal-title">
          {MONTH_NAMES[month]} {year}
        </div>
        <div className="cal-nav-btns">
          <button className="btn secondary small" onClick={() => go(-1)}>
            ‹ Vormonat
          </button>
          <button
            className="btn secondary small"
            onClick={() => setCalendarMonth({ year: now.getFullYear(), month: now.getMonth() })}
          >
            Heute
          </button>
          <button className="btn secondary small" onClick={() => go(1)}>
            Folgemonat ›
          </button>
        </div>
      </div>
      <div className="cal-grid">
        {WEEKDAY_LABELS.map((d) => (
          <div className="cal-weekday" key={d}>
            {d}
          </div>
        ))}
        {weeks.flat().map((cell, i) => {
          const key = dateKey(cell.date);
          const dayTasks = tasksByDate[key] || [];
          const isToday = key === todayKey;
          return (
            <div key={i} className={`cal-cell${cell.inMonth ? '' : ' other-month'}${isToday ? ' today' : ''}`}>
              <div className="cal-daynum">{cell.date.getDate()}</div>
              {dayTasks.slice(0, 3).map((t) => (
                <div
                  key={t.id}
                  className={`cal-task prio-${slug(t.prioritaet || 'should')}`}
                  title={`#${t.nr || '?'} · ${t.projectName}: ${t.titel}`}
                  onClick={() => {
                    setDashboardEditingTaskId(t.id);
                    setDashboardTab('liste');
                  }}
                >
                  {t.titel}
                </div>
              ))}
              {dayTasks.length > 3 && <div className="cal-more">+{dayTasks.length - 3} weitere</div>}
            </div>
          );
        })}
      </div>
    </>
  );
}
