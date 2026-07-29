import { useEffect } from 'react';
import { useAiStore } from '../../store/aiStore';
import { fmtDateTime } from '../../lib/format';

export default function DailyBriefingCard() {
  const { dailyBriefing, dailyBriefingLoading, dailyBriefingError, loadDailyBriefing, refreshDailyBriefing, keyPresent } =
    useAiStore();
  const aiAvailable = keyPresent;

  useEffect(() => {
    if (aiAvailable) loadDailyBriefing();
  }, [aiAvailable, loadDailyBriefing]);

  if (!aiAvailable) return null;

  return (
    <div className="ai-summary-card ai-advisor-card">
      {dailyBriefingLoading ? (
        <>
          <div className="ai-summary-head">
            <h3>🧭 Dein persönlicher Berater</h3>
          </div>
          <div className="ai-loading">Werte Aufgaben und Termine aus…</div>
        </>
      ) : dailyBriefingError ? (
        <>
          <div className="ai-summary-head">
            <h3>🧭 Dein persönlicher Berater</h3>
            <button className="btn secondary small" onClick={refreshDailyBriefing}>
              Erneut versuchen
            </button>
          </div>
          <div className="ai-error">{dailyBriefingError}</div>
        </>
      ) : dailyBriefing && dailyBriefing.points.length ? (
        <>
          <div className="ai-summary-head">
            <h3>🧭 Dein persönlicher Berater</h3>
            <button className="btn secondary small" onClick={refreshDailyBriefing}>
              ↻ Aktualisieren
            </button>
          </div>
          <ul className="ai-summary-list">
            {dailyBriefing.points.map((pt, i) => (
              <li key={i}>{pt}</li>
            ))}
          </ul>
          <div className="ai-summary-meta">Erstellt: {fmtDateTime(dailyBriefing.generatedAt)}</div>
        </>
      ) : (
        <>
          <div className="ai-summary-head">
            <h3>🧭 Dein persönlicher Berater</h3>
            <button className="btn secondary small" onClick={refreshDailyBriefing}>
              Einschätzung erstellen
            </button>
          </div>
          <div className="ai-summary-empty">
            Noch keine Tages-Einschätzung erstellt. Lässt sich auf Basis deiner offenen Aufgaben und Termine erzeugen.
          </div>
        </>
      )}
    </div>
  );
}
