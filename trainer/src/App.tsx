import { useState } from "react";
import {trainingSet,
  countProgress,
  findAnswer,
  isAnswerFilled,
  type Answer,
} from "./domain";
import { TaskCard } from "./components/TaskCard";

type AttemptStatus = "in-progress" | "submitted";

export default function App() {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState<AttemptStatus>("in-progress");

  const tasks = trainingSet.tasks;
  const totalTasks = tasks.length;
  const currentTask = tasks[currentIndex];
  const currentAnswer = currentTask
    ? findAnswer(answers, currentTask.id)
    : undefined;

  const progress = countProgress(trainingSet, answers);

  function handleAnswerChange(newAnswer: Answer) {
    if (status === "submitted") return;
    setAnswers((prev) => [
      ...prev.filter((a) => a.taskId !== newAnswer.taskId),
      newAnswer,
    ]);
  }

  function goPrev() {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  }

  function goNext() {
    if (currentIndex < totalTasks - 1) setCurrentIndex((i) => i + 1);
  }

  function unfinishedList(): string[] {
    const result: string[] = [];
    tasks.forEach((task, i) => {
      const answer = findAnswer(answers, task.id);
      if (!answer || !isAnswerFilled(answer)) {
        result.push(`${i + 1}. ${task.prompt}`);
      }
    });
    return result;
  }

  function handleFinish() {
    if (status === "submitted") return;
    const unfinished = unfinishedList();
    if (unfinished.length > 0) {
      const ok = window.confirm(
        "Есть незаполненные задания:\n" +
          unfinished.map((u) => "- " + u).join("\n") +
          "\n\nЗавершить попытку?"
      );
      if (!ok) return;
    }
    setStatus("submitted");
  }

  function handleRestart() {
    setAnswers([]);
    setCurrentIndex(0);
    setStatus("in-progress");
  }

  if (totalTasks === 0) {
    return (
      <main style={{ padding: "1rem", fontFamily: "system-ui" }}>
        <h1>{trainingSet.title}</h1>
        <p>В наборе нет заданий.</p>
      </main>
    );
  }

  if (status === "submitted") {
    return (
      <main style={{ padding: "1rem", fontFamily: "system-ui" }}>
        <h1>{trainingSet.title}</h1>
        <p>Попытка завершена</p>
        <p>Прогресс: {progress.filled} / {progress.total}</p>

        <h2>Обзор ответов</h2>
        {tasks.map((task, i) => {
          const answer = findAnswer(answers, task.id);
          return (
            <section key={task.id}>
              <p>Задание {i + 1}</p>
              <TaskCard task={task} answer={answer} readOnly />
            </section>
          );
        })}

        <button type="button" onClick={handleRestart} style={{ marginTop: "1rem" }}>
          Начать новую попытку
        </button>
      </main>
    );
  }

  return (
    <main style={{ padding: "1rem", fontFamily: "system-ui" }}>
      <h1>{trainingSet.title}</h1>
      <p>Задание {currentIndex + 1} / {totalTasks}</p>
      <p>Прогресс: {progress.filled} / {progress.total}</p>

      {currentTask ? (
        <TaskCard
          task={currentTask}
          answer={currentAnswer}
          onAnswerChange={handleAnswerChange}
          readOnly={false}
        />
      ) : (
        <p>Задание не найдено.</p>
      )}

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
        <button type="button" onClick={goPrev} disabled={currentIndex === 0}>
          Назад
        </button>
        {currentIndex < totalTasks - 1 ? (
          <button type="button" onClick={goNext}>Дальше</button>
        ) : (
          <button type="button" onClick={handleFinish}>Завершить попытку</button>
        )}
      </div>
    </main>
  );
}