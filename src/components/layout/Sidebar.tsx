import { useUiStore } from '../../store/uiStore';

export default function Sidebar() {
  const { view, search, moreNavExpanded, goTo, setSearch, toggleMoreNav } = useUiStore();

  return (
    <div id="sidebar">
      <div className="sidebar-head">
        <h1>Projektzentrale</h1>
        <span className="tag">Consulting Übersicht</span>
      </div>
      <div className="sidebar-search">
        <input
          type="text"
          placeholder="Projekt oder Kunde suchen…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div style={{ padding: '0 16px' }}>
        <button className="new-project-btn">+ Neues Projekt</button>
        <div
          className={`dashboard-link${view === 'dashboard' ? ' active' : ''}`}
          onClick={() => goTo('dashboard')}
        >
          Dashboard — alle offenen Aufgaben
        </div>
        <div
          className={`dashboard-link${view === 'knowledge' ? ' active' : ''}`}
          onClick={() => goTo('knowledge')}
        >
          🧠 Wissensdatenbank
        </div>
        <div
          className={`dashboard-link${view === 'analytics' ? ' active' : ''}`}
          onClick={() => goTo('analytics')}
        >
          📊 Auswertung
        </div>
        <div className={`dashboard-link${view === 'ai' ? ' active' : ''}`} onClick={() => goTo('ai')}>
          🔍 KI-Suche (alle Projekte)
        </div>
        <div className="dashboard-link" onClick={toggleMoreNav}>
          ⋯ Mehr
        </div>
        {moreNavExpanded && (
          <div>
            <div
              className={`dashboard-link${view === 'settings' ? ' active' : ''}`}
              onClick={() => goTo('settings')}
            >
              ⚙ Oberpunkte verwalten
            </div>
            <div className={`dashboard-link${view === 'data' ? ' active' : ''}`} onClick={() => goTo('data')}>
              ⇅ CSV Import / Export
            </div>
            <div
              className={`dashboard-link${view === 'ai-settings' ? ' active' : ''}`}
              onClick={() => goTo('ai-settings')}
            >
              🔑 KI-Einstellungen
            </div>
          </div>
        )}
      </div>
      <div id="project-list">
        <div className="empty-hint">Keine Projekte gefunden.</div>
      </div>
    </div>
  );
}
