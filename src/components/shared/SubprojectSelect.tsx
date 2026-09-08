import type { Subproject } from '../../types/entities';

interface Props {
  subprojects: Subproject[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

/** Echte Auswahl aus den in den Projektgrunddaten definierten Teilprojekten; ein noch vorhandener Altwert wird als zusätzliche Option angeboten, statt ihn stillschweigend zu verwerfen. */
export default function SubprojectSelect({ subprojects, value, onChange, label = 'Teilprojekt' }: Props) {
  const options = value.trim() && !subprojects.some((item) => item.name === value)
    ? [...subprojects, { id: '_legacy', name: value, sortIndex: -1, createdAt: '' }]
    : subprojects;
  return (
    <div className="field">
      <label>{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">— kein Teilprojekt —</option>
        {options.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
      </select>
    </div>
  );
}
