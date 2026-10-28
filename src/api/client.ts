import axios from "axios";
import { env } from "@/lib/env";

// Instância única usada por todas as chamadas REST.
// Interceptors de token Bearer e normalização de erros entram no Bloco 1.
export const api = axios.create({
  baseURL: env.VITE_API_URL,
  timeout: 10_000,
  headers: { "Content-Type": "application/json" },
});
