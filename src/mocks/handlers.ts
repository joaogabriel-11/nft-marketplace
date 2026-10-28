import { http, HttpResponse } from "msw";

// Os handlers de domínio (auth, catálogo, carrinho...) entram no Bloco 1.
export const handlers = [
  http.get("*/api/health", () => HttpResponse.json({ status: "ok", mocks: true })),
];
