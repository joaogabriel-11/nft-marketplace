import { toast } from "sonner";
import { isApiError } from "@/api/errors";

/**
 * Ações que existem no layout mas estão fora do escopo da demo (editorial, login social...).
 * Informam claramente que não estão disponíveis em vez de aparentar sucesso.
 */
export function notifyUnavailable(feature: string) {
  toast.info(`${feature} não está disponível nesta demonstração.`, { id: `unavailable:${feature}` });
}

/** Mensagem legível para qualquer erro vindo da camada de API. */
export function errorMessage(error: unknown, fallback = "Algo deu errado. Tente novamente.") {
  if (!isApiError(error)) return fallback;
  if (error.kind === "network") return "Sem conexão. Verifique sua internet e tente novamente.";
  if (error.kind === "timeout") return "O servidor demorou para responder. Tente novamente.";
  return error.message || fallback;
}
