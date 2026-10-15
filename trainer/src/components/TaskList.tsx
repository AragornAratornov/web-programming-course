import type { Task } from "../domain";
import { TaskRow } from "./TaskRow";

type Props = {
  tasks: Task[];
  selectedTaskId: string | null;
  onSelect: (id: string) => void;
};

export function TaskList({ tasks, selectedTaskId, onSelect }: Props) {
  if (tasks.length === 0) {
    return <p>В этом наборе пока нет заданий.</p>;
  }

  return (
    <ul>
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          isSelected={task.id === selectedTaskId}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}