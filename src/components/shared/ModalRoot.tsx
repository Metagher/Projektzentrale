import { useState } from 'react';
import { useModalStore } from '../../store/modalStore';
import { fmtDate } from '../../lib/format';
import type { ProjectTyp } from '../../types/entities';
import type { ExtractedTask } from '../../lib/ai';

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

function PromptForm({ modal }: { modal: Extract<ReturnType<typeof useModalStore.getState>['modal'], { kind: 'prompt' }> }) {
  const close = useModalStore((state) => state.close);
  const [value, setValue] = useState(modal.initialValue);
  const [invalid, setInvalid] = useState(false);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) {
      setInvalid(true);
      return;
    }
    close();
    modal.resolve(trimmed);
  }

  return (
    <div className="modal-box">
      <h3>{modal.title}</h3>
      <p>{modal.message}</p>
      <div className="field">
        <label>{modal.label}</label>
        <input autoFocus value={value} placeholder={modal.placeholder} aria-invalid={invalid} style={invalid ? { borderColor: 'var(--ink)' } : undefined} onChange={(event) => { setValue(event.target.value); setInvalid(false); }} onKeyDown={(event) => { if (event.key === 'Enter') submit(); }} />
        {invalid && <span className="field-error">Bitte eine Person oder Stelle angeben.</span>}
      </div>
      <div className="modal-actions">
        <button className="btn secondary" onClick={() => { close(); modal.resolve(null); }}>Abbrechen</button>
        <button className="btn" onClick={submit}>{modal.confirmLabel}</button>
      </div>
    </div>
  );
}

function ChoiceForm({ modal }: { modal: Extract<ReturnType<typeof useModalStore.getState>['modal'], { kind: 'choice' }> }) {
  const close = useModalStore((state) => state.close);
  const [value, setValue] = useState(modal.options.includes(modal.initialValue) ? modal.initialValue : '');
  const [invalid, setInvalid] = useState(false);
  function submit() {
    if (!value) { setInvalid(true); return; }
    close(); modal.resolve(value);
  }
  return <div className="modal-box"><h3>{modal.title}</h3><p>{modal.message}</p><div className="field"><label>{modal.label}</label><select autoFocus value={value} aria-invalid={invalid} onChange={(event) => { setValue(event.target.value); setInvalid(false); }}><option value="">Bitte auswählen</option>{modal.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>{invalid && <span className="field-error">Bitte eine Möglichkeit auswählen.</span>}</div><div className="modal-actions"><button className="btn secondary" onClick={() => { close(); modal.resolve(null); }}>Abbrechen</button><button className="btn" onClick={submit}>{modal.confirmLabel}</button></div></div>;
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

  if (modal.kind === 'newProject') {
    return (
      <div className="modal-overlay">
        <NewProjectForm resolve={modal.resolve} />
      </div>
    );
  }

  if (modal.kind === 'prompt') {
    return <div className="modal-overlay"><PromptForm modal={modal} /></div>;
  }

  if (modal.kind === 'choice') return <div className="modal-overlay"><ChoiceForm modal={modal} /></div>;

  return (
    <div className="modal-overlay">
      <TaskExtractionReview tasks={modal.tasks} resolve={modal.resolve} />
    </div>
  );
}

function TaskExtractionReview({
  tasks,
  resolve,
}: {
  tasks: ExtractedTask[];
  resolve: (v: ExtractedTask[] | null) => void;
}) {
  const close = useModalStore((s) => s.close);
  const [checked, setChecked] = useState<boolean[]>(() => tasks.map(() => true));

  if (tasks.length === 0) {
    return (
      <div className="modal-box">
        <h3>Keine Aufgaben erkannt</h3>
        <p>Die KI hat in diesem Eintrag keine konkreten Aufgaben für dich gefunden.</p>
        <div className="modal-actions">
          <button
            className="btn"
            onClick={() => {
              close();
              resolve(null);
            }}
          >
            OK
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-box rtf-modal">
      <h3>Erkannte Aufgaben für Fabian</h3>
      <p>Wähle aus, welche Aufgaben angelegt werden sollen.</p>
      <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
        {tasks.map((t, i) => (
          <div className="list-item" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }} key={i}>
            <input
              type="checkbox"
              checked={checked[i]}
              onChange={(e) => setChecked((c) => c.map((v, idx) => (idx === i ? e.target.checked : v)))}
              style={{ marginTop: 4 }}
            />
            <div style={{ flex: 1 }}>
              <div>
                <strong>{t.titel}</strong>
              </div>
              <div className="meta">{t.faelligAm ? `Fällig: ${fmtDate(t.faelligAm)}` : 'Kein Datum erkannt'}</div>
              {t.beschreibung && <div className="meta" style={{ marginTop: 3 }}>{t.beschreibung}</div>}
            </div>
          </div>
        ))}
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
        <button
          className="btn"
          onClick={() => {
            const selected = tasks.filter((_, i) => checked[i]);
            close();
            resolve(selected);
          }}
        >
          Ausgewählte anlegen
        </button>
      </div>
    </div>
  );
}
