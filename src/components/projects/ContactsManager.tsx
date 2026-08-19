import { useState } from 'react';
import { useDataStore } from '../../store/dataStore';
import { useModalStore } from '../../store/modalStore';
import { isEmptyHtml, uid } from '../../lib/format';
import RtfField from '../shared/RtfField';
import type { Contact, ProjectCache } from '../../types/entities';

const EMPTY_CONTACT = { name: '', rolle: '', telefon: '', email: '', notiz: '' };

export default function ContactsManager({ projectId, data }: { projectId: string; data: ProjectCache }) {
  const saveContact = useDataStore((state) => state.saveContact);
  const deleteContact = useDataStore((state) => state.deleteContact);
  const confirm = useModalStore((state) => state.confirm);
  const alert = useModalStore((state) => state.alert);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_CONTACT);

  function change(field: keyof typeof EMPTY_CONTACT, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function edit(contact: Contact) {
    setEditingId(contact.id);
    setForm({ name: contact.name, rolle: contact.rolle, telefon: contact.telefon, email: contact.email, notiz: contact.notiz });
  }

  function reset() {
    setEditingId(null);
    setForm(EMPTY_CONTACT);
  }

  async function save() {
    if (!form.name.trim()) {
      await alert('Bitte einen Namen angeben.');
      return;
    }
    await saveContact(projectId, {
      id: editingId || uid(),
      name: form.name.trim(),
      rolle: form.rolle.trim(),
      telefon: form.telefon.trim(),
      email: form.email.trim(),
      notiz: form.notiz,
    });
    reset();
  }

  async function remove(id: string) {
    if (!(await confirm('Diesen Ansprechpartner löschen?'))) return;
    await deleteContact(projectId, id);
    if (editingId === id) reset();
  }

  return (
    <div className="contacts-admin">
      <div className="section-title">Ansprechpartner ({data.contacts.length})</div>
      <div className="contacts-admin-grid">
        <div className="contact-form-panel">
          <h4>{editingId ? 'Ansprechpartner bearbeiten' : 'Ansprechpartner hinzufügen'}</h4>
          <div className="field-grid">
            <div className="field"><label>Name</label><input value={form.name} onChange={(event) => change('name', event.target.value)} /></div>
            <div className="field"><label>Rolle</label><input value={form.rolle} onChange={(event) => change('rolle', event.target.value)} placeholder="z. B. IT-Leitung" /></div>
            <div className="field"><label>Telefon</label><input value={form.telefon} onChange={(event) => change('telefon', event.target.value)} /></div>
            <div className="field"><label>E-Mail</label><input type="email" value={form.email} onChange={(event) => change('email', event.target.value)} /></div>
          </div>
          <div className="field"><label>Notiz</label><RtfField value={form.notiz} onChange={(value) => change('notiz', value)} title="Notiz" placeholder="Notiz zum Ansprechpartner erfassen…" /></div>
          <div className="btn-row"><button className="btn small" onClick={save}>{editingId ? 'Speichern' : 'Hinzufügen'}</button>{editingId && <button className="btn secondary small" onClick={reset}>Abbrechen</button>}</div>
        </div>
        <div className="contact-admin-list">
          {data.contacts.length === 0 && <div className="empty-hint">Noch keine Ansprechpartner hinterlegt.</div>}
          {data.contacts.map((contact) => (
            <div className="contact-admin-item" key={contact.id}>
              <div><strong>{contact.name}</strong>{contact.rolle && <span className="meta"> · {contact.rolle}</span>}<div className="meta">{[contact.telefon, contact.email].filter(Boolean).join(' · ')}</div>{!isEmptyHtml(contact.notiz) && <div className="rtf-content rtf-field-preview-compact" dangerouslySetInnerHTML={{ __html: contact.notiz }} />}</div>
              <div className="actions"><button className="icon-btn edit" onClick={() => edit(contact)}>Bearbeiten</button><button className="icon-btn" onClick={() => remove(contact.id)}>Löschen</button></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
