import { useState } from 'react';
import { useDataStore } from '../../../store/dataStore';
import { useProjectUiStore } from '../../../store/projectUiStore';
import { useModalStore } from '../../../store/modalStore';
import { isEmptyHtml, uid } from '../../../lib/format';
import RtfField from '../../shared/RtfField';
import type { Contact, ProjectCache } from '../../../types/entities';

export default function AnsprechpartnerTab({ projectId, data }: { projectId: string; data: ProjectCache }) {
  const saveContact = useDataStore((s) => s.saveContact);
  const deleteContact = useDataStore((s) => s.deleteContact);
  const { editingContact, setEditingContact } = useProjectUiStore();
  const confirm = useModalStore((s) => s.confirm);
  const alert = useModalStore((s) => s.alert);

  const editObj = editingContact ? data.contacts.find((c) => c.id === editingContact) : null;

  const [name, setName] = useState(editObj?.name || '');
  const [rolle, setRolle] = useState(editObj?.rolle || '');
  const [telefon, setTelefon] = useState(editObj?.telefon || '');
  const [email, setEmail] = useState(editObj?.email || '');
  const [notiz, setNotiz] = useState(editObj?.notiz || '');

  function resetForm() {
    setName('');
    setRolle('');
    setTelefon('');
    setEmail('');
    setNotiz('');
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      await alert('Bitte einen Namen angeben.');
      return;
    }
    const contact: Contact = {
      id: editObj ? editObj.id : uid(),
      name: trimmed,
      rolle: rolle.trim(),
      telefon: telefon.trim(),
      email: email.trim(),
      notiz,
    };
    await saveContact(projectId, contact);
    setEditingContact(null);
    resetForm();
  }

  function startEdit(c: Contact) {
    setEditingContact(c.id);
    setName(c.name);
    setRolle(c.rolle);
    setTelefon(c.telefon);
    setEmail(c.email);
    setNotiz(c.notiz);
  }

  function cancelEdit() {
    setEditingContact(null);
    resetForm();
  }

  async function handleDelete(id: string) {
    const sure = await confirm('Diesen Ansprechpartner löschen?');
    if (!sure) return;
    await deleteContact(projectId, id);
  }

  return (
    <>
      <div className="card">
        <h3 style={{ marginBottom: 10, fontSize: 15 }}>{editObj ? 'Ansprechpartner bearbeiten' : 'Neuer Ansprechpartner'}</h3>
        <div className="field-grid">
          <div className="field">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Rolle</label>
            <input value={rolle} onChange={(e) => setRolle(e.target.value)} placeholder="z.B. IT-Leiter" />
          </div>
          <div className="field">
            <label>Telefon</label>
            <input value={telefon} onChange={(e) => setTelefon(e.target.value)} />
          </div>
          <div className="field">
            <label>E-Mail</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Notiz</label>
          <RtfField value={notiz} onChange={setNotiz} title="Notiz" placeholder="Klicken, um eine Notiz zu erfassen…" />
        </div>
        <div className="btn-row">
          <button className="btn" onClick={handleSave}>
            {editObj ? 'Speichern' : 'Hinzufügen'}
          </button>
          {editObj && (
            <button className="btn secondary" onClick={cancelEdit}>
              Abbrechen
            </button>
          )}
        </div>
      </div>
      <div className="section-title">Alle Ansprechpartner ({data.contacts.length})</div>
      {data.contacts.length === 0 ? (
        <div className="empty-state">
          <h3>Noch keine Ansprechpartner</h3>
          <div>Lege oben den ersten Ansprechpartner an.</div>
        </div>
      ) : (
        data.contacts.map((c) => (
          <div className="list-item" key={c.id}>
            <div className="top-row">
              <div>
                <strong>{c.name}</strong> {c.rolle && <span className="meta">· {c.rolle}</span>}
                <div className="meta">
                  {c.telefon} {c.telefon && c.email ? '· ' : ''}
                  {c.email}
                </div>
                {!isEmptyHtml(c.notiz) && (
                  <div
                    className="rtf-content rtf-field-preview-compact"
                    style={{ marginTop: 5 }}
                    dangerouslySetInnerHTML={{ __html: c.notiz }}
                  />
                )}
              </div>
              <div className="actions">
                <button className="icon-btn edit" onClick={() => startEdit(c)}>
                  Bearbeiten
                </button>
                <button className="icon-btn" onClick={() => handleDelete(c.id)}>
                  Löschen
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </>
  );
}
