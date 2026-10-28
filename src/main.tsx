import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { installUnauthorizedHandler } from "@/features/auth/unauthorized-handler";
import { env } from "@/lib/env";
import { createQueryClient } from "@/lib/query-client";
import { createAppRouter } from "@/router";
import "./index.css";

async function enableMocking() {
  if (!env.VITE_ENABLE_MOCKS) return;
  // Import dinâmico: sem a flag, MSW e fixtures ficam fora do bundle principal.
  const { startMockWorker } = await import("@/mocks/browser");
  await startMockWorker();
}

const queryClient = createQueryClient();
const router = createAppRouter(queryClient);
installUnauthorizedHandler(queryClient, router);

// Renderiza só depois do worker ativo, para a primeira requisição já ser interceptada.
enableMocking().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
});
