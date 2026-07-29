import { useState } from 'react';
import { useAiStore } from '../../store/aiStore';
import { useDataStore } from '../../store/dataStore';
import AiResultBlock from '../shared/AiResultBlock';

export default function GlobalAiSearch() {
  const projects = useDataStore((s) => s.projects) || [];
  const { aiQuery, aiAnswer, aiError, aiLoading, askGlobal } = useAiStore();
  const [input, setInput] = useState(aiQuery);

  return (
    <div className="main-inner">
      <h2>KI-Suche — alle Projekte</h2>
      <div className="sub" style={{ color: 'var(--ink-soft)', margin: '4px 0 18px', maxWidth: 640 }}>
        Stelle eine Frage in normaler Sprache — die KI durchsucht Ansprechpartner, Kommunikation, Dokumentation,
        Aufgaben und Echtlauf-Zeitpläne aller Projekte.
      </div>
      <div className="ai-box">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="z.B. Welche Projekte haben offene Punkte zur Bizerba-Anbindung? Wer ist bei Biofino der IT-Ansprechpartner?"
        />
        <button
          className="btn"
          onClick={() => {
            const q = input.trim();
            if (q) askGlobal(q);
          }}
        >
          Fragen
        </button>
      </div>
      <div className="ai-scope-note">Durchsucht {projects.length} Projekte.</div>
      <AiResultBlock loading={aiLoading} error={aiError} answer={aiAnswer} />
    </div>
  );
}
