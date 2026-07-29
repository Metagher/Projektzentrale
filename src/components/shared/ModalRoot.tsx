import { useState } from 'react';
import { useModalStore } from '../../store/modalStore';
import type { ProjectTyp } from '../../types/entities';

function NewProjectForm({ resolve }: { resolve: (v: { name: string; kunde: string; typ: ProjectTyp } | null) => void }) {
  const close = useModalStore((s) => s.close);
  const [name, setName] = useState('');
  const [kunde, setKunde] = useState('');
  const [typ, setTyp] = useState<ProjectTyp>('Neukunde');
  const [invalid, setInvalid] = useState(false);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setInvalid(true);
      return;
    }
    close();
    resolve({ name: trimmed, kunde: kunde.trim(), typ });
  }

  return (
    <div className="modal-box">
      <h3>Neues Projekt</h3>
      <div className="field">
        <label>Projektname</label>
        <input
          autoFocus
          placeholder="z.B. Musterfleisch GmbH – Einführung"
          value={name}
          style={invalid ? { borderColor: 'var(--rust)' } : undefined}
          onChange={(e) => {
            setName(e.target.value);
            setInvalid(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />
      </div>
      <div className="field">
        <label>Kunde</label>
        <input placeholder="Kundenname" value={kunde} onChange={(e) => setKunde(e.target.value)} />
      </div>
      <div className="field">
        <label>Typ</label>
        <select value={typ} onChange={(e) => setTyp(e.target.value as ProjectTyp)}>
          <option value="Neukunde">Neukunde (mit Echtlauf-Zeitplan)</option>
          <option value="Bestandskunde">Bestandskunde</option>
          <option value="Bestandskunde mit Echtläufen">Bestandskunde mit Echtläufen</option>
        </select>
      </div>
      <div className="modal-actions">
        <button
          className="btn secondary"
          onClick={() => {
            close();
            resolve(null);
          }}
        >
          Abbrechen
        </button>
        <button className="btn" onClick={submit}>
          Projekt anlegen
        </button>
      </div>
    </div>
  );
}

export default function ModalRoot() {
  const modal = useModalStore((s) => s.modal);
  const close = useModalStore((s) => s.close);

  if (modal.kind === 'none') return null;

  if (modal.kind === 'confirm') {
    return (
      <div className="modal-overlay">
        <div className="modal-box">
          <h3>Bitte bestätigen</h3>
          <p>{modal.message}</p>
          <div className="modal-actions">
            <button
              className="btn secondary"
              onClick={() => {
                close();
                modal.resolve(false);
              }}
            >
              Abbrechen
            </button>
            <button
              className={modal.danger ? 'btn danger' : 'btn'}
              onClick={() => {
                close();
                modal.resolve(true);
              }}
            >
              {modal.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (modal.kind === 'alert') {
    return (
      <div className="modal-overlay">
        <div className="modal-box">
          <p style={{ marginBottom: 16 }}>{modal.message}</p>
          <div className="modal-actions">
            <button
              className="btn"
              onClick={() => {
                close();
                modal.resolve();
              }}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <NewProjectForm resolve={modal.resolve} />
    </div>
  );
}
