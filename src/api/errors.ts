import { isAxiosError, isCancel } from "axios";
import type { z } from "zod";
import { apiErrorBodySchema, type ApiErrorCode } from "./contracts";

export type ApiErrorKind =
  /** Resposta HTTP com corpo de erro do contrato. */
  | "http"
  /** Sem resposta: offline, DNS, CORS, conexão recusada. */
  | "network"
  | "timeout"
  | "canceled"
  /** Resposta 2xx que não bate com o contrato. */
  | "invalid_response";

/** Erro único que chega na UI e no Query, independente da origem. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly code: ApiErrorCode | null;
  readonly fieldErrors: Record<string, string>;
  readonly details: unknown;

  constructor(init: {
    kind: ApiErrorKind;
    message: string;
    status?: number | null;
    code?: ApiErrorCode | null;
    fieldErrors?: Record<string, string>;
    details?: unknown;
  }) {
    super(init.message);
    this.name = "ApiError";
    this.kind = init.kind;
    this.status = init.status ?? null;
    this.code = init.code ?? null;
    this.fieldErrors = init.fieldErrors ?? {};
    this.details = init.details;
  }

  /** Falhas que podem dar certo numa nova tentativa sem mudar nada. */
  get isTransient() {
    return (
      this.kind === "network" ||
      this.kind === "timeout" ||
      (this.kind === "http" && (this.status === 502 || this.status === 503 || this.status === 504))
    );
  }

  get isUnauthenticated() {
    return this.status === 401;
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (isCancel(error)) return new ApiError({ kind: "canceled", message: "Requisição cancelada" });
  if (isAxiosError(error)) {
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      return new ApiError({ kind: "timeout", message: "O servidor demorou para responder" });
    }
    if (!error.response) {
      return new ApiError({ kind: "network", message: "Sem conexão com o servidor" });
    }
    const parsed = apiErrorBodySchema.safeParse(error.response.data);
    if (parsed.success) {
      const { code, message, fieldErrors, details } = parsed.data.error;
      return new ApiError({ kind: "http", status: error.response.status, code, message, fieldErrors, details });
    }
    return new ApiError({
      kind: "http",
      status: error.response.status,
      code: error.response.status >= 500 ? "internal_error" : null,
      message: "Erro inesperado do servidor",
    });
  }
  return new ApiError({ kind: "network", message: error instanceof Error ? error.message : "Erro desconhecido" });
}

/** Valida a resposta contra o contrato; divergência vira erro explícito, não dado corrompido na UI. */
export function parseResponse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    if (import.meta.env.DEV) console.error("[api] resposta fora do contrato", result.error.issues);
    throw new ApiError({ kind: "invalid_response", message: "Resposta inesperada do servidor" });
  }
  return result.data;
}
