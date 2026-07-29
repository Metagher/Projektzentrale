export default function AiResultBlock({ loading, error, answer }: { loading: boolean; error: string | null; answer: string }) {
  if (loading) return <div className="ai-loading">Durchsuche Projektdaten…</div>;
  if (error) return <div className="ai-error">{error}</div>;
  if (answer) return <div className="ai-answer">{answer}</div>;
  return null;
}
