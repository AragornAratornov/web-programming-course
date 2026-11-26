import { useEffect, useReducer, useRef, useState } from "react";
import {
  countProgress,
  findAnswer,
  findTask,
  validateAnswerForTask,
  type Answer,
  type Attempt,
  type Result,
  type TrainingSet,
  DRAFT_VERSION,
  clearDraft,
  parseDraft,
  readDraft,
  writeDraft,
  type Draft,
} from "./domain";
import {
  createAttempt,
  deleteAnswer,
  errorMessage,
  getAttempt,
  getResult,
  isStatus,
  loadSet,
  putAnswer,
  submitAttempt,
} from "./api";
import { TaskCard } from "./components/TaskCard";
import { ProgressBar } from "./components/ProgressBar";
import { ResultView } from "./components/ResultView";

const SET_ID = "web-basics";

type FailedAction =
  | { kind: "put"; answer: Answer }
  | { kind: "delete"; taskId: string }
  | { kind: "submit" }
  | { kind: "init" };

type RequestState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string; lastFailed: FailedAction };

type State = {
  set: TrainingSet | null;
  // Серверное
  attemptId: string | null;
  serverAnswers: Answer[];
  attemptStatus: "in-progress" | "submitted" | null;
  result: Result | null;

  // Локальное
  answers: Answer[];
  pending: Record<string, true>;
  currentIndex: number;

  // Запросы
  request: RequestState;
};

type Action =
  | { type: "setLoaded"; set: TrainingSet }
  | { type: "attemptCreated"; attempt: Attempt }
  | { type: "attemptLoaded"; attempt: Attempt; result: Result | null }
  | { type: "answerChanged"; answer: Answer }
  | { type: "answerConfirmed"; answer: Answer }
  | { type: "answerCleared"; taskId: string }
  | { type: "moved"; index: number }
  | { type: "requestStarted" }
  | { type: "requestFailed"; message: string; lastFailed: FailedAction }
  | { type: "requestReset" }
  | { type: "submitted"; result: Result }
  | { type: "reset" };

function initialState(): State {
  return {
    set: null,
    attemptId: null,
    serverAnswers: [],
    attemptStatus: null,
    result: null,
    answers: [],
    pending: {},
    currentIndex: 0,
    request: { status: "idle" },
  };
}

