import { useEffect, useReducer, useRef, useState } from "react";
import {
  DRAFT_STORAGE_KEY,
  DRAFT_VERSION,
  countProgress,
  findAnswer,
  isAnswerFilled,
  parseDraft,
  trainingSet,
  type Answer,
  type Draft,
} from "./domain";
import { TaskCard } from "./components/TaskCard";

type Status = "in-progress" | "submitted";

type State = {
  answers: Answer[];
  currentIndex: number;
  status: Status;
  restored: boolean;
};

type Action =
  | { type: "answerChanged"; answer: Answer }
  | { type: "moved"; index: number }
  | { type: "restored"; payload: Draft }
  | { type: "reset" }
  | { type: "submitted" };

const totalTasks = trainingSet.tasks.length;

function initialState(): State {
  return {
    answers: [],
    currentIndex: 0,
    status: "in-progress",
    restored: false,
  };
}

function indexOfTask(taskId: string): number {
  const idx = trainingSet.tasks.findIndex((t) => t.id === taskId);
  return idx === -1 ? 0 : idx;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "answerChanged": {
      if (state.status === "submitted") return state;
      const next = [
        ...state.answers.filter((a) => a.taskId !== action.answer.taskId),
        action.answer,
      ];
      return { ...state, answers: next };
    }
    case "moved": {
      if (state.status === "submitted") return state;
      if (action.index < 0 || action.index >= totalTasks) return state;
      return { ...state, currentIndex: action.index };
    }
    case "restored": {
      return {
        answers: action.payload.answers,
        currentIndex: indexOfTask(action.payload.taskId),
        status: action.payload.status,
        restored: true,
      };
    }
    case "reset":
      return initialState();
    case "submitted": {
      if (state.status === "submitted") return state;
      return { ...state, status: "submitted" };
    }
    default:
      return state;
  }
}

type StorageNotice =
  | { kind: "none" }
  | { kind: "corrupted"; message: string }
  | { kind: "foreign"; setId: string }
  | { kind: "write-failed" };

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [notice, setNotice] = useState<StorageNotice>({ kind: "none" });
  const readOnce = useRef(false);

  const tasks = trainingSet.tasks;
  const currentTask = tasks[state.currentIndex];
  const currentAnswer = currentTask
    ? findAnswer(state.answers, currentTask.id)
    : undefined;
  const progress = countProgress(trainingSet, state.answers);

  // Чтение черновика — строго один раз при монтировании.
  useEffect(() => {
    if (readOnce.current) return;
    readOnce.current = true;
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    } catch {
      // Чтение недоступно — продолжаем с пустой попыткой, но без блокировки ввода.
      setNotice({ kind: "write-failed" });
      return;
    }
    const result = parseDraft(raw, trainingSet);
    switch (result.kind) {
      case "empty":
        break;
      case "ok":
        dispatch({ type: "restored", payload: result.draft });
        break;
      case "corrupted":
        setNotice({ kind: "corrupted", message: result.message });
        break;
      case "foreign":
        setNotice({ kind: "foreign", setId: result.setId });
        break;
    }
  }, []);

  // Запись черновика — только после попытки чтения.
  useEffect(() => {
    if (!readOnce.current) return;
    // Если черновик повреждён/чужой и пользователь ещё не решил — не перезаписываем.
    if (notice.kind === "corrupted" || notice.kind === "foreign") return;
    const draft: Draft = {
      version: DRAFT_VERSION,
      setId: trainingSet.id,
      taskId: tasks[state.currentIndex]?.id ?? "",
      answers: state.answers,
      status: state.status,
    };
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      if (notice.kind === "write-failed") setNotice({ kind: "none" });
    } catch {
      setNotice({ kind: "write-failed" });
    }
  }, [state.answers, state.currentIndex, state.status, notice.kind, tasks]);

  function handleAnswerChange(newAnswer: Answer) {
    dispatch({ type: "answerChanged", answer: newAnswer });
  }

  function goPrev() {
    dispatch({ type: "moved", index: state.currentIndex - 1 });
  }

  function goNext() {
    dispatch({ type: "moved", index: state.currentIndex + 1 });
  }

  function unfinishedList(): string[] {
    const result: string[] = [];
    tasks.forEach((task, i) => {
      const answer = findAnswer(state.answers, task.id);
      if (!answer || !isAnswerFilled(answer)) {
        result.push(`${i + 1}. ${task.prompt}`);
      }
    });
    return result;
  }

  function handleFinish() {
    if (state.status === "submitted") return;
    const unfinished = unfinishedList();
    if (unfinished.length > 0) {
      const ok = window.confirm(
        "Есть незаполненные задания:\n" +
          unfinished.map((u) => "- " + u).join("\n") +
          "\n\nЗавершить попытку?"
      );
      if (!ok) return;
    }
    dispatch({ type: "submitted" });
  }

  function handleReset() {
    if (!window.confirm("Сбросить черновик и начать новую попытку?")) return;
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // Даже если удалить не удалось — продолжаем в памяти.
    }
    setNotice({ kind: "none" });
    dispatch({ type: "reset" });
  }

  function renderNotice() {
    switch (notice.kind) {
      case "none":
        return null;
      case "corrupted":
        return (
          <div role="alert" style={{ border: "1px solid #c33", padding: "0.5rem", margin: "0.5rem 0" }}>
            <p>Черновик повреждён: {notice.message}. Ввод доступен, сброс — по кнопке.</p>
            <button type="button" onClick={handleReset}>Сбросить черновик</button>
          </div>
        );
      case "foreign":
        return (
          <div role="alert" style={{ border: "1px solid #c33", padding: "0.5rem", margin: "0.5rem 0" }}>
            <p>Черновик относится к набору «{notice.setId}», а не к «{trainingSet.id}».</p>
            <button type="button" onClick={handleReset}>Сбросить и начать заново</button>
          </div>
        );
      case "write-failed":
        return (
          <p role="status" style={{ color: "#a60" }}>
            Черновик не сохраняется: localStorage недоступен. Ввод продолжается в этой вкладке.
          </p>
        );
    }
  }

  if (tasks.length === 0) {
    return (
      <main style={{ padding: "1rem", fontFamily: "system-ui" }}>
        <h1>{trainingSet.title}</h1>
        <p>В наборе нет заданий.</p>
      </main>
    );
  }

  if (state.status === "submitted") {
    return (
      <main style={{ padding: "1rem", fontFamily: "system-ui" }}>
        <h1>{trainingSet.title}</h1>
        {renderNotice()}
        <p>Попытка завершена</p>
        <p>Прогресс: {progress.filled} / {progress.total}</p>

        <h2>Обзор ответов</h2>
        {tasks.map((task, i) => {
          const answer = findAnswer(state.answers, task.id);
          return (
            <section key={task.id}>
              <p>Задание {i + 1}</p>
              <TaskCard task={task} answer={answer} readOnly />
            </section>
          );
        })}

        <button type="button" onClick={handleReset} style={{ marginTop: "1rem" }}>
          Начать новую попытку
        </button>
      </main>
    );
  }

  return (
    <main style={{ padding: "1rem", fontFamily: "system-ui" }}>
      <h1>{trainingSet.title}</h1>
      {renderNotice()}
      <p>Задание {state.currentIndex + 1} / {tasks.length}</p>
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
        <button type="button" onClick={goPrev} disabled={state.currentIndex === 0}>
          Назад
        </button>
        {state.currentIndex < tasks.length - 1 ? (
          <button type="button" onClick={goNext}>Дальше</button>
        ) : (
          <button type="button" onClick={handleFinish}>Завершить попытку</button>
        )}
      </div>
    </main>
  );
}