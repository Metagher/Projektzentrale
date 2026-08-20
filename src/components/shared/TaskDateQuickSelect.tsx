import { useDataStore } from '../../store/dataStore';
import { localDateKey, nextWorkday } from '../../lib/workdays';
import { todayStr } from '../../lib/format';

export default function TaskDateQuickSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const overrides = useDataStore((state) => state.workdayOverrides);
  const today = new Date(`${todayStr()}T12:00:00`);
  const workday = nextWorkday(today, overrides);
  const nextMonday = new Date(today);
  const daysToMonday = (8 - today.getDay()) % 7 || 7;
  nextMonday.setDate(today.getDate() + daysToMonday);
  const nextFriday = new Date(nextMonday);
  nextFriday.setDate(nextMonday.getDate() + 4);
  const options = [
    { label: 'Heute', date: todayStr() },
    { label: 'Nächster Arbeitstag', date: localDateKey(workday) },
    { label: 'Nächste Woche (Mo)', date: localDateKey(nextMonday) },
    { label: 'Ende nächste Woche (Fr)', date: localDateKey(nextFriday) },
  ];
  return <div className="task-date-quick-select" aria-label="Schnellauswahl Fälligkeit">{options.map((option) => <button type="button" key={option.label} className={value === option.date ? 'active' : ''} onClick={() => onChange(option.date)}>{option.label}</button>)}</div>;
}
