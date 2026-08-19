import { useUiStore } from '../../store/uiStore';
import { buildCalendarWeeks, dateKey, MONTH_NAMES, WEEKDAY_LABELS } from '../../lib/calendar';
import { openTaskInDashboard } from '../../lib/navigation';
import { slug } from '../../lib/format';
import type { TaskWithMeta } from '../../store/dataStore';

const MAX_VISIBLE_PER_DAY = 2;

export default function CalendarGrid({ tasksWithDate }: { tasksWithDate: TaskWithMeta[] }) {
  const { calendarMonth, setCalendarMonth } = useUiStore();
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
          const hiddenCount = dayTasks.length - MAX_VISIBLE_PER_DAY;
          return (
            <div key={i} className={`cal-cell${cell.inMonth ? '' : ' other-month'}${isToday ? ' today' : ''}`}>
              <div className="cal-daynum">{cell.date.getDate()}</div>
              <div className="cal-tasks">
                {dayTasks.slice(0, MAX_VISIBLE_PER_DAY).map((t) => (
                  <div
                    key={t.id}
                    className={`cal-task prio-${slug(t.prioritaet || 'should')}${t.farbe ? ` task-color-border-${t.farbe}` : ''}`}
                    title={`#${t.nr || '?'} · ${t.projectName}: ${t.titel}`}
                    onClick={() => openTaskInDashboard(t.id)}
                  >
                    {t.titel}
                  </div>
                ))}
              </div>
              {hiddenCount > 0 && <div className="cal-more">+{hiddenCount} weitere</div>}
            </div>
          );
        })}
      </div>
    </>
  );
}
