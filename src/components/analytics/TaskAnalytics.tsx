import { useAnalyticsStore } from '../../store/analyticsStore';
import { avg, computeTaskAnalytics, dailyCountKey, fmtDays, median } from '../../lib/analytics';
import { prioLabel } from '../../lib/constants';
import { fmtDate, slug, todayStr } from '../../lib/format';
import type { TaskWithMeta } from '../../store/dataStore';

export default function TaskAnalytics({ allTasks, showProjectBreakdown }: { allTasks: TaskWithMeta[]; showProjectBreakdown: boolean }) {
  const { analyticsYear, analyticsDailyRange, setAnalyticsYear, setAnalyticsDailyRange } = useAnalyticsStore();
  const data = computeTaskAnalytics(allTasks, analyticsYear, analyticsDailyRange);
  const todayKey = todayStr();

  return (
    <>
      <div className="stat-row">
        <div className="stat-card">
          <div className="num">{data.withDurationCount}</div>
          <div className="label">Ausgewertete Aufgaben</div>
        </div>
        <div className="stat-card">
          <div className="num">{fmtDays(data.avgDuration)}</div>
          <div className="label">Ø Durchlaufzeit</div>
        </div>
        <div className="stat-card">
          <div className="num">{fmtDays(data.medianDuration)}</div>
          <div className="label">Median Durchlaufzeit</div>
        </div>
      </div>

      {showProjectBreakdown && (
        <>
          <div className="section-title">Durchlaufzeit nach Projekt</div>
          {data.byProject.length === 0 ? (
            <div className="empty-state">
              <h3>Noch keine Daten</h3>
              <div>Sobald Aufgaben mit Erstell- und Abschlussdatum vorliegen, erscheinen hier Auswertungen.</div>
            </div>
          ) : (
            <table className="an-table">
              <tbody>
                <tr>
                  <th>Projekt</th>
                  <th>Anzahl</th>
                  <th>Ø Tage</th>
                  <th>Median Tage</th>
                </tr>
                {data.byProject.map((p) => (
                  <tr key={p.name}>
                    <td>{p.name}</td>
                    <td>{p.durations.length}</td>
                    <td>{fmtDays(avg(p.durations))}</td>
                    <td>{fmtDays(median(p.durations))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      <div className="section-title">Durchlaufzeit nach Priorität</div>
      {data.byPrio.length === 0 ? (
        <div className="empty-state">
          <h3>Noch keine Daten</h3>
        </div>
      ) : (
        <table className="an-table">
          <tbody>
            <tr>
              <th>Priorität</th>
              <th>Anzahl</th>
              <th>Ø Tage</th>
              <th>Median Tage</th>
            </tr>
            {data.byPrio.map((p) => (
              <tr key={p.key}>
                <td>
                  <span className={`prio-dot prio-${slug(p.key)}`} style={{ display: 'inline-block', marginRight: 6 }} />
                  {prioLabel(p.key)}
                </td>
                <td>{p.durations.length}</td>
                <td>{fmtDays(avg(p.durations))}</td>
                <td>{fmtDays(median(p.durations))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Jahresübersicht — abgeschlossene Aufgaben pro Kalenderwoche</span>
        <select className="an-year-select" value={data.year} onChange={(e) => setAnalyticsYear(parseInt(e.target.value))}>
          {data.sortedYears.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      {data.completedCount === 0 ? (
        <div className="empty-state">
          <h3>Noch keine abgeschlossenen Aufgaben</h3>
        </div>
      ) : (
        <div className="an-week-grid">
          {Array.from({ length: data.weeksInYear }, (_, i) => i + 1).map((w) => {
            const count = data.weeklyCounts[w] || 0;
            const barPct = data.maxWeekCount > 0 ? Math.round((count / data.maxWeekCount) * 100) : 0;
            const isCurrent = data.year === data.currentWeek.year && w === data.currentWeek.week;
            return (
              <div className={`an-week-cell${isCurrent ? ' an-current' : ''}`} key={w}>
                <div className="an-week-bar" style={{ height: `${barPct}%` }} />
                <div className="an-week-num">KW {w}</div>
                <div className="an-week-count">{count}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Offene Aufgaben am Tagesanfang</span>
        <select className="an-year-select" value={analyticsDailyRange} onChange={(e) => setAnalyticsDailyRange(parseInt(e.target.value))}>
          <option value={14}>Letzte 14 Tage</option>
          <option value={30}>Letzte 30 Tage</option>
          <option value={60}>Letzte 60 Tage</option>
          <option value={90}>Letzte 90 Tage</option>
        </select>
      </div>
      <div className="an-note">
        Anzahl Aufgaben, die um 00:00 Uhr bereits angelegt und noch nicht abgeschlossen waren. Aufgaben ohne
        Erstelldatum fließen hier nicht ein.
      </div>
      {data.dailyCounts.every((d) => d.count === 0) ? (
        <div className="empty-state">
          <h3>Keine Daten</h3>
          <div>Sobald Aufgaben mit Erstelldatum vorliegen, erscheint hier der Tagesverlauf.</div>
        </div>
      ) : (
        <div className="an-week-grid an-daily-grid">
          {data.dailyCounts.map((d) => {
            const dKey = dailyCountKey(d.date);
            const barPct = data.dailyMax > 0 ? Math.round((d.count / data.dailyMax) * 100) : 0;
            const isToday = dKey === todayKey;
            return (
              <div className={`an-week-cell${isToday ? ' an-current' : ''}`} key={dKey} title={fmtDate(dKey)}>
                <div className="an-week-bar" style={{ height: `${barPct}%` }} />
                <div className="an-week-num">
                  {d.date.getUTCDate()}.{d.date.getUTCMonth() + 1}.
                </div>
                <div className="an-week-count">{d.count}</div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
