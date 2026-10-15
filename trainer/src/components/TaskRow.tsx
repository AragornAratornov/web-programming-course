import type { Task } from "../domain";

type Props = {
  task: Task;
  isSelected: boolean;
  onSelect: (id: string) => void;
};

export function TaskRow({ task, isSelected, onSelect }: Props) {
  return (
    <li>
      <button onClick={() => onSelect(task.id)} aria-current={isSelected}>
        {task.prompt}
      </button>
    </li>
  );
}