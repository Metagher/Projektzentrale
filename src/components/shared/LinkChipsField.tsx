import { useState } from 'react';

interface Item {
  id: string;
}

interface Props<T extends Item> {
  ids: string[];
  items: T[];
  labelFn: (item: T) => string;
  placeholder: string;
  onChange: (ids: string[]) => void;
  onJump?: (id: string) => void;
}

export default function LinkChipsField<T extends Item>({ ids, items, labelFn, placeholder, onChange, onJump }: Props<T>) {
  const [selectVal, setSelectVal] = useState('');
  const available = items.filter((it) => !ids.includes(it.id));

  function addSelected() {
    if (!selectVal) return;
    if (!ids.includes(selectVal)) onChange([...ids, selectVal]);
    setSelectVal('');
  }

  return (
    <div className="link-field">
      <div className="link-chips">
        {ids.map((id) => {
          const item = items.find((x) => x.id === id);
          if (!item) return null;
          return (
            <span
              className="link-chip"
              key={id}
              title="Zum verknüpften Eintrag springen"
              onClick={() => onJump?.(id)}
            >
              <span className="link-chip-label">{labelFn(item)}</span>
              <button
                type="button"
                className="link-remove"
                title="Verknüpfung entfernen"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(ids.filter((x) => x !== id));
                }}
              >
                ×
              </button>
            </span>
          );
        })}
      </div>
      <div className="link-add-row">
        <select className="link-select" value={selectVal} onChange={(e) => setSelectVal(e.target.value)}>
          <option value="">{placeholder}</option>
          {available.map((it) => (
            <option key={it.id} value={it.id}>
              {labelFn(it)}
            </option>
          ))}
        </select>
        <button type="button" className="btn secondary small link-add-btn" onClick={addSelected}>
          + Verknüpfen
        </button>
      </div>
    </div>
  );
}
