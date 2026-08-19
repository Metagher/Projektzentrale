import { useDataStore } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';
import { useAiStore } from '../../store/aiStore';
import { useModalStore } from '../../store/modalStore';
import { todayStr } from '../../lib/format';
import { groupProjectsByCustomer, orderCustomerGroups } from '../../lib/projectGroups';
import { useInstallApp } from '../../hooks/useInstallApp';

export default function ProjectQuickBar() {
  const { canInstall, install } = useInstallApp();
  const projects = useDataStore((state) => state.projects);
  const view = useUiStore((state) => state.view);
  const selectedId = useUiStore((state) => state.selectedId);
  const secondaryPane = useUiStore((state) => state.secondaryPane);
  const setSecondaryPane = useUiStore((state) => state.setSecondaryPane);
  const aiAvailable = useAiStore((state) => state.keyPresent);
  const newProjectForm = useModalStore((state) => state.newProjectForm);
  const createProject = useDataStore((state) => state.createProject);
  const dashboardData = useDataStore((state) => state.dashboardData);

  async function create() {
    const result = await newProjectForm();
    if (!result) return;
    const id = await createProject(result);
    useUiStore.setState({ view: 'project-management', selectedId: id });
  }

  function dragPane(event: DragEvent, pane: { view: 'dashboard' | 'calendar' | 'knowledge' | 'project'; selectedId: string | null; activeTab: string }) {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/x-projectzentrale-pane', JSON.stringify(pane));
  }

  const sorted = projects || [];
  const customerOrder = useDataStore((state) => state.customerOrder);
  const customerGroups = orderCustomerGroups(groupProjectsByCustomer(sorted), customerOrder);
  const todayTasks = dashboardData ? dashboardData.tasksWithDate
    .filter((task, index, list) => task.faelligAm === todayStr() && list.findIndex((item) => item.id === task.id) === index)
    .sort((a, b) => (a.tagesSortierung ?? 999) - (b.tagesSortierung ?? 999) || (a.erstelltAm || '').localeCompare(b.erstelltAm || '') || a.nr - b.nr) : [];
  const projectTodayRanks = todayTasks.slice(0, 3).reduce<Record<string, number[]>>((ranks, task, index) => {
    (ranks[task.projectId] ||= []).push(index + 1);
    return ranks;
  }, {});

  return (
    <nav className="project-quickbar" aria-label="Projektschnellwahl">
      <button className="top-brand" onClick={() => useUiStore.getState().goTo('dashboard')} title="Projektzentrale">PZ</button>
      <div className="top-primary-nav" aria-label="Hauptbereiche">
        <button draggable className={view === 'dashboard' ? 'active' : ''} onDragStart={(event) => dragPane(event, { view: 'dashboard', selectedId: null, activeTab: 'aufgaben' })} onClick={() => useUiStore.getState().goTo('dashboard')} title="Dashboard – ziehen oder öffnen" aria-label="Dashboard">⌂</button>
        <button draggable className={view === 'calendar' ? 'active' : ''} onDragStart={(event) => dragPane(event, { view: 'calendar', selectedId: null, activeTab: 'aufgaben' })} onClick={() => useUiStore.getState().goTo('calendar')} title="Kalender – ziehen oder öffnen" aria-label="Kalender">▤</button>
        <button draggable className={view === 'knowledge' ? 'active' : ''} onDragStart={(event) => dragPane(event, { view: 'knowledge', selectedId: null, activeTab: 'aufgaben' })} onClick={() => useUiStore.getState().goTo('knowledge')} title="Wissensdatenbank – ziehen oder öffnen" aria-label="Wissensdatenbank">◇</button>
        <button className={view === 'analytics' ? 'active' : ''} onClick={() => useUiStore.getState().goTo('analytics')} title="Auswertung" aria-label="Auswertung">↗</button>
        {aiAvailable && <button className={view === 'ai' ? 'active' : ''} onClick={() => useUiStore.getState().goTo('ai')} title="KI-Suche" aria-label="KI-Suche">✦</button>}
      </div>
      <span className="project-quickbar-label">Projekte</span>
      <div className="project-quickbar-scroll">
        {sorted.length === 0 && <span className="project-quickbar-empty">Noch keine Projekte</span>}
        {customerGroups.map((group) => <div className="project-quickbar-group" key={group.key}>
          <span className="project-quickbar-customer">{group.label}</span>
          <div className="project-quickbar-projects">{group.projects.map((project) => (
            <button
              className={`project-quickbar-item${view === 'project' && selectedId === project.id ? ' active' : ''}`}
              key={project.id}
              draggable
              onDragStart={(event) => dragPane(event, { view: 'project', selectedId: project.id, activeTab: 'aufgaben' })}
              title={`${project.name} · ${group.label}`}
              onClick={() => useUiStore.setState({ view: 'project', selectedId: project.id, activeTab: 'aufgaben', sidebarOpen: false })}
            >
              <span className={`status-dot ${project.status}`} />
              <span>{project.name}</span>
              {projectTodayRanks[project.id]?.map((rank) => <b className="project-today-rank" key={rank}>#{rank}</b>)}
            </button>
          ))}</div>
        </div>)}
      </div>
      <div className="top-admin-nav">
        {canInstall && <button onClick={install} title="App auf diesem Gerät installieren" aria-label="App installieren">⇩</button>}
        <button className={secondaryPane ? 'active' : ''} onClick={() => secondaryPane ? useUiStore.getState().closeSecondaryPane() : setSecondaryPane({ view: 'dashboard', selectedId: null, activeTab: 'aufgaben' })} title={secondaryPane ? 'Geteilte Ansicht schließen' : 'Bildschirm teilen'} aria-label="Bildschirm teilen">◫</button>
        <button onClick={create} title="Neues Projekt" aria-label="Neues Projekt">＋</button>
        <button className={view === 'project-management' ? 'active' : ''} onClick={() => useUiStore.getState().goTo('project-management')} title="Projektverwaltung" aria-label="Projektverwaltung">▦</button>
        <button className={view === 'settings' || view === 'data' || view === 'ai-settings' ? 'active' : ''} onClick={() => useUiStore.getState().goTo('settings')} title="Einstellungen" aria-label="Einstellungen">⚙</button>
      </div>
    </nav>
  );
}
import type { DragEvent } from 'react';
