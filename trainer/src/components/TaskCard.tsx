import type { Answer, ShortTextTask, SingleChoiceTask, Task } from "../domain";
import { SingleChoiceForm } from "./SingleChoiceForm";
import { ShortTextForm } from "./ShortTextForm";

type Props = {
  task: Task;
  answer: Answer | undefined;
  onAnswer: (a: Answer) => void;
};

export function TaskCard({ task, answer, onAnswer }: Props) {
  if (task.kind === "single-choice") {
    const selectedOptionId =
      answer?.kind === "single-choice" ? answer.optionId : undefined;
    return (
      <SingleChoiceForm
        task={task as SingleChoiceTask}
        selectedOptionId={selectedOptionId}
        onChoose={(optionId) =>
          onAnswer({ taskId: task.id, kind: "single-choice", optionId })
        }
      />
    );
  }

  // task.kind === "short-text"
  const text = answer?.kind === "short-text" ? answer.text : "";
  return (
    <ShortTextForm
      prompt={task.prompt}
      code={(task as ShortTextTask).code}
      text={text}
      onChange={(t) =>
        onAnswer({ taskId: task.id, kind: "short-text", text: t })
      }
    />
  );
}