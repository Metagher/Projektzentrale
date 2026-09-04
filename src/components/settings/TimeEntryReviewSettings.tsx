import { useDataStore } from '../../store/dataStore';

export default function TimeEntryReviewSettings() {
  const enabled = useDataStore((state) => state.timeEntryReviewEnabled);
  const save = useDataStore((state) => state.saveTimeEntryReviewEnabled);

  return <section id="time-entry-review-settings" className="card">
    <h3>Abfrage bei nicht zugeordneter Zeit</h3>
    <p className="settings-explanation">Wenn aktiv, fragt die App beim Stoppen einer Zeiterfassung, die keiner Aufgabe oder Kommunikation zugeordnet ist, per Popup nach, was gemacht wurde. Von/Bis lassen sich dabei anpassen, die Zeit kann auch verworfen werden. Ist die Abfrage deaktiviert, wird die Zeit wie bisher ohne Nachfrage direkt gespeichert.</p>
    <label className="doku-check-field"><input type="checkbox" checked={enabled} onChange={(event) => void save(event.target.checked)} /> Beim Stoppen nach Tätigkeit fragen</label>
  </section>;
}
