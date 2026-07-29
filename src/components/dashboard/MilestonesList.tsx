import { useUiStore } from '../../store/uiStore';
import { fmtDate, slug } from '../../lib/format';
import type { MilestoneWithMeta } from '../../store/dataStore';

export default function MilestonesList({ milestones }: { milestones: MilestoneWithMeta[] }) {
  if (milestones.length === 0) return null;

  function goToProject(projectId: string) {
    useUiStore.setState({ view: 'project', selectedId: projectId, activeTab: 'aufgaben' });
  }

  return (
    <>
      <div className="section-title">Anstehende Echtlauf-Meilensteine</div>
      {milestones.slice(0, 15).map((m) => (
        <div className="agg-row" key={m.id}>
          <span className={`badge ${slug(m.status)}`}>{m.status}</span>
          <span className="agg-project" onClick={() => goToProject(m.projectId)}>
            {m.projectName}
          </span>
          <span className="agg-title">{m.titel}</span>
          <span className="agg-date">{fmtDate(m.datum)}</span>
        </div>
      ))}
    </>
  );
}
