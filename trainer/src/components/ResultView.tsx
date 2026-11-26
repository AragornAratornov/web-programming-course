import type { Result } from "../domain";

export function ResultView({ result }: { result: Result }) {
  return (
    <section>
      <h2>Результат</h2>
      {result.status === "pending-review" ? (
        <p>Ожидает проверки преподавателем. Балл появится позже.</p>
      ) : (
        <p>
          Результат: {result.score} / {result.maxScore}
        </p>
      )}
      <ul>
        {result.items.map((item) => (
          <li key={item.taskId}>
            <strong>{item.taskId}</strong>: {item.status}
            {item.score === null
              ? " (ожидает проверки)"
              : ` — ${item.score}/${item.maxScore}`}
            {item.feedback ? ` · ${item.feedback}` : ""}
          </li>
        ))}
      </ul>
    </section>
  );
}