import { todayStr } from '../../lib/format';

interface Props {
  waitingFor: string;
  waitingSince: string;
  waitingOptions: string[];
  onWaitingForChange: (value: string) => void;
  onWaitingSinceChange: (value: string) => void;
}

export default function TaskWaitingFields({ waitingFor, waitingSince, waitingOptions, onWaitingForChange, onWaitingSinceChange }: Props) {
  return (
    <div className="field-grid task-waiting-fields">
      <div className="field wartet-auf-field">
        <label>Wartet auf (Person)</label>
        <select value={waitingFor} onChange={(event) => onWaitingForChange(event.target.value)}>
          <option value="">Bitte auswählen</option>
          {waitingFor && !waitingOptions.includes(waitingFor) && <option value={waitingFor}>{waitingFor} (Bestand)</option>}
          {waitingOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </div>
      <div className="field wartet-seit-field">
        <label>Wartet seit</label>
        <input type="date" max={todayStr()} value={waitingSince} onChange={(event) => onWaitingSinceChange(event.target.value)} />
      </div>
    </div>
  );
}
