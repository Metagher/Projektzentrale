import { useEffect, useState } from 'react';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import { useAiStore } from '../../store/aiStore';
import { useModalStore } from '../../store/modalStore';
import { fmtDateTime, htmlToPlainText } from '../../lib/format';
import RtfField from '../shared/RtfField';
import AfnChipsField from '../shared/AfnChipsField';
import AfnChipsView from '../shared/AfnChipsView';
import type { KnowledgeAiEntry, KnowledgeManualEntry } from '../../types/entities';

function daysSince(iso: string | null): number {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 86400000;
}

function kbMatchesSearch(entry: { titel: string; kategorie: string; inhalt: string; projekte?: string[]; afns?: string[] }, q: string): boolean {
  if (!q) return true;
  const hay = (entry.titel + ' ' + entry.kategorie + ' ' + htmlToPlainText(entry.inhalt) + ' ' + (entry.projekte || []).join(' ') + ' ' + (entry.afns || []).join(' ')).toLowerCase();
  return hay.includes(q.toLowerCase());
}

export default function KnowledgeView() {
  const keyPresent = useAiStore((s) => s.keyPresent);
  const {
    knowledgeBase,
    loading,
    error,
    search,
    editingId,
    ensureLoaded,
    setSearch,
    setEditingId,
    addManual,
    updateManual,
    deleteManual,
    deleteAi,
    refreshFromProjects,
  } = useKnowledgeStore();
  const confirm = useModalStore((s) => s.confirm);
  const alert = useModalStore((s) => s.alert);

  const [newTitel, setNewTitel] = useState('');
  const [newKategorie, setNewKategorie] = useState('');
  const [newInhalt, setNewInhalt] = useState('');
  const [newAfns, setNewAfns] = useState<string[]>([]);

  useEffect(() => {
    ensureLoaded();
  }, [ensureLoaded]);

  if (!knowledgeBase) {
    return (
      <div className="main-inner">
        <div className="loading-note">Lade Wissensdatenbank…</div>
      </div>
    );
  }

  const stale = knowledgeBase.aiUpdatedAt === null || daysSince(knowledgeBase.aiUpdatedAt) > 14;
  const q = search.trim();
  const manualFiltered = knowledgeBase.manual.filter((e) => kbMatchesSearch(e, q));
  const aiFiltered = knowledgeBase.ai.filter((e) => kbMatchesSearch(e, q));
  const all: (KnowledgeManualEntry | KnowledgeAiEntry)[] = [...manualFiltered, ...aiFiltered];
  const byCategory: Record<string, (KnowledgeManualEntry | KnowledgeAiEntry)[]> = {};
  all.forEach((e) => {
    const cat = e.kategorie || 'Allgemein';
    (byCategory[cat] = byCategory[cat] || []).push(e);
  });
  const categories = Object.keys(byCategory).sort((a, b) => a.localeCompare(b));

  async function handleAddManual() {
    const titel = newTitel.trim();
    if (!titel) {
      await alert('Bitte einen Titel angeben.');
      return;
    }
    await addManual({ titel, kategorie: newKategorie.trim() || 'Allgemein', inhalt: newInhalt, afns: newAfns });
    setNewTitel('');
    setNewKategorie('');
    setNewInhalt('');
    setNewAfns([]);
  }

  async function handleDelete(id: string, typ: 'manual' | 'ai') {
    const sure = await confirm('Diesen Wissenseintrag löschen?');
    if (!sure) return;
    if (typ === 'manual') await deleteManual(id);
    else await deleteAi(id);
  }

  return (
    <div className="main-inner">
      <h2>🧠 Wissensdatenbank</h2>
      <div className="sub" style={{ color: 'var(--ink-soft)', margin: '4px 0 16px', maxWidth: 640 }}>
        Projektübergreifendes Second Brain — automatisch aus der Dokumentation aller Projekte abgeleitet, ergänzt um
        eigene Einträge.
      </div>

      {keyPresent ? (
        <div className="kb-stale-note">
          <span>
            {knowledgeBase.aiUpdatedAt
              ? `KI-Wissen zuletzt aktualisiert: ${fmtDateTime(knowledgeBase.aiUpdatedAt)}${stale ? ' — das ist eine Weile her.' : ''}`
              : 'Noch nie aus den Projekten aktualisiert.'}
          </span>
          <button className="btn small" disabled={loading} onClick={refreshFromProjects}>
            {loading ? 'Analysiere Projekte…' : '🔄 Aus Projekten aktualisieren'}
          </button>
        </div>
      ) : (
        <div className="an-note">
          Hinterlege einen API-Key unter „⋯ Mehr → 🔑 KI-Einstellungen", um Wissen automatisch aus den Projekten zu
          generieren. Eigene Einträge kannst du unabhängig davon jederzeit anlegen.
        </div>
      )}
      {error && <div className="ai-error" style={{ marginBottom: 14 }}>{error}</div>}

      <input
        type="text"
        className="kb-search"
        placeholder="Wissensdatenbank durchsuchen…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="card">
        <h3 style={{ marginBottom: 10, fontSize: 15 }}>Eigenen Eintrag hinzufügen</h3>
        <div className="field-grid">
          <div className="field">
            <label>Titel</label>
            <input value={newTitel} onChange={(e) => setNewTitel(e.target.value)} />
          </div>
          <div className="field">
            <label>Kategorie</label>
            <input value={newKategorie} onChange={(e) => setNewKategorie(e.target.value)} placeholder="z.B. Bizerba/DIGI, EDI, Sonstiges" />
          </div>
        </div>
        <div className="field">
          <label>Inhalt</label>
          <RtfField value={newInhalt} onChange={setNewInhalt} title="Inhalt" placeholder="Klicken, um Wissen zu erfassen…" />
        </div>
        <div className="field"><label>Verknüpfte AFN-Nummer(n)</label><AfnChipsField value={newAfns} onChange={setNewAfns} /></div>
        <div className="btn-row">
          <button className="btn" onClick={handleAddManual}>
            Hinzufügen
          </button>
        </div>
      </div>

      {all.length === 0 ? (
        <div className="empty-state">
          <h3>{q ? 'Keine Treffer' : 'Noch keine Wissenseinträge'}</h3>
          <div>{q ? 'Versuch einen anderen Suchbegriff.' : 'Klicke oben auf „Aus Projekten aktualisieren" oder lege einen eigenen Eintrag an.'}</div>
        </div>
      ) : (
        categories.map((cat) => (
          <div key={cat}>
            <div className="kb-category-title">{cat}</div>
            {byCategory[cat].map((e) =>
              e.id === editingId && e.typ === 'manual' ? (
                <KbEditCard
                  key={e.id}
                  entry={e as KnowledgeManualEntry}
                  onSave={async (patch) => {
                    await updateManual(e.id, patch);
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                  onDelete={() => handleDelete(e.id, 'manual')}
                />
              ) : (
                <div
                  className="kb-entry-card"
                  key={e.id}
                  style={e.typ === 'manual' ? { cursor: 'pointer' } : undefined}
                  onClick={() => {
                    if (e.typ === 'manual') setEditingId(e.id);
                  }}
                >
                  <div className="kb-entry-head">
                    <span className="kb-entry-title">{e.titel}</span>
                    <span className={`kb-source-tag ${e.typ}`}>{e.typ === 'manual' ? 'Eigener Eintrag' : 'KI'}</span>
                  </div>
                  <div className="rtf-content" dangerouslySetInnerHTML={{ __html: e.inhalt || '' }} />
                  {!!e.afns?.length && <div className="kb-afns"><AfnChipsView afns={e.afns} /></div>}
                  {'projekte' in e && e.projekte && e.projekte.length > 0 && (
                    <div className="kb-projects">Quelle: {e.projekte.join(', ')}</div>
                  )}
                  <div className="btn-row" style={{ marginTop: 8 }}>
                    <button
                      className="icon-btn"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        handleDelete(e.id, e.typ);
                      }}
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>
        ))
      )}
    </div>
  );
}

function KbEditCard({
  entry,
  onSave,
  onCancel,
  onDelete,
}: {
  entry: KnowledgeManualEntry;
  onSave: (patch: { titel: string; kategorie: string; inhalt: string; afns: string[] }) => Promise<void>;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const alert = useModalStore((s) => s.alert);
  const [titel, setTitel] = useState(entry.titel);
  const [kategorie, setKategorie] = useState(entry.kategorie || '');
  const [inhalt, setInhalt] = useState(entry.inhalt || '');
  const [afns, setAfns] = useState(entry.afns || []);

  async function handleSave() {
    const trimmed = titel.trim();
    if (!trimmed) {
      await alert('Bitte einen Titel angeben.');
      return;
    }
    await onSave({ titel: trimmed, kategorie: kategorie.trim() || 'Allgemein', inhalt, afns });
  }

  return (
    <div className="kb-entry-card">
      <div className="field-grid">
        <div className="field">
          <label>Titel</label>
          <input value={titel} onChange={(e) => setTitel(e.target.value)} />
        </div>
        <div className="field">
          <label>Kategorie</label>
          <input value={kategorie} onChange={(e) => setKategorie(e.target.value)} />
        </div>
      </div>
      <RtfField value={inhalt} onChange={setInhalt} title="Inhalt" placeholder="Klicken, um Wissen zu erfassen…" />
      <div className="field"><label>Verknüpfte AFN-Nummer(n)</label><AfnChipsField value={afns} onChange={setAfns} /></div>
      <div className="btn-row" style={{ marginTop: 8 }}>
        <button className="btn small" onClick={handleSave}>
          Speichern
        </button>
        <button className="btn secondary small" onClick={onCancel}>
          Abbrechen
        </button>
        <button className="btn danger small" style={{ marginLeft: 'auto' }} onClick={onDelete}>
          Löschen
        </button>
      </div>
    </div>
  );
}
