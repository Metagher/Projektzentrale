import { useDataStore } from '../../store/dataStore';
import { TASK_COLOR_LABELS } from '../../lib/constants';

export default function TaskColorSettings() {
  const order = useDataStore((state) => state.taskColorOrder);
  const saveOrder = useDataStore((state) => state.saveTaskColorOrder);

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    await saveOrder(next);
  }

  return (
    <section className="card color-settings-card">
      <h3>Farbhierarchie für Aufgaben</h3>
      <p>Aufgaben werden in allen Ansichten zuerst nach dieser Reihenfolge und anschließend nach ihrem Fälligkeitsdatum sortiert.</p>
      <div className="color-order-list">
        {order.map((color, index) => (
          <div className="color-order-row" key={color}>
            <span className={`task-color-swatch task-color-${color}`} />
            <strong>{index + 1}. {TASK_COLOR_LABELS[color]}</strong>
            <div className="actions">
              <button className="btn secondary small" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`${TASK_COLOR_LABELS[color]} nach oben`}>↑</button>
              <button className="btn secondary small" disabled={index === order.length - 1} onClick={() => move(index, 1)} aria-label={`${TASK_COLOR_LABELS[color]} nach unten`}>↓</button>
            </div>
          </div>
        ))}
      </div>
      <div className="contact-empty-note">Aufgaben ohne Farbmarkierung werden immer nach den markierten Aufgaben einsortiert.</div>
    </section>
  );
}
