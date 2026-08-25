import type { Contact } from '../types/entities';

export interface ContactLinkSource {
  kontaktId?: string;
  kontaktIds?: string[];
}

export function linkedContactIds(source: ContactLinkSource): string[] {
  return Array.from(new Set([...(source.kontaktIds || []), source.kontaktId || ''].filter(Boolean)));
}

export function normalizeContactLinks<T extends ContactLinkSource>(source: T, ids: string[]): T & { kontaktId: string; kontaktIds: string[] } {
  const kontaktIds = Array.from(new Set(ids.filter(Boolean)));
  return { ...source, kontaktId: kontaktIds[0] || '', kontaktIds };
}

export function contactLinkLabel(contact: Contact): string {
  return `${contact.name}${contact.rolle ? ` (${contact.rolle})` : ''}`;
}
