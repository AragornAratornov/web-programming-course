type SingleChoiceTask = {
    id: string;
    kind: "single-choice";
    topic: string;
    prompt: string;
    options: { id: string; label: string }[];
    code?: string;
};

type ShortTextTask = {
    id: string;
    kind: "short-text";
    topic: string;
    prompt: string;
    code?: string;
};

type Task = SingleChoiceTask | ShortTextTask;

type TrainingSet = {
    id: string;
    title: string;
    tasks: Task[];
};

type SingleChoiceAnswer = {
    taskId: string;
    kind: "single-choice";
    optionId: string;   
};

type ShortTextAnswer = {
    taskId: string;
    kind: "short-text";
    text: string;
};

type Answer = SingleChoiceAnswer | ShortTextAnswer;

export function findTask(set: TrainingSet, taskId: string): Task | undefined {
  return set.tasks.find((t) => t.id === taskId);
}

export function filterTasksByTopic(set: TrainingSet, topic: string): Task[] {
  return set.tasks.filter((t) => t.topic === topic);
}

export function countProgress(set: TrainingSet, answers: Answer[]): { filled: number; total: number } {
  const total = set.tasks.length;

  const filled = set.tasks.filter((task) => {
    const answer = answers.find((a) => a.taskId === task.id);
    return answer !== undefined && isAnswerFilled(answer);
  }).length;

  return { filled, total };
}

export function isAnswerFilled(answer: Answer): boolean {
  if (answer.kind === "single-choice") {
    return answer.optionId.trim() !== "";
  }
  return answer.text.trim() !== "";
}

export function findAnswer(answers: readonly Answer[], taskId: string): Answer | undefined {
  return answers.find((a) => a.taskId === taskId);
}

export const trainingSet: TrainingSet = {
  id: "web-basics",
  title: "Основы веб-программирования",
  tasks: [
    {
      id: "ts-1",
      kind: "single-choice",
      topic: "typescript",
      prompt: "Что выведет этот JavaScript-код?",
      code: 'console.log("10" * 5);',
      options: [
        { id: "a", label: "105" },
        { id: "b", label: "50" },
        { id: "c", label: "Ошибка" },
      ],
    },
    {
      id: "ts-2",
      kind: "single-choice",
      topic: "typescript",
      prompt: "Что возвращает find, если элемент не найден?",
      options: [
        { id: "a", label: "undefined" },
        { id: "b", label: "Пустой массив" },
        { id: "c", label: "false" },
      ],
    },
    {
      id: "react-1",
      kind: "short-text",
      topic: "react",
      prompt: "Объясните, чем props компонента отличаются от его состояния.",
    },
    {
      id: "http-1",
      kind: "short-text",
      topic: "http",
      prompt: "Что нужно проверить в ответе fetch перед использованием JSON?",
    },
  ],
};

export type { SingleChoiceTask, ShortTextTask, Task, TrainingSet, SingleChoiceAnswer, ShortTextAnswer, Answer};

export const DRAFT_VERSION = 1 as const;
export const DRAFT_STORAGE_KEY = "trainer:draft";

export type Draft = {
  version: typeof DRAFT_VERSION;
  setId: string;
  attemptId: string | null;
  taskId: string;
  answers: Answer[];
  status: "in-progress" | "submitted";
};

export type DraftReadResult =
  | { kind: "empty" }
  | { kind: "ok"; draft: Draft }
  | { kind: "corrupted"; message: string }
  | { kind: "foreign"; setId: string };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

export function isValidAnswer(value: unknown): value is Answer {
  if (!isRecord(value)) return false;
  if (typeof value.taskId !== "string" || value.taskId === "") return false;
  if (value.kind === "single-choice") {
    return isNonEmptyString(value.optionId);
  }
  if (value.kind === "short-text") {
    return typeof value.text === "string";
  }
  return false;
}

function validateDraft(value: unknown, set: TrainingSet): DraftReadResult {
  if (!isRecord(value)) return { kind: "corrupted", message: "Черновик не объект." };
  if (value.version !== DRAFT_VERSION) return { kind: "corrupted", message: "Неизвестная версия черновика." };
  if (!isNonEmptyString(value.setId)) return { kind: "corrupted", message: "Нет setId." };
  if (value.setId !== set.id) return { kind: "foreign", setId: value.setId };
  if (!isNonEmptyString(value.taskId)) return { kind: "corrupted", message: "Нет taskId." };
  if (!set.tasks.some((t) => t.id === value.taskId)) {
    return { kind: "corrupted", message: "taskId отсутствует в наборе." };
  }
  if (value.status !== "in-progress" && value.status !== "submitted") {
    return { kind: "corrupted", message: "Некорректный status." };
  }
  if (!Array.isArray(value.answers)) return { kind: "corrupted", message: "answers не массив." };

  const answers: Answer[] = [];
  for (const raw of value.answers) {
    if (!isValidAnswer(raw)) return { kind: "corrupted", message: "Некорректный ответ." };
    if (!set.tasks.some((t) => t.id === raw.taskId)) {
      return { kind: "corrupted", message: "Ответ ссылается на чужое задание." };
    }
    answers.push(raw);
  }

  const attemptId =
    value.attemptId === null || isNonEmptyString(value.attemptId)
      ? (value.attemptId as string | null)
      : null;

  return {
    kind: "ok",
    draft: {
      version: DRAFT_VERSION,
      setId: value.setId,
      attemptId,
      taskId: value.taskId,
      answers,
      status: value.status,
    },
  };
}

export function parseDraft(raw: string | null, set: TrainingSet): DraftReadResult {
  if (raw === null) return { kind: "empty" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: "corrupted", message: "JSON не удалось разобрать." };
  }
  return validateDraft(parsed, set);
}

export function readDraft(): string | null {
  try {
    return localStorage.getItem(DRAFT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeDraft(draft: Draft): boolean {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
  }
}

export type Attempt = {
  id: string;
  setId: string;
  status: "in-progress" | "submitted";
  answers: Answer[];
};

export type ResultItem = {
  taskId: string;
  status: "correct" | "incorrect" | "unanswered" | "pending-review";
  score: number | null;
  maxScore: number;
  feedback: string;
};

export type Result = {
  attemptId: string;
  status: "graded" | "pending-review";
  score: number | null;
  maxScore: number;
  items: ResultItem[];
};

export function validateAnswerForTask(answer: Answer, task: Task): string | null {
  if (answer.taskId !== task.id) return "taskId не совпадает с заданием";
  if (answer.kind !== task.kind) return "kind не совпадает с заданием";

  if (task.kind === "single-choice") {
    if (answer.kind !== "single-choice") return "kind не совпадает с заданием";
    if (!answer.optionId.trim()) return "Не выбран вариант";
    if (!task.options.some((o) => o.id === answer.optionId)) {
      return "optionId не принадлежит заданию";
    }
    return null;
  }
  if (answer.kind !== "short-text") return "kind не совпадает с заданием";
  if (answer.text.trim() === "") return "Пустой текстовый ответ";
  return null;
}