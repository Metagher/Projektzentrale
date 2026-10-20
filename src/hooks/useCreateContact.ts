import { useDataStore } from '../store/dataStore';
import { useModalStore } from '../store/modalStore';
import { uid } from '../lib/format';
import type { Contact } from '../types/entities';

/** Liefert eine Funktion, die per Dialog einen neuen Ansprechpartner für das Projekt anlegt und dessen ID zurückgibt (oder null bei Abbruch). */
export function useCreateContact(projectId: string): () => Promise<string | null> {
  const customer = useDataStore((state) => state.projects?.find((project) => project.id === projectId)?.kunde || '');
  const saveContact = useDataStore((state) => state.saveContact);
  const newContactForm = useModalStore((state) => state.newContactForm);

  return async () => {
    const result = await newContactForm({ customer });
    if (!result) return null;
    const contact: Contact = { id: uid(), name: result.name, rolle: result.rolle, telefon: result.telefon, email: result.email, notiz: '' };
    await saveContact(projectId, contact);
    return contact.id;
  };
}
