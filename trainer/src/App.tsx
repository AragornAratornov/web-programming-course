import { useState } from "react";
import {
  firstSet,
  secondSet,
  emptySet,
  findTask,
  countProgress,
  type Answer,
} from "./domain";
import { SetPicker } from "./components/SetPicker";
import { ProgressBar } from "./components/ProgressBar";
import { TaskList } from "./components/TaskList";
import { TaskCard } from "./components/TaskCard";

const allSets = [firstSet, secondSet, emptySet];

export default function App() {
  const [selectedSetId, setSelectedSetId] = useState(firstSet.id);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);

  // вычисляем при рендере — не храним в state
  const selectedSet = allSets.find((s) => s.id === selectedSetId) ?? emptySet;
  const selectedTask = selectedTaskId
    ? findTask(selectedSet, selectedTaskId)
    : undefined;
  const progress = countProgress(selectedSet, answers);
  const currentAnswer = selectedTask
    ? answers.find((a) => a.taskId === selectedTask.id)
    : undefined;

  function handleSelectSet(id: string) {
    setSelectedSetId(id);
    setSelectedTaskId(null); // сбрасываем выбор задания при смене набора
  }

  function handleAnswer(newAnswer: Answer) {
    setAnswers((prev) => {
      const withoutOld = prev.filter((a) => a.taskId !== newAnswer.taskId);
      return [...withoutOld, newAnswer];
    });
  }

  return (
    <main>
      <h1>Тренажёр</h1>
      <SetPicker selectedSetId={selectedSetId} onSelect={handleSelectSet} />
      <ProgressBar filled={progress.filled} total={progress.total} />

      {selectedSet.tasks.length === 0 ? (
        <p>В этом наборе пока нет заданий.</p>
      ) : (
        <div style={{ display: "flex", gap: "2rem" }}>
          <TaskList
            tasks={selectedSet.tasks}
            selectedTaskId={selectedTaskId}
            onSelect={setSelectedTaskId}
          />
          {selectedTask ? (
            <TaskCard
              task={selectedTask}
              answer={currentAnswer}
              onAnswer={handleAnswer}
            />
          ) : (
            <p>Выберите задание слева.</p>
          )}
        </div>
      )}
    </main>
  );
}