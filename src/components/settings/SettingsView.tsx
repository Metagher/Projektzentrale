import { useState, type DragEvent } from 'react';
import { useDataStore } from '../../store/dataStore';
import { useModalStore } from '../../store/modalStore';
import { computeDocLabels, getSubtreeIds, moveSubtreeTo } from '../../lib/docOutline';
import { defLevel, uid } from '../../lib/format';
import type { DocSectionDef } from '../../types/entities';

export default function SettingsView() {
  const docDefs = useDataStore((s) => s.docDefs) || [];
  const saveDocDefs = useDataStore((s) => s.saveDocDefs);
  const confirm = useModalStore((s) => s.confirm);
  const alert = useModalStore((s) => s.alert);

  const [newTitle, setNewTitle] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [overAfter, setOverAfter] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);

  const labels = computeDocLabels(docDefs);

  async function insertDefAt(index: number, level: number) {
    const newDef: DocSectionDef = { id: uid(), title: 'Neuer Punkt', level: defLevel(level) };
    const next = [...docDefs.slice(0, index), newDef, ...docDefs.slice(index)];
    await saveDocDefs(next);
    setFocusId(newDef.id);
  }

  async function handleAddNew() {
    const title = newTitle.trim();
    if (!title) {
      await alert('Bitte einen Titel für den Oberpunkt angeben.');
      return;
    }
    await saveDocDefs([...docDefs, { id: uid(), title, level: 1 }]);
    setNewTitle('');
  }

  async function handleTitleChange(id: string, value: string) {
    const v = value.trim();
    if (!v) return;
    await saveDocDefs(docDefs.map((d) => (d.id === id ? { ...d, title: v } : d)));
  }

  async function handleIndent(id: string) {
    await saveDocDefs(docDefs.map((d) => (d.id === id ? { ...d, level: defLevel(defLevel(d.level) + 1) } : d)));
  }
  async function handleOutdent(id: string) {
    await saveDocDefs(docDefs.map((d) => (d.id === id ? { ...d, level: defLevel(defLevel(d.level) - 1) } : d)));
  }

  async function handleDelete(id: string) {
    const def = docDefs.find((d) => d.id === id);
    const subtreeIds = getSubtreeIds(docDefs, id);
    const extra = subtreeIds.length > 1 ? ` Alle ${subtreeIds.length - 1} zugehörigen Unterpunkte werden ebenfalls gelöscht.` : '';
    const sure = await confirm(
      `Oberpunkt "${def ? def.title : ''}" wirklich für alle Projekte löschen?${extra} Bereits erfasste Texte zu diesen Punkten bleiben gespeichert, sind aber über die Oberfläche nicht mehr erreichbar.`,
    );
    if (!sure) return;
    await saveDocDefs(docDefs.filter((d) => !subtreeIds.includes(d.id)));
  }

  async function handleDrop(targetId: string, placeAfter: boolean) {
    if (!dragId || dragId === targetId) return;
    const moved = moveSubtreeTo(docDefs, dragId, targetId, placeAfter);
    if (moved !== docDefs) await saveDocDefs(moved);
  }

  return (
    <div className="main-inner">
      <h2>Oberpunkte verwalten</h2>
      <div className="sub" style={{ color: 'var(--ink-soft)', margin: '4px 0 22px', maxWidth: 620 }}>
        Diese Oberpunkte gelten für die Projektdokumentation aller Projekte. Mit ⬅/➡ legst du bis zu 3
        Hierarchie-Ebenen fest (jede Ebene wird eingerückt dargestellt). Zum Umsortieren am Griff{' '}
        <span className="mono">⠿</span> ziehen und an der gewünschten Stelle ablegen — Unterpunkte werden dabei
        automatisch mitgenommen. Ebene 2 gehört immer zum vorausgehenden Ebene-1-Punkt, Ebene 3 zum vorausgehenden
        Ebene-2-Punkt. Einzelne Punkte können pro Projekt im Reiter „Dokumentation" ausgeblendet werden, ohne sie
        hier zu löschen.
      </div>
      <div className="card">
        <h3 style={{ marginBottom: 10, fontSize: 15 }}>Neuen Oberpunkt hinzufügen</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="z.B. Kundenspezifische Anpassungen"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 'var(--radius)' }}
          />
          <button className="btn" onClick={handleAddNew}>
            Hinzufügen
          </button>
        </div>
      </div>
      <div className="section-title">Aktuelle Oberpunkte ({docDefs.length})</div>
      {docDefs.length === 0 ? (
        <div className="empty-state">
          <h3>Noch keine Oberpunkte</h3>
          <div>Lege oben den ersten an.</div>
        </div>
      ) : (
        <>
          <button
            className="btn secondary small"
            style={{ marginBottom: 8 }}
            onClick={() => insertDefAt(0, defLevel(docDefs[0]?.level ?? 1))}
          >
            + Am Anfang einfügen
          </button>
          {docDefs.map((d, i) => {
            const lvl = defLevel(d.level);
            const dragClass = [
              dragId === d.id ? 'dragging' : '',
              overId === d.id ? (overAfter ? 'drag-over-bottom' : 'drag-over-top') : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <div
                className={`list-item def-row lvl-${lvl} ${dragClass}`.trim()}
                key={d.id}
                onDragOver={(e: DragEvent) => {
                  if (!dragId || dragId === d.id) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  const rect = e.currentTarget.getBoundingClientRect();
                  const after = e.clientY - rect.top > rect.height / 2;
                  setOverId(d.id);
                  setOverAfter(after);
                }}
                onDragLeave={() => setOverId((o) => (o === d.id ? null : o))}
                onDrop={(e: DragEvent) => {
                  e.preventDefault();
                  handleDrop(d.id, overAfter);
                  setOverId(null);
                }}
              >
                <div className="top-row" style={{ alignItems: 'center' }}>
                  <span
                    className="drag-handle"
                    draggable
                    title="Ziehen zum Verschieben (mit Unterpunkten)"
                    onDragStart={(e) => {
                      setDragId(d.id);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', d.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverId(null);
                    }}
                  >
                    ⠿
                  </span>
                  <span className="mono" style={{ color: 'var(--ink-soft)', width: 34, flexShrink: 0 }}>
                    {labels[d.id]}
                  </span>
                  <input
                    defaultValue={d.title}
                    autoFocus={focusId === d.id}
                    onFocus={(e) => {
                      if (focusId === d.id) e.currentTarget.select();
                    }}
                    onBlur={(e) => {
                      setFocusId(null);
                      handleTitleChange(d.id, e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                    style={{ flex: 1, padding: '7px 9px', border: '1px solid var(--line)', borderRadius: 'var(--radius)', fontSize: 13.5 }}
                  />
                  <div className="actions">
                    <button className="icon-btn" title="Danach neuen Punkt einfügen" onClick={() => insertDefAt(i + 1, lvl)}>
                      + Einfügen
                    </button>
                    <button
                      className="icon-btn"
                      disabled={lvl <= 1}
                      title={`Ausrücken (Ebene ${lvl > 1 ? lvl - 1 : 1})`}
                      onClick={() => handleOutdent(d.id)}
                    >
                      ⬅
                    </button>
                    <button
                      className="icon-btn"
                      disabled={lvl >= 3}
                      title={`Einrücken (Ebene ${lvl < 3 ? lvl + 1 : 3})`}
                      onClick={() => handleIndent(d.id)}
                    >
                      ➡
                    </button>
                    <button className="icon-btn" title="Löschen" onClick={() => handleDelete(d.id)}>
                      Löschen
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
