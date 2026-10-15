import type  {SingleChoiceTask} from "../domain";

type Props = {
  task: SingleChoiceTask;
  selectedOptionId: string | undefined;
  onChoose: (optionId: string) => void;
};

export function SingleChoiceForm({ task, selectedOptionId, onChoose }: Props) {
  return (
    <fieldset>
      <legend>{task.prompt}</legend>
      {task.code && <pre>{task.code}</pre>}
      {task.options.map((opt) => (
        <label key={opt.id}>
          <input
            type="radio"
            name={task.id}
            checked={opt.id === selectedOptionId}
            onChange={() => onChoose(opt.id)}
          />
          {opt.label}
        </label>
      ))}
    </fieldset>
  );
}