// Auditoria Lighthouse contra o build de produção (npm run preview).
// Uso: npm run lighthouse [-- --url=http://localhost:4173 --runs=3]
// Bloco 6 amplia para início + detalhe, perfis mobile/desktop e relatório de medianas.
import { mkdir, writeFile } from "node:fs/promises";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";
import { preview } from "vite";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, "").split("=")),
);

// Sem --url, serve o dist/ atual com vite preview (rode npm run build antes; o script npm já faz isso).
let server;
if (!args.url) {
  server = await preview({ preview: { port: 4173, strictPort: true } });
}
const baseUrl = args.url ?? "http://localhost:4173";
const runs = Number(args.runs ?? 3);
const pages = [{ name: "inicio", path: "/" }];
const profiles = [
  { name: "mobile", config: undefined },
  { name: "desktop", config: desktopConfig },
];
const categories = ["performance", "accessibility", "best-practices", "seo"];
const outDir = "lighthouse/reports";

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

await mkdir(outDir, { recursive: true });
const summary = [];

for (const target of pages) {
  for (const profile of profiles) {
    const scores = [];
    for (let run = 1; run <= runs; run++) {
      const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless=new"] });
      try {
        const result = await lighthouse(
          baseUrl + target.path,
          { port: chrome.port, output: ["html", "json"], onlyCategories: categories },
          profile.config,
        );
        const file = `${outDir}/${target.name}-${profile.name}-${run}`;
        await writeFile(`${file}.html`, result.report[0]);
        await writeFile(`${file}.json`, result.report[1]);
        const { lhr } = result;
        scores.push({
          ...Object.fromEntries(categories.map((c) => [c, Math.round(lhr.categories[c].score * 100)])),
          lcp: lhr.audits["largest-contentful-paint"].numericValue,
          cls: lhr.audits["cumulative-layout-shift"].numericValue,
          tbt: lhr.audits["total-blocking-time"].numericValue,
        });
      } finally {
        await chrome.kill();
      }
    }
    const row = { page: target.name, profile: profile.name };
    for (const key of [...categories, "lcp", "cls", "tbt"]) row[key] = median(scores.map((s) => s[key]));
    summary.push(row);
  }
}

await writeFile(`${outDir}/summary.json`, JSON.stringify(summary, null, 2));
console.table(summary);
await server?.close();
