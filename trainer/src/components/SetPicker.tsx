import { firstSet, secondSet, emptySet } from "../domain";

const sets = [firstSet, secondSet, emptySet];

type Props = {
  selectedSetId: string;
  onSelect: (id: string) => void;
};

export function SetPicker({ selectedSetId, onSelect }: Props) {
  return (
    <nav aria-label="Наборы">
      {sets.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelect(s.id)}
          aria-pressed={s.id === selectedSetId}
        >
          {s.title}
        </button>
      ))}
    </nav>
  );
}