import type { Answer, Task } from "../domain";

type Props = {
  task: Task;
  answer?: Answer;
  onAnswerChange?: (answer: Answer) => void;
  onAnswerClear?: () => void;
  readOnly?: boolean;
  disabled?: boolean;
  pending?: boolean;
};

export function TaskCard({
  task,
  answer,
  onAnswerChange,
  onAnswerClear,
  readOnly = false,
  disabled = false,
  pending = false,
}: Props) {
  const selectedOptionId =
    answer?.kind === "single-choice" ? answer.optionId : undefined;
  const shortTextValue = answer?.kind === "short-text" ? answer.text : "";

  return (
    <article className="task-card">
      <p>Тема: {task.topic}</p>
      <h2>{task.prompt}</h2>
      {task.code !== undefined && <pre>{task.code}</pre>}

      {task.kind === "single-choice" ? (
        <div>
          {task.options.map((opt) => (
            <label key={opt.id} style={{ display: "block" }}>
              <input
                type="radio"
                name={task.id}
                value={opt.id}
                checked={selectedOptionId === opt.id}
                disabled={readOnly || disabled}
                onChange={() => {
                  if (readOnly || disabled || !onAnswerChange) return;
                  onAnswerChange({
                    taskId: task.id,
                    kind: "single-choice",
                    optionId: opt.id,
                  });
                }}
              />
              {opt.label}
            </label>
          ))}
        </div>
      ) : (
        <textarea
          value={shortTextValue}
          disabled={readOnly || disabled}
          rows={4}
          placeholder="Введите ответ..."
          onChange={(e) => {
            if (readOnly || disabled || !onAnswerChange) return;
            onAnswerChange({
              taskId: task.id,
              kind: "short-text",
              text: e.target.value,
            });
          }}
        />
      )}

      {!readOnly && onAnswerClear && (
        <button
          type="button"
          onClick={onAnswerClear}
          disabled={disabled || answer === undefined}
          style={{ marginTop: "0.5rem" }}
        >
          Очистить ответ
        </button>
      )}

      {pending && <p style={{ color: "#a60" }}>Не подтверждено сервером</p>}
    </article>
  );
}