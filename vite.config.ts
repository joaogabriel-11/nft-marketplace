import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

/**
 * Com mocks ligados, o app só renderiza depois do MSW iniciar (src/main.tsx). O chunk do MSW é
 * importado dinamicamente, então o navegador só o descobria depois de baixar e executar o index.js.
 * O modulepreload no HTML antecipa o download (medido no Lighthouse, ver lighthouse/reports/summary.md).
 */
function preloadMockWorker(): Plugin {
  return {
    name: "kurio:preload-mock-worker",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html, { bundle }) {
        if (!bundle) return;
        const entry = Object.values(bundle).find(
          (chunk) => chunk.type === "chunk" && chunk.facadeModuleId?.replaceAll("\\", "/").endsWith("/src/mocks/browser.ts"),
        );
        if (!entry || entry.type !== "chunk") return;
        // Só o que o HTML ainda não carrega (index.js e vendors compartilhados já estão lá).
        return [entry.fileName, ...entry.imports].filter((file) => !html.includes(file)).map((file) => ({
          tag: "link",
          attrs: { rel: "modulepreload", crossorigin: "", href: `/${file}` },
          injectTo: "head" as const,
        }));
      },
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    // O plugin do router precisa vir antes do React para gerar routeTree.gen.ts
    // e aplicar code splitting automático por rota.
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    // Mesma flag que liga o MSW em src/main.tsx (lida do .env do modo).
    loadEnvFlag(mode) && preloadMockWorker(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
}));

function loadEnvFlag(mode: string) {
  // loadEnv lê .env* e também process.env (variáveis da Vercel), com prioridade para este.
  return loadEnv(mode, process.cwd(), "VITE_").VITE_ENABLE_MOCKS === "true";
}
