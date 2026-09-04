import { useState } from 'react';
import { useConnectionStore } from '../../store/connectionStore';
import AiSettingsView from '../ai/AiSettingsView';
import DataView from '../data/DataView';
import AbrechnungsArtenSettings from './AbrechnungsArtenSettings';
import AbrechnungCsvImportSettings from './AbrechnungCsvImportSettings';
import AbrechnungFilterPresetSettings from './AbrechnungFilterPresetSettings';
import AbrechnungModuleSettings from './AbrechnungModuleSettings';
import AbrechnungProjectMatchSettings from './AbrechnungProjectMatchSettings';
import DataValidationSettings from './DataValidationSettings';
import ExplorerPathSettings from './ExplorerPathSettings';
import ModuleSettings from './ModuleSettings';
import ProjectTimeTypeSettings from './ProjectTimeTypeSettings';
import StundensatzSettings from './StundensatzSettings';
import TaskColorSettings from './TaskColorSettings';
import TimeEntryReviewSettings from './TimeEntryReviewSettings';
import WaitingOptionsSettings from './WaitingOptionsSettings';

type SettingsTab = 'tasks' | 'time' | 'validation' | 'data' | 'ai';

const TABS: { id: SettingsTab; icon: string; label: string; description: string }[] = [
  { id: 'tasks', icon: '◆', label: 'Aufgaben & Grunddaten', description: 'Farben, Module und „Wartet auf“' },
  { id: 'time', icon: '◷', label: 'Projektzeit', description: 'Zeittypen und Abrechnungsarten festlegen' },
  { id: 'validation', icon: '✓', label: 'Datenvalidierung', description: 'Daten prüfen und bereinigen' },
  { id: 'data', icon: '⇄', label: 'Daten', description: 'CSV Import und Export' },
  { id: 'ai', icon: '✦', label: 'KI-Einstellungen', description: 'Zugang und Konfiguration' },
];

export default function SettingsView() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('tasks');
  const email = useConnectionStore((state) => state.session?.user.email);
  const signOut = useConnectionStore((state) => state.signOut);

  return <div className="main-inner">
    <h2>Einstellungen</h2>
    <div className="sub" style={{ color: 'var(--ink-soft)', margin: '4px 0 22px', maxWidth: 620 }}>Zentrale Übersicht für Aufgabengrunddaten, Datenaustausch und KI-Konfiguration.</div>
    <div className="card settings-account-card">
      <div><strong>Angemeldet als</strong><div>{email}</div></div>
      <button className="btn secondary" onClick={signOut}>Abmelden</button>
    </div>
    <div className="settings-hub" role="tablist" aria-label="Einstellungsbereiche">
      {TABS.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} aria-controls={`settings-panel-${tab.id}`} className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}><span>{tab.icon}</span><strong>{tab.label}</strong><small>{tab.description}</small></button>)}
    </div>
    <section id={`settings-panel-${activeTab}`} className="settings-tab-panel" role="tabpanel">
      {activeTab === 'tasks' && <><ModuleSettings /><TaskColorSettings /><WaitingOptionsSettings /><ExplorerPathSettings /></>}
      {activeTab === 'time' && <><ProjectTimeTypeSettings /><TimeEntryReviewSettings /><AbrechnungsArtenSettings /><AbrechnungModuleSettings /><StundensatzSettings /><AbrechnungFilterPresetSettings /><AbrechnungCsvImportSettings /><AbrechnungProjectMatchSettings /></>}
      {activeTab === 'validation' && <DataValidationSettings />}
      {activeTab === 'data' && <DataView embedded />}
      {activeTab === 'ai' && <AiSettingsView embedded />}
    </section>
  </div>;
}
