import { useEffect } from 'react';
import { useDataStore } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';
import { useAiStore } from '../../store/aiStore';
import { hasEchtlauf, projectCode } from '../../lib/format';
import KommunikationTab from './tabs/KommunikationTab';
import DokumentationTab from './tabs/DokumentationTab';
import AufgabenTab from './tabs/AufgabenTab';
import EchtlaufTab from './tabs/EchtlaufTab';
import UpdateTab from './tabs/UpdateTab';
import KiSucheTab from './tabs/KiSucheTab';
import AuswertungTab from './tabs/AuswertungTab';

const STATUS_LABELS: Record<string, string> = { aktiv: 'Aktiv', pausiert: 'Pausiert', abgeschlossen: 'Abgeschlossen' };

interface Props { projectId?: string | null; paneTab?: string; onPaneTabChange?: (tab: string) => void; }

export default function ProjectView({ projectId, paneTab, onPaneTabChange }: Props = {}) {
  const globalSelectedId = useUiStore((s) => s.selectedId);
  const globalActiveTab = useUiStore((s) => s.activeTab);
  const setGlobalActiveTab = useUiStore((s) => s.setActiveTab);
  const selectedId = projectId === undefined ? globalSelectedId : projectId;
  const activeTab = paneTab ?? globalActiveTab;
  const setActiveTab = onPaneTabChange ?? setGlobalActiveTab;
  const goTo = useUiStore((s) => s.goTo);
  const projects = useDataStore((s) => s.projects);
  const cache = useDataStore((s) => s.cache);
  const ensureProjectData = useDataStore((s) => s.ensureProjectData);

  const project = projects?.find((p) => p.id === selectedId);
  const data = selectedId ? cache[selectedId] : undefined;
  const aiAvailable = useAiStore((s) => s.keyPresent);

  useEffect(() => {
    if (selectedId) ensureProjectData(selectedId);
  }, [selectedId, ensureProjectData]);

  useEffect(() => {
    if (projectId === undefined && projects && !project) goTo('dashboard');
  }, [projects, project, goTo, projectId]);

  useEffect(() => {
    if (activeTab === 'ki-suche' && !aiAvailable) setActiveTab('aufgaben');
  }, [activeTab, aiAvailable, setActiveTab]);

  if (!project || !data) {
    return (
      <div className="main-inner">
        <div className="loading-note">Lade Projekt…</div>
      </div>
    );
  }

  const echtlauf = hasEchtlauf(project);

  let tabContent = null;
  if (activeTab === 'kommunikation') tabContent = <KommunikationTab projectId={project.id} data={data} />;
  else if (activeTab === 'dokumentation') tabContent = <DokumentationTab projectId={project.id} data={data} />;
  else if (activeTab === 'zeitplan') tabContent = <EchtlaufTab projectId={project.id} data={data} />;
  else if (activeTab === 'update') tabContent = <UpdateTab project={project} data={data} />;
  else if (activeTab === 'auswertung') tabContent = <AuswertungTab project={project} data={data} />;
  else if (activeTab === 'ki-suche') tabContent = <KiSucheTab project={project} data={data} />;
  else tabContent = <AufgabenTab project={project} data={data} />;

  return (
    <div className="main-inner">
      <div className="project-header">
        <div>
          <div className="code">{projectCode(project)}</div>
          <h2>{project.name}</h2>
          <div className="sub"><span className={`stamp ${project.status}`}>{STATUS_LABELS[project.status]}</span></div>
        </div>
      </div>
      <div className="tabs">
        <button className={`tab-btn${activeTab === 'aufgaben' ? ' active' : ''}`} onClick={() => setActiveTab('aufgaben')}>
          Aufgaben
        </button>
        <button
          className={`tab-btn${activeTab === 'dokumentation' ? ' active' : ''}`}
          onClick={() => setActiveTab('dokumentation')}
        >
          Dokumentation
        </button>
        <button
          className={`tab-btn${activeTab === 'kommunikation' ? ' active' : ''}`}
          onClick={() => setActiveTab('kommunikation')}
        >
          Kommunikation
        </button>
        {echtlauf && (
          <button className={`tab-btn${activeTab === 'zeitplan' ? ' active' : ''}`} onClick={() => setActiveTab('zeitplan')}>
            Echtlauf-Zeitplan
          </button>
        )}
        <button className={`tab-btn${activeTab === 'update' ? ' active' : ''}`} onClick={() => setActiveTab('update')}>
          Update
        </button>
        <button
          className={`tab-btn${activeTab === 'auswertung' ? ' active' : ''}`}
          onClick={() => setActiveTab('auswertung')}
        >
          Auswertung
        </button>
        {aiAvailable && (
          <button className={`tab-btn${activeTab === 'ki-suche' ? ' active' : ''}`} onClick={() => setActiveTab('ki-suche')}>
            KI-Suche
          </button>
        )}
      </div>
      <div>{tabContent}</div>
    </div>
  );
}
