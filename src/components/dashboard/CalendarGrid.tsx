import { useState } from 'react';
import { useUiStore } from '../../store/uiStore';
import { buildCalendarWeeks, dateKey, MONTH_NAMES, WEEKDAY_LABELS } from '../../lib/calendar';
import { openTaskInDashboard } from '../../lib/navigation';
import { useDataStore, type CalendarTaskWithMeta } from '../../store/dataStore';
import { isWorkday } from '../../lib/workdays';
import TaskColorBadge from '../shared/TaskColorBadge';

const MAX_VISIBLE_PER_DAY = 2;

export default function CalendarGrid({ tasksWithDate }: { tasksWithDate: CalendarTaskWithMeta[] }) {
  const { calendarMonth, setCalendarMonth } = useUiStore();
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const now = new Date();
  const workdayOverrides = useDataStore((state) => state.workdayOverrides);
  const toggleWorkday = useDataStore((state) => state.toggleWorkday);
  const { year, month } = calendarMonth || { year: now.getFullYear(), month: now.getMonth() };

  const tasksByDate: Record<string, CalendarTaskWithMeta[]> = {};
  tasksWithDate.forEach((t) => {
    (tasksByDate[t.calendarDate] = tasksByDate[t.calendarDate] || []).push(t);
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
          const workday = isWorkday(cell.date, workdayOverrides);
          const isExpanded = expandedDay === key;
          const hiddenCount = isExpanded ? 0 : dayTasks.length - MAX_VISIBLE_PER_DAY;
          const visibleTasks = isExpanded ? dayTasks : dayTasks.slice(0, MAX_VISIBLE_PER_DAY);
          return (
            <div key={i} className={`cal-cell${cell.inMonth ? '' : ' other-month'}${isToday ? ' today' : ''}${workday ? ' workday' : ' non-workday'}${isExpanded ? ' expanded' : ''}`}>
              <div className="cal-day-head"><div className="cal-daynum">{cell.date.getDate()}</div><button className="workday-toggle" onClick={() => toggleWorkday(key)} title={workday ? 'Als arbeitsfrei markieren' : 'Als Arbeitstag markieren'} aria-label={`${key}: ${workday ? 'Arbeitstag' : 'Arbeitsfrei'}`}>{workday ? 'A' : '–'}</button></div>
              <div className="cal-tasks">
                {visibleTasks.map((t) => (
                  <div
                    key={t.calendarEntryId}
                    className={`cal-task${t.farbe ? ` task-color-border-${t.farbe}` : ''}`}
                    title={`ID ${t.nr || '?'} · ${t.projectName}: ${t.titel}`}
                    onClick={() => openTaskInDashboard(t.id)}
                  >
                    <span><b className={`calendar-entry-kind ${t.calendarKind}`}>{t.calendarKind === 'appointment' ? 'Termin' : 'Fällig'}</b>{t.titel}</span>{t.farbe && <TaskColorBadge color={t.farbe} compact />}
                  </div>
                ))}
              </div>
              {hiddenCount > 0 && (
                <button type="button" className="cal-more" onClick={() => setExpandedDay(key)}>
                  +{hiddenCount} weitere
                </button>
              )}
              {isExpanded && dayTasks.length > MAX_VISIBLE_PER_DAY && (
                <button type="button" className="cal-more" onClick={() => setExpandedDay(null)}>
                  einklappen
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
