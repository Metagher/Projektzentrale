import TaskColorSettings from './TaskColorSettings';
import WaitingOptionsSettings from './WaitingOptionsSettings';
import { useUiStore } from '../../store/uiStore';
import { useConnectionStore } from '../../store/connectionStore';
import DataValidationSettings from './DataValidationSettings';
import ModuleSettings from './ModuleSettings';

export default function SettingsView() {
  const goTo = useUiStore((state) => state.goTo);
  const email = useConnectionStore((s) => s.session?.user.email);
  const signOut = useConnectionStore((s) => s.signOut);
  return <div className="main-inner">
    <h2>Einstellungen</h2>
    <div className="sub" style={{ color: 'var(--ink-soft)', margin: '4px 0 22px', maxWidth: 620 }}>Zentrale Übersicht für Aufgabengrunddaten, Datenaustausch und KI-Konfiguration.</div>
    <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div><strong>Angemeldet als</strong><div style={{ color: 'var(--ink-soft)', fontSize: 13 }}>{email}</div></div>
      <button className="btn secondary" onClick={signOut}>Abmelden</button>
    </div>
    <div className="settings-hub">
      <button onClick={() => document.getElementById('task-settings')?.scrollIntoView({ behavior: 'smooth' })}><span>◆</span><strong>Aufgaben &amp; Grunddaten</strong><small>Farben und „Wartet auf“</small></button>
      <button onClick={() => document.getElementById('validation-settings')?.scrollIntoView({ behavior: 'smooth' })}><span>✓</span><strong>Datenvalidierung</strong><small>Daten prüfen und bereinigen</small></button>
      <button onClick={() => goTo('data')}><span>⇄</span><strong>Daten</strong><small>CSV Import und Export</small></button>
      <button onClick={() => goTo('ai-settings')}><span>✦</span><strong>KI-Einstellungen</strong><small>Zugang und Konfiguration</small></button>
    </div>
    <ModuleSettings />
    <div id="task-settings" className="settings-anchor" />
    <TaskColorSettings />
    <WaitingOptionsSettings />
    <DataValidationSettings />
  </div>;
}
