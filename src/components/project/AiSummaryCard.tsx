import { useAiStore } from '../../store/aiStore';
import { fmtDateTime } from '../../lib/format';
import type { Project, ProjectCache } from '../../types/entities';

export default function AiSummaryCard({ project, data }: { project: Project; data: ProjectCache }) {
  const { projectAiSummaryLoading, projectAiSummaryError, refreshProjectAiSummary, keyPresent } = useAiStore();
  if (!keyPresent) return null;

  const summary = data.aiSummary;

  return (
    <div className="ai-summary-card">
      {projectAiSummaryLoading ? (
        <>
          <div className="ai-summary-head">
            <h3>KI-Übersicht</h3>
          </div>
          <div className="ai-loading">Erstelle Übersicht…</div>
        </>
      ) : projectAiSummaryError ? (
        <>
          <div className="ai-summary-head">
            <h3>KI-Übersicht</h3>
            <button className="btn secondary small" onClick={() => refreshProjectAiSummary(project, data)}>
              Erneut versuchen
            </button>
          </div>
          <div className="ai-error">{projectAiSummaryError}</div>
        </>
      ) : summary && summary.points.length ? (
        <>
          <div className="ai-summary-head">
            <h3>KI-Übersicht</h3>
            <button className="btn secondary small" onClick={() => refreshProjectAiSummary(project, data)}>
              ↻ Aktualisieren
            </button>
          </div>
          <ul className="ai-summary-list">
            {summary.points.map((pt, i) => (
              <li key={i}>{pt}</li>
            ))}
          </ul>
          <div className="ai-summary-meta">Erstellt: {fmtDateTime(summary.generatedAt)}</div>
        </>
      ) : (
        <>
          <div className="ai-summary-head">
            <h3>KI-Übersicht</h3>
            <button className="btn secondary small" onClick={() => refreshProjectAiSummary(project, data)}>
              KI-Übersicht erstellen
            </button>
          </div>
          <div className="ai-summary-empty">Noch keine KI-Übersicht für dieses Projekt erstellt.</div>
        </>
      )}
    </div>
  );
}
