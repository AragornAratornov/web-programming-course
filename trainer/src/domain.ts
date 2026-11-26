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
