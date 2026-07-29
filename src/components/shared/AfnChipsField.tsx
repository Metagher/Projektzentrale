import { useState } from 'react';

interface Props {
  value: string[];
  onChange: (v: string[]) => void;
}

export default function AfnChipsField({ value, onChange }: Props) {
  const [input, setInput] = useState('');

  function addFromInput() {
    const raw = input.trim();
    if (!raw) return;
    const parts = raw.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
    const cur = value.slice();
    parts.forEach((part) => {
      if (!cur.includes(part)) cur.push(part);
    });
    onChange(cur);
    setInput('');
  }

  return (
    <div className="afn-field">
      <div className="afn-chips">
        {value.map((a) => (
          <span className="afn-chip" key={a}>
            {a}
            <button type="button" className="afn-remove" title="Entfernen" onClick={() => onChange(value.filter((x) => x !== a))}>
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="afn-add-row">
        <input
          type="text"
          className="afn-input"
          placeholder="AFN-Nummer eingeben, Enter zum Hinzufügen…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addFromInput();
            }
          }}
        />
        <button type="button" className="btn secondary small" onClick={addFromInput}>
          + AFN
        </button>
      </div>
    </div>
  );
}