function taskIndex(set: TrainingSet | null, taskId: string): number {
  if (!set) return 0;
  const idx = set.tasks.findIndex((t) => t.id === taskId);
  return idx === -1 ? 0 : idx;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "setLoaded":
      return { ...state, set: action.set };

    case "attemptCreated":
    case "attemptLoaded": {
      const attempt = action.type === "attemptCreated" ? action.attempt : action.attempt;
      const result = action.type === "attemptLoaded" ? action.result : null;
      const restoredAnswers =
        action.type === "attemptLoaded" ? attempt.answers : [];
      return {
        ...state,
        attemptId: attempt.id,
        serverAnswers: attempt.answers,
        attemptStatus: attempt.status,
        answers: restoredAnswers,
        pending: {},
        currentIndex: 0,
        result,
      };
    }

    case "answerChanged": {
      if (state.attemptStatus === "submitted") return state;
      const next = [
        ...state.answers.filter((a) => a.taskId !== action.answer.taskId),
        action.answer,
      ];
      return {
        ...state,
        answers: next,
        pending: { ...state.pending, [action.answer.taskId]: true },
      };
    }

    case "answerConfirmed": {
      const serverAnswers = [
        ...state.serverAnswers.filter((a) => a.taskId !== action.answer.taskId),
        action.answer,
      ];
      const pending = { ...state.pending };
      delete pending[action.answer.taskId];
      return { ...state, serverAnswers, pending, request: { status: "idle" } };
    }

    case "answerCleared": {
      const serverAnswers = state.serverAnswers.filter(
        (a) => a.taskId !== action.taskId
      );
      const answers = state.answers.filter((a) => a.taskId !== action.taskId);
      const pending = { ...state.pending };
      delete pending[action.taskId];
      return { ...state, serverAnswers, answers, pending, request: { status: "idle" } };
    }

    case "moved": {
      if (!state.set) return state;
      if (action.index < 0 || action.index >= state.set.tasks.length) return state;
      return { ...state, currentIndex: action.index };
    }

    case "requestStarted":
      return { ...state, request: { status: "loading" } };

    case "requestFailed":
      return {
        ...state,
        request: {
          status: "error",
          message: action.message,
          lastFailed: action.lastFailed,
        },
      };

    case "requestReset":
      return { ...state, request: { status: "idle" } };

    case "submitted":
      return {
        ...state,
        attemptStatus: "submitted",
        result: action.result,
        request: { status: "idle" },
      };

    case "reset":
      return initialState();

    default:
      return state;
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [formError, setFormError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState<
    { kind: "none" } | { kind: "corrupted"; message: string } | { kind: "foreign"; setId: string }
  >({ kind: "none" });
  const bootstrapped = useRef(false);

  // ---------- Инициализация: набор -> attempt -> черновик ----------

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    (async () => {
      try {
        const set = await loadSet(SET_ID);
        dispatch({ type: "setLoaded", set });

        // Пробуем прочитать черновик A4.
        const raw = readDraft();
        const draftResult = parseDraft(raw, set);
        let attemptIdFromDraft: string | null = null;

        if (draftResult.kind === "ok") {
          attemptIdFromDraft = draftResult.draft.attemptId;
        } else if (draftResult.kind === "corrupted") {
          setDraftNotice({ kind: "corrupted", message: draftResult.message });
        } else if (draftResult.kind === "foreign") {
          setDraftNotice({ kind: "foreign", setId: draftResult.setId });
        }

        // Если черновик повреждён/чужой — не восстанавливаем attempt, начинаем новую попытку.
        if (draftResult.kind === "corrupted" || draftResult.kind === "foreign") {
          const created = await createAttempt(set.id);
          dispatch({ type: "attemptCreated", attempt: created });
          return;
        }

        // Пытаемся восстановить серверную попытку по attemptId.
        if (attemptIdFromDraft) {
          try {
            const attempt = await getAttempt(attemptIdFromDraft);
            let result: Result | null = null;
            if (attempt.status === "submitted") {
              try {
                result = await getResult(attemptIdFromDraft);
              } catch {
                // 409 теоретически не должен прийти для submitted; result останется null
              }
            }
            dispatch({ type: "attemptLoaded", attempt, result });
            return;
          } catch (e) {
            if (!isStatus(e, 404)) throw e;
            // 404 — попытка исчезла (сервер перезапущен). Создаём новую.
          }
        }

        const created = await createAttempt(set.id);
        dispatch({ type: "attemptCreated", attempt: created });
      } catch (e) {
        dispatch({
          type: "requestFailed",
          message: errorMessage(e),
          lastFailed: { kind: "init" },
        });
      }
    })();
  }, []);

  // ---------- Синхронизация черновика ----------

  useEffect(() => {
    if (!state.set || !state.attemptId) return;
    // Не перезаписываем при повреждённом/чужом черновике до явного сброса.
    if (draftNotice.kind === "corrupted" || draftNotice.kind === "foreign") return;

    const currentTask = state.set.tasks[state.currentIndex];
    const draft: Draft = {
      version: DRAFT_VERSION,
      setId: state.set.id,
      attemptId: state.attemptId,
      taskId: currentTask?.id ?? "",
      answers: state.answers,
      status: state.attemptStatus === "submitted" ? "submitted" : "in-progress",
    };
    const ok = writeDraft(draft);
    setStorageWarning(ok ? null : "Черновик не сохраняется: localStorage недоступен.");
  }, [
    state.set,
    state.attemptId,
    state.answers,
    state.currentIndex,
    state.attemptStatus,
    draftNotice.kind,
  ]);

  // ---------- Обработчики ----------

  async function saveAnswer(answer: Answer, demoFail = false) {
    if (!state.attemptId) return;
    dispatch({ type: "requestStarted" });
    try {
      await putAnswer(state.attemptId, answer, demoFail);
      dispatch({ type: "answerConfirmed", answer });
    } catch (e) {
      dispatch({
        type: "requestFailed",
        message: errorMessage(e),
        lastFailed: { kind: "put", answer },
      });
    }
  }

  async function handleAnswerChange(next: Answer) {
    if (!state.set || state.attemptStatus === "submitted") return;
    const task = findTask(state.set, next.taskId);
    if (!task) return;
    const validation = validateAnswerForTask(next, task);
    if (validation) {
      setFormError(validation);
      return;
    }
    setFormError(null);
    dispatch({ type: "answerChanged", answer: next });
    await saveAnswer(next);
  }

  async function handleClear() {
    if (!state.set || !state.attemptId || state.attemptStatus === "submitted") return;
    const task = state.set.tasks[state.currentIndex];
    if (!task) return;
    dispatch({ type: "requestStarted" });
    try {
      await deleteAnswer(state.attemptId, task.id);
      dispatch({ type: "answerCleared", taskId: task.id });
    } catch (e) {
      dispatch({
        type: "requestFailed",
        message: errorMessage(e),
        lastFailed: { kind: "delete", taskId: task.id },
      });
    }
  }

  async function handleSubmit() {
    if (!state.attemptId || state.attemptStatus === "submitted") return;
    if (state.request.status === "loading") return;
    const unfinished: string[] = [];
    state.set?.tasks.forEach((task, i) => {
      const answer = findAnswer(state.answers, task.id);
      if (!answer || !answer.taskId) {
        unfinished.push(`${i + 1}. ${task.prompt}`);
      }
    });
    if (unfinished.length > 0) {
      const ok = window.confirm(
        "Есть незаполненные задания:\n" +
          unfinished.map((u) => "- " + u).join("\n") +
          "\n\nЗавершить попытку?"
      );
      if (!ok) return;
    }
    dispatch({ type: "requestStarted" });
    try {
      const result = await submitAttempt(state.attemptId);
      dispatch({ type: "submitted", result });
    } catch (e) {
      dispatch({
        type: "requestFailed",
        message: errorMessage(e),
        lastFailed: { kind: "submit" },
      });
    }
  }

  function retryLast() {
    const failed = state.request.status === "error" ? state.request.lastFailed : null;
    if (!failed) return;
    if (failed.kind === "put") void saveAnswer(failed.answer);
    if (failed.kind === "delete") void handleClear();
    if (failed.kind === "submit") void handleSubmit();
    if (failed.kind === "init") window.location.reload();
  }

  function handleReset() {
    if (!window.confirm("Сбросить черновик и начать новую попытку?")) return;
    clearDraft();
    setDraftNotice({ kind: "none" });
    setFormError(null);
    setStorageWarning(null);
    // Перезагрузка — самый простой способ получить новую попытку на сервере.
    window.location.reload();
  }

  function goPrev() {
    dispatch({ type: "moved", index: state.currentIndex - 1 });
  }

  function goNext() {
    dispatch({ type: "moved", index: state.currentIndex + 1 });
  }

  // ---------- Рендер ----------

  if (!state.set) {
    return (
      <main style={{ padding: "1rem", fontFamily: "system-ui" }}>
        <h1>Тренажёр</h1>
        {state.request.status === "error" ? (
          <div role="alert">
            <p>Ошибка загрузки: {state.request.message}</p>
            <button type="button" onClick={retryLast}>Повторить</button>
          </div>
        ) : (
          <p>Загрузка набора…</p>
        )}
      </main>
    );
  }

  const set = state.set;
  const tasks = set.tasks;
  const currentTask = tasks[state.currentIndex];
  const currentAnswer = currentTask ? findAnswer(state.answers, currentTask.id) : undefined;
  const progress = countProgress(set, state.answers);
  const busy = state.request.status === "loading";
  const submitted = state.attemptStatus === "submitted";

  function renderDraftNotice() {
    if (draftNotice.kind === "corrupted") {
      return (
        <div role="alert" style={{ border: "1px solid #c33", padding: "0.5rem", margin: "0.5rem 0" }}>
          <p>Черновик повреждён: {draftNotice.message}</p>
          <button type="button" onClick={handleReset}>Сбросить черновик</button>
        </div>
      );
    }
    if (draftNotice.kind === "foreign") {
      return (
        <div role="alert" style={{ border: "1px solid #c33", padding: "0.5rem", margin: "0.5rem 0" }}>
          <p>Черновик относится к набору «{draftNotice.setId}».</p>
          <button type="button" onClick={handleReset}>Сбросить и начать заново</button>
        </div>
      );
    }
    return null;
  }

  function renderRequestError() {
    if (state.request.status !== "error") return null;
    return (
      <div role="alert" style={{ border: "1px solid #c33", padding: "0.5rem", margin: "0.5rem 0" }}>
        <p>Ошибка: {state.request.message}</p>
        <button type="button" onClick={retryLast} disabled={busy}>Повторить</button>
      </div>
    );
  }

  if (submitted) {
    return (
      <main style={{ padding: "1rem", fontFamily: "system-ui" }}>
        <h1>{set.title}</h1>
        {renderDraftNotice()}
        {storageWarning && <p role="status" style={{ color: "#a60" }}>{storageWarning}</p>}
        {renderRequestError()}
        <p>Попытка завершена</p>
        {state.result ? <ResultView result={state.result} /> : <p>Результат загружается…</p>}

        <h2>Обзор ответов</h2>
        {tasks.map((task, i) => {
          const answer = findAnswer(state.serverAnswers, task.id);
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
      <h1>{set.title}</h1>
      {renderDraftNotice()}
      {storageWarning && <p role="status" style={{ color: "#a60" }}>{storageWarning}</p>}
      {renderRequestError()}
      <p>Задание {state.currentIndex + 1} / {tasks.length}</p>
      <ProgressBar filled={progress.filled} total={progress.total} />

      {formError && <p role="alert" style={{ color: "#c33" }}>{formError}</p>}

      {currentTask ? (
        <TaskCard
          task={currentTask}
          answer={currentAnswer}
          onAnswerChange={handleAnswerChange}
          onAnswerClear={handleClear}
          disabled={busy}
          pending={currentTask ? state.pending[currentTask.id] === true : false}
        />
      ) : (
        <p>Задание не найдено.</p>
      )}

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
        <button type="button" onClick={goPrev} disabled={state.currentIndex === 0 || busy}>
          Назад
        </button>
        {state.currentIndex < tasks.length - 1 ? (
          <button type="button" onClick={goNext} disabled={busy}>Дальше</button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={busy}>
            {busy ? "Отправка…" : "Завершить попытку"}
          </button>
        )}
      </div>

      <div style={{ marginTop: "1rem" }}>
        <button type="button" onClick={handleReset} disabled={busy}>
          Сбросить попытку
        </button>
      </div>
    </main>
  );
}