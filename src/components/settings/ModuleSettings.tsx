import { useState } from 'react';
import { useDataStore } from '../../store/dataStore';
import { useModalStore } from '../../store/modalStore';
import { uid } from '../../lib/format';
import type { ErpModule } from '../../types/entities';

const emptyModule = (): ErpModule => ({ id: uid(), name: '', kategorie: '', beschreibung: '', hersteller: '', dokumentationsLink: '', notizen: '', createdAt: new Date().toISOString() });

export default function ModuleSettings() {
  const modules = useDataStore((s) => s.modules);
  const saveModule = useDataStore((s) => s.saveModule);
  const deleteModule = useDataStore((s) => s.deleteModule);
  const confirm = useModalStore((s) => s.confirm);
  const [editing, setEditing] = useState<ErpModule | null>(null);
  async function remove(module: ErpModule) { if (await confirm(`Modul „${module.name}“ global löschen? Alle Kunden- und Projektzuordnungen werden ebenfalls entfernt.`)) await deleteModule(module.id); }
  return <section id="module-settings" className="settings-validation">
    <div className="module-section-head"><div><h3>Globale Modulverwaltung</h3><p>Stammdaten gelten zentral für alle Kunden und Projekte.</p></div><button className="btn small" onClick={() => setEditing(emptyModule())}>+ Modul anlegen</button></div>
    {modules.length === 0 ? <div className="empty-state"><h3>Noch keine Module</h3><div>Lege hier den globalen ERP-Modulkatalog an.</div></div> : <div className="module-catalog-grid">{modules.map((module) => <article className="module-card" key={module.id}><div><span>{module.kategorie || 'Ohne Kategorie'}</span><h4>{module.name}</h4><small>{module.hersteller}</small></div><p>{module.beschreibung || 'Keine Beschreibung hinterlegt.'}</p><div className="actions"><button className="btn secondary small" onClick={() => setEditing(module)}>Bearbeiten</button><button className="icon-btn" onClick={() => remove(module)}>Löschen</button></div></article>)}</div>}
    {editing && <ModuleEditor module={editing} onClose={() => setEditing(null)} onSave={async (module) => { await saveModule(module); setEditing(null); }} />}
  </section>;
}

function ModuleEditor({ module, onSave, onClose }: { module: ErpModule; onSave: (module: ErpModule) => Promise<void>; onClose: () => void }) {
  const [value, setValue] = useState(module);
  const field = (key: keyof ErpModule, next: string) => setValue((current) => ({ ...current, [key]: next }));
  return <div className="task-edit-overlay" role="dialog" aria-modal="true"><div className="task-edit-dialog"><div className="task-edit-dialog-head"><strong>{module.name ? 'Modul bearbeiten' : 'Modul anlegen'}</strong></div><div className="field-grid"><div className="field"><label>Name *</label><input value={value.name} onChange={(e) => field('name', e.target.value)} /></div><div className="field"><label>Kategorie</label><input value={value.kategorie} onChange={(e) => field('kategorie', e.target.value)} /></div><div className="field"><label>Hersteller</label><input value={value.hersteller} onChange={(e) => field('hersteller', e.target.value)} /></div><div className="field"><label>Dokumentationslink</label><input value={value.dokumentationsLink} onChange={(e) => field('dokumentationsLink', e.target.value)} /></div></div><div className="field"><label>Generelle Beschreibung</label><textarea rows={4} value={value.beschreibung} onChange={(e) => field('beschreibung', e.target.value)} /></div><div className="field"><label>Generelle Notizen</label><textarea rows={3} value={value.notizen} onChange={(e) => field('notizen', e.target.value)} /></div><div className="btn-row"><button className="btn" disabled={!value.name.trim()} onClick={() => onSave({ ...value, name: value.name.trim() })}>Speichern</button><button className="btn secondary" onClick={onClose}>Abbrechen</button></div></div></div>;
}
