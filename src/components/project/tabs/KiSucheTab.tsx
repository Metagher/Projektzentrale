import { useState } from 'react';
import { useAiStore } from '../../../store/aiStore';
import AiResultBlock from '../../shared/AiResultBlock';
import type { Project, ProjectCache } from '../../../types/entities';

export default function KiSucheTab({ project, data }: { project: Project; data: ProjectCache }) {
  const { projectAiQuery, projectAiAnswer, projectAiError, projectAiLoading, askProject } = useAiStore();
  const [input, setInput] = useState(projectAiQuery);

  return (
    <>
      <div className="sub" style={{ color: 'var(--ink-soft)', margin: '0 0 14px', maxWidth: 600 }}>
        Stelle eine Frage zu diesem Projekt — die KI durchsucht nur die Daten von „{project.name}" (Ansprechpartner,
        Kommunikation, Dokumentation, Aufgaben, Zeitplan).
      </div>
      <div className="ai-box">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="z.B. Was wurde zuletzt mit dem Kunden zur DIGI-Anbindung besprochen?"
        />
        <button
          className="btn"
          onClick={() => {
            const q = input.trim();
            if (q) askProject(project, data, q);
          }}
        >
          Fragen
        </button>
      </div>
      <AiResultBlock loading={projectAiLoading} error={projectAiError} answer={projectAiAnswer} />
    </>
  );
}
