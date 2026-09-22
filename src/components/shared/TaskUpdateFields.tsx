interface Props {
  vormerkung: boolean;
  revision: string;
  onVormerkungChange: (value: boolean) => void;
  onRevisionChange: (value: string) => void;
}

export default function TaskUpdateFields({ vormerkung, revision, onVormerkungChange, onRevisionChange }: Props) {
  return (
    <div className="task-update-fields">
      <label className="doku-check-field">
        <input type="checkbox" checked={vormerkung} onChange={(event) => onVormerkungChange(event.target.checked)} /> Kommt mit einem Update
      </label>
      {vormerkung && (
        <div className="field update-revision-field">
          <label>Revision</label>
          <input value={revision} onChange={(event) => onRevisionChange(event.target.value)} placeholder="z.B. Rev. 3" />
        </div>
      )}
    </div>
  );
}
