import type { Answer, Task } from "../domain";

type Props = {
  task: Task;
  answer?: Answer;
  onAnswerChange?: (answer: Answer) => void;
  readOnly?: boolean;
};

export function TaskCard({ task, answer, onAnswerChange, readOnly = false }: Props) {
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
                disabled={readOnly}
                onChange={() => {
                  if (readOnly || !onAnswerChange) return;
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
          disabled={readOnly}
          rows={4}
          placeholder="Введите ответ..."
          onChange={(e) => {
            if (readOnly || !onAnswerChange) return;
            onAnswerChange({
              taskId: task.id,
              kind: "short-text",
              text: e.target.value,
            });
          }}
        />
      )}
    </article>
  );
}