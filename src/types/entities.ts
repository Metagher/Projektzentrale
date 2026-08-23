export type ProjectTyp = 'Neukunde' | 'Bestandskunde' | 'Bestandskunde mit Echtläufen';
export type ProjectStatus = 'aktiv' | 'pausiert' | 'abgeschlossen';

export interface Project {
  id: string;
  name: string;
  kunde: string;
  typ: ProjectTyp;
  status: ProjectStatus;
  beschreibung: string; // RTF html
  createdAt: string; // ISO
  aktuelleVersion: string;
  sortIndex: number;
  /** Blendet ausschließlich den Button in der oberen Projektschnellwahl aus. */
  quickbarHidden?: boolean;
}

export type ModuleCommercialStatus = 'vertrag' | 'nachlizenzierung';
export type ModuleOfferStatus = 'kein Angebot' | 'Entwurf' | 'versendet' | 'angenommen' | 'abgelehnt';

/** Globale, kundenunabhängige Stammdaten eines ERP-Moduls. */
export interface ErpModule {
  id: string;
  name: string;
  /** null kennzeichnet ein Obermodul; Untermodule verweisen auf dessen id. */
  parentId: string | null;
  beschreibung: string;
  notizen: string;
  createdAt: string;
  sortIndex: number;
}

/** Kaufmännische Zuordnung je Kunde; wird in alle Projekte desselben Kunden gespiegelt. */
export interface CustomerModule {
  moduleId: string;
  kunde: string;
  commercialStatus: ModuleCommercialStatus;
  offerNumber: string;
  offerStatus: ModuleOfferStatus;
  notizen: string;
}

/** Ausschließlich projektspezifische Angaben zur Einrichtung. */
export interface ProjectModuleConfig {
  moduleId: string;
  einrichtungsstatus: 'nicht begonnen' | 'in Arbeit' | 'eingerichtet' | 'nicht relevant';
  verantwortlicher: string;
  einrichtungsdetails: string;
  notizen: string;
  updatedAt: string;
}

export interface ProjectNote {
  id: string;
  titel: string;
  inhalt: string;
  global: boolean;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntry {
  id: string;
  projectId: string;
  taskId: string | null;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  note: string;
  createdAt: string;
}

export interface ActiveTimer {
  projectId: string;
  taskId: string | null;
  startedAt: string;
}

export interface Contact {
  id: string;
  name: string;
  rolle: string;
  telefon: string;
  email: string;
  notiz: string; // RTF html
}

export type Kanal = 'Teams' | 'Telefon' | 'E-Mail' | 'Vor Ort' | 'Sonstiges';

export interface Comm {
  id: string;
  datum: string; // YYYY-MM-DD
  kanal: Kanal;
  kontaktId: string;
  betreff: string;
  notiz: string; // RTF html
  afns: string[];
  taskIds: string[];
  teilprojekt?: string;
}

export type DocLevel = 1 | 2 | 3;

export interface DocSectionDef {
  id: string;
  title: string;
  level: DocLevel;
}

export interface DocEntryValue {
  content: string; // RTF html
  updatedAt: string | null;
  afns: string[];
}

export interface ProjectStatusEntry {
  id: string;
  datum: string;
  titel: string;
  content: string;
  afns: string[];
  createdAt: string;
  updatedAt: string;
  bereichId?: string;
}

export interface ProjectDocumentationArea {
  id: string;
  name: string;
  current: DocEntryValue;
}

/** Keyed by DocSectionDef id, plus a special `_hidden` key (string[]) for per-project hidden section ids. */
export type DocData = Record<string, DocEntryValue | string[] | ProjectStatusEntry[] | ProjectDocumentationArea[] | undefined>;

export type TaskStatus = 'offen' | 'in Arbeit' | 'wartet' | 'erledigt';
export type TaskPrio = 'must' | 'should' | 'could' | 'wont';
export type TaskColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'gray';

export interface TaskProgressEntry {
  id: string;
  datum: string;
  titel: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  nr: number;
  titel: string;
  faelligAm: string;
  /** @deprecated Legacy value retained for import compatibility. */
  prioritaet?: TaskPrio;
  farbe?: TaskColor | '';
  tagesSortierung?: number;
  status: TaskStatus;
  wartetAuf: string;
  /** Lokales Datum (YYYY-MM-DD), seit dem die Aufgabe im Status "wartet" ist. */
  wartetSeit?: string;
  kontaktId: string;
  anforderung?: string; // RTF html
  aktuellerStand?: string; // RTF html
  verlauf?: TaskProgressEntry[];
  /** @deprecated Wird beim Laden in aktuellerStand migriert. */
  beschreibung?: string;
  /** @deprecated Wird beim Laden in aktuellerStand migriert. */
  notizen?: string;
  afns: string[];
  commIds: string[];
  /** Projektspezifische Verknüpfung zu ERP-Modulen des Kunden. */
  moduleIds?: string[];
  fremdverknuepfung?: string;
  ticketsystemVerknuepfung?: string;
  teilprojekt?: string;
  erstelltAm: string; // ISO datetime
  abgeschlossenAm: string | null; // ISO datetime
  doku: boolean;
  dokuErledigt: boolean;
  /** Für die Themenliste der nächsten Projektbesprechung vorgemerkt. */
  naechsteBesprechung?: boolean;
}

export type MilestoneStatus = 'geplant' | 'in Arbeit' | 'erledigt';

export interface Milestone {
  id: string;
  titel: string;
  datum: string;
  status: MilestoneStatus;
  notiz: string; // RTF html
}

export interface UpdateEntry {
  id: string;
  titel: string;
  datum: string;
  revision: string;
  beschreibung: string; // RTF html
  afns: string[];
}

export interface AiSummary {
  points: string[];
  generatedAt: string;
}

export interface DailyBriefing {
  points: string[];
  generatedAt: string;
}

export interface KnowledgeManualEntry {
  id: string;
  titel: string;
  kategorie: string;
  inhalt: string; // RTF html
  afns?: string[];
  typ: 'manual';
}

export interface KnowledgeAiEntry {
  id: string;
  titel: string;
  kategorie: string;
  inhalt: string; // RTF html
  projekte: string[];
  afns?: string[];
  typ: 'ai';
}

export interface KnowledgeBase {
  manual: KnowledgeManualEntry[];
  ai: KnowledgeAiEntry[];
  aiUpdatedAt: string | null;
}

export interface AfnLogEntry {
  datum: string;
  nummer: number;
}

/** Per-project cache of everything loaded lazily via ensureProjectData equivalent. */
export interface ProjectCache {
  contacts: Contact[];
  comms: Comm[];
  doc: DocData;
  tasks: Task[];
  timeline: Milestone[];
  updates: UpdateEntry[];
  aiSummary: AiSummary | null;
  moduleConfigs: ProjectModuleConfig[];
  notes: ProjectNote[];
}
