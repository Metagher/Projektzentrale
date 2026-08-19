import { useDataStore } from '../../store/dataStore';
import type { TaskColor } from '../../types/entities';

export default function TaskColorSettings() {
  const order = useDataStore((state) => state.taskColorOrder);
  const saveOrder = useDataStore((state) => state.saveTaskColorOrder);
  const labels = useDataStore((state) => state.taskColorLabels);
  const saveLabels = useDataStore((state) => state.saveTaskColorLabels);

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    await saveOrder(next);
  }

  async function rename(color: TaskColor, value: string) {
    await saveLabels({ ...labels, [color]: value });
  }

  return (
    <section className="card color-settings-card">
      <h3>Farbhierarchie für Aufgaben</h3>
      <p>Aufgaben werden in allen Ansichten zuerst nach dieser Reihenfolge und anschließend nach ihrem Fälligkeitsdatum sortiert.</p>
      <div className="color-order-list">
        {order.map((color, index) => (
          <div className="color-order-row" key={color}>
            <span className={`task-color-swatch task-color-${color}`} />
            <span className="color-order-index">{index + 1}.</span>
            <input
              key={`${color}-${labels[color]}`}
              defaultValue={labels[color]}
              aria-label={`Name für die Farbe ${color}`}
              placeholder="Bezeichnung eingeben"
              onBlur={(event) => rename(color, event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
            />
            <div className="actions">
              <button className="btn secondary small" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`${labels[color]} nach oben`}>↑</button>
              <button className="btn secondary small" disabled={index === order.length - 1} onClick={() => move(index, 1)} aria-label={`${labels[color]} nach unten`}>↓</button>
            </div>
          </div>
        ))}
      </div>
      <div className="contact-empty-note">Aufgaben ohne Farbmarkierung werden immer nach den markierten Aufgaben einsortiert.</div>
    </section>
  );
}
