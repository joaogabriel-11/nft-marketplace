import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
// E2E_BASE_URL permite rodar a suíte contra o deploy publicado, sem subir servidor local.
const externalURL = process.env.E2E_BASE_URL;
const baseURL = externalURL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Cada teste já parte de um contexto novo (storage, service worker e localStorage limpos).
    serviceWorkers: "allow",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
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
