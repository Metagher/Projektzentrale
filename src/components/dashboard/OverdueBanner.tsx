import { useDataStore } from '../../store/dataStore';
import { useModalStore } from '../../store/modalStore';
import { fmtDate, todayStr } from '../../lib/format';

export default function OverdueBanner({ count }: { count: number }) {
  const setAllOverdueTasksToToday = useDataStore((s) => s.setAllOverdueTasksToToday);
  const confirm = useModalStore((s) => s.confirm);
  if (count === 0) return null;

  async function handleClick() {
    const sure = await confirm(
      `Wirklich alle ${count} überfällige${count === 1 ? '' : 'n'} Aufgabe${count === 1 ? '' : 'n'} auf das heutige Datum (${fmtDate(todayStr())}) setzen?`,
      { confirmLabel: 'Bestätigen', danger: false },
    );
    if (!sure) return;
    await setAllOverdueTasksToToday();
  }

  return (
    <div className="kb-stale-note" style={{ borderLeftColor: 'var(--rust)' }}>
      <span>
        ⚠ {count} Aufgabe{count === 1 ? '' : 'n'} {count === 1 ? 'ist' : 'sind'} überfällig (Fälligkeitsdatum liegt vor
        heute).
      </span>
      <button className="btn small danger" onClick={handleClick}>
        Alle überfälligen auf heute setzen
      </button>
    </div>
  );
}
