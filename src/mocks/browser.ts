import { setupWorker } from "msw/browser";
import { db } from "./db/store";
import { settleDueOrders } from "./handlers/orders";
import { handlers } from "./handlers";
import { isScenarioName, scenario } from "./scenarios";

export const worker = setupWorker(...handlers);

/** ?scenario=<nome> seleciona o cenário; ?mock-reset restaura o banco. Ambos saem da URL. */
function applyUrlControls() {
  const url = new URL(window.location.href);
  const requested = url.searchParams.get("scenario");
  if (isScenarioName(requested)) scenario.set(requested);
  if (url.searchParams.has("mock-reset")) db.reset();
  if (url.searchParams.has("scenario") || url.searchParams.has("mock-reset")) {
    url.searchParams.delete("scenario");
    url.searchParams.delete("mock-reset");
    window.history.replaceState(window.history.state, "", url);
  }
}

export async function startMockWorker() {
  applyUrlControls();
  await worker.start({
    // Requisições de assets (fontes, imagens, chunks) passam direto;
    // só chamadas sem handler para /api viram aviso.
    onUnhandledRequest(request, print) {
      if (new URL(request.url).pathname.startsWith("/api")) print.warning();
    },
    quiet: import.meta.env.PROD,
  });
  // Liquida pedidos pendentes mesmo sem requisições (fonte de order.updated no Bloco 4).
  window.setInterval(settleDueOrders, 1_000);
}
