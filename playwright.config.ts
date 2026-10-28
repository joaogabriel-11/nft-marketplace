import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
// E2E_BASE_URL permite rodar a suíte contra o deploy publicado, sem subir servidor local.
const externalURL = process.env.E2E_BASE_URL;
const baseURL = externalURL ?? `http://localhost:${PORT}`;

const DESKTOP = { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } };
const MOBILE = { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } };

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }], ["list"]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Cada teste já parte de um contexto novo (storage, service worker e localStorage limpos).
    serviceWorkers: "allow",
  },
  expect: {
    toHaveScreenshot: {
      // Pequena tolerância para antialiasing; mudanças de layout/cor passam muito disso.
      maxDiffPixelRatio: 0.002,
      animations: "disabled",
      caret: "hide",
    },
  },
  // Baselines versionadas ao lado dos specs; o sufixo de plataforma separa Windows e Linux,
  // que renderizam fontes de forma diferente.
  snapshotPathTemplate: "{testDir}/visual/__screenshots__/{arg}-{projectName}-{platform}{ext}",
  projects: [
    { name: "desktop", use: DESKTOP, testIgnore: "visual/**" },
    {
      name: "mobile",
      use: MOBILE,
      // Testes de contrato da API não dependem de viewport: rodam só no projeto desktop.
      testIgnore: ["api/**", "visual/**"],
    },
    // Regressão visual: projetos separados (npm run test:visual), fora do CI Linux.
    { name: "visual-desktop", use: DESKTOP, testMatch: "visual/**/*.spec.ts" },
    { name: "visual-mobile", use: MOBILE, testMatch: "visual/**/*.spec.ts" },
  ],
  // Roda contra o build de produção com mocks, o mesmo artefato do deploy.
  webServer: externalURL
    ? undefined
    : {
        command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
