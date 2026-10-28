import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);

export async function startMockWorker() {
  await worker.start({
    // Requisições de assets (fontes, imagens, chunks) passam direto;
    // só chamadas sem handler para /api viram aviso.
    onUnhandledRequest(request, print) {
      if (new URL(request.url).pathname.startsWith("/api")) print.warning();
    },
    quiet: import.meta.env.PROD,
  });
}
