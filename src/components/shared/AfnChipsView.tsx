export default function AfnChipsView({ afns }: { afns: string[] | undefined }) {
  if (!afns || !afns.length) return null;
  return (
    <>
      {afns.map((a) => (
        <span className="afn-chip-view" key={a}>
          AFN {a}
        </span>
      ))}
    </>
  );
}
