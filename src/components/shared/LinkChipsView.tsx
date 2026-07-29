interface Item {
  id: string;
}

interface Props<T extends Item> {
  ids: string[] | undefined;
  items: T[];
  labelFn: (item: T) => string;
  onJump: (id: string) => void;
}

export default function LinkChipsView<T extends Item>({ ids, items, labelFn, onJump }: Props<T>) {
  if (!ids || !ids.length) return null;
  return (
    <div className="link-chips-view">
      {ids.map((id) => {
        const item = items.find((x) => x.id === id);
        if (!item) return null;
        return (
          <span
            className="link-chip-view"
            key={id}
            title="Zum verknüpften Eintrag springen"
            onClick={(e) => {
              e.stopPropagation();
              onJump(id);
            }}
          >
            ↳ {labelFn(item)}
          </span>
        );
      })}
    </div>
  );
}
