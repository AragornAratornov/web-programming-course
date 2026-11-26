import type { Answer, Attempt, Result, TrainingSet } from "./domain";

const BASE = "http://localhost:3001";

type ApiError = Error & { code?: string; status?: number };

async function request<T>(
  path: string,
  init: RequestInit = {},
  demoFail = false
): Promise<T> {
  const headers: Record<string, string> = {
    ...(init.body ? { "Content-Type": "application/json" } : {}),
    ...((init.headers as Record<string, string> | undefined) ?? {}),
  };
  if (demoFail) headers["X-Demo-Fail"] = "1";

  const res = await fetch(BASE + path, { ...init, headers });

  if (!res.ok) {
    let code = `HTTP_${res.status}`;
    let message = `Ошибка ${res.status}`;
    try {
      const payload = (await res.json()) as { error?: { code?: string; message?: string } };
      if (payload.error?.code) code = payload.error.code;
      if (payload.error?.message) message = payload.error.message;
    } catch {
      // тело не JSON — оставляем дефолтные code/message
    }
    const err: ApiError = new Error(message);
    err.code = code;
    err.status = res.status;
    throw err;
  }

  return (await res.json()) as T;
}

export function loadSet(setId: string) {
  return request<TrainingSet>(`/api/sets/${setId}`);
}

export function createAttempt(setId: string) {
  return request<Attempt>(`/api/attempts`, {
    method: "POST",
    body: JSON.stringify({ setId }),
  });
}

export function getAttempt(attemptId: string) {
  return request<Attempt>(`/api/attempts/${attemptId}`);
}

export function putAnswer(attemptId: string, answer: Answer, demoFail = false) {
  return request<Attempt>(
    `/api/attempts/${attemptId}/answers/${answer.taskId}`,
    { method: "PUT", body: JSON.stringify(answer) },
    demoFail
  );
}

export function deleteAnswer(attemptId: string, taskId: string, demoFail = false) {
  return request<Attempt>(
    `/api/attempts/${attemptId}/answers/${taskId}`,
    { method: "DELETE" },
    demoFail
  );
}

export function submitAttempt(attemptId: string, demoFail = false) {
  return request<Result>(
    `/api/attempts/${attemptId}/submit`,
    { method: "POST", body: "{}" },
    demoFail
  );
}

export function getResult(attemptId: string) {
  return request<Result>(`/api/attempts/${attemptId}/result`);
}

export function isStatus(e: unknown, status: number): boolean {
  return e instanceof Error && (e as ApiError).status === status;
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Неизвестная ошибка";
}