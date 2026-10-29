// Auditoria Lighthouse contra o build de produção (vite preview) ou uma URL (--url=https://...).
// Uso: npm run lighthouse [-- --url=http://localhost:4173 --runs=3]
// Mede Início e Detalhe nos perfis mobile e desktop, N execuções cada (Chrome novo por execução).
// Versiona o relatório da execução mediana (HTML + JSON) e lighthouse/reports/summary.md;
// todas as execuções ficam em lighthouse/reports/tmp (ignorado pelo git).
import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";
import { preview } from "vite";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, "").split("=")),
);

// Sem --url, serve o dist/ atual com vite preview (o script npm roda o build antes).
let server;
if (!args.url) {
  server = await preview({ preview: { port: 4173, strictPort: true } });
}
const baseUrl = args.url ?? "http://localhost:4173";
const runs = Number(args.runs ?? 3);
const pages = [
  { name: "inicio", label: "Início", path: "/" },
  { name: "detalhe", label: "Detalhe", path: "/nfts/emerald-ape-042" },
];
const profiles = [
  { name: "mobile", config: undefined },
  { name: "desktop", config: desktopConfig },
];
const categories = ["performance", "accessibility", "best-practices", "seo"];
const outDir = "lighthouse/reports";
const tmpDir = `${outDir}/tmp`;

await rm(tmpDir, { recursive: true, force: true });
await mkdir(tmpDir, { recursive: true });

const summary = [];
let versions;

for (const target of pages) {
  for (const profile of profiles) {
    const results = [];
    for (let run = 1; run <= runs; run++) {
      const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless=new"] });
      try {
        const result = await lighthouse(
          baseUrl + target.path,
          { port: chrome.port, output: ["html", "json"], onlyCategories: categories },
          profile.config,
        );
        const file = `${tmpDir}/${target.name}-${profile.name}-${run}`;
        await writeFile(`${file}.html`, result.report[0]);
        await writeFile(`${file}.json`, result.report[1]);
        const { lhr } = result;
        versions ??= { lighthouse: lhr.lighthouseVersion, chrome: lhr.environment.hostUserAgent.match(/Chrome\/([\d.]+)/)?.[1] };
        results.push({
          report: result.report,
          scores: Object.fromEntries(categories.map((c) => [c, Math.round(lhr.categories[c].score * 100)])),
          lcp: lhr.audits["largest-contentful-paint"].numericValue,
          cls: lhr.audits["cumulative-layout-shift"].numericValue,
          tbt: lhr.audits["total-blocking-time"].numericValue,
          fcp: lhr.audits["first-contentful-paint"].numericValue,
        });
      } finally {
        await chrome.kill();
      }
    }
    // Execução mediana pela nota de performance (desempate por LCP): é ela que vai para o repositório.
    const sorted = [...results].sort((a, b) => a.scores.performance - b.scores.performance || b.lcp - a.lcp);
    const medianRun = sorted[Math.floor(sorted.length / 2)];
    const name = `${outDir}/${target.name}-${profile.name}`;
    await writeFile(`${name}.html`, medianRun.report[0]);
    await writeFile(`${name}.json`, medianRun.report[1]);
    summary.push({
      page: target.label,
      profile: profile.name,
      ...medianRun.scores,
      fcp: Math.round(medianRun.fcp),
      lcp: Math.round(medianRun.lcp),
      cls: Number(medianRun.cls.toFixed(3)),
      tbt: Math.round(medianRun.tbt),
      runs: results.map((r) => r.scores.performance).join(" / "),
    });
  }
}

const table = [
  "| Tela | Perfil | Performance | Acessibilidade | Boas práticas | SEO | FCP (ms) | LCP (ms) | CLS | TBT (ms) | Performance por execução |",
  "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
  ...summary.map(
    (r) =>
      `| ${r.page} | ${r.profile} | ${r.performance} | ${r.accessibility} | ${r["best-practices"]} | ${r.seo} | ${r.fcp} | ${r.lcp} | ${r.cls} | ${r.tbt} | ${r.runs} |`,
  ),
].join("\n");

const markdown = `# Lighthouse: resumo

Gerado por \`npm run lighthouse\` em ${new Date().toISOString().slice(0, 10)}.

- Alvo: ${args.url ? baseUrl : "build de produção servido por `vite preview` (localhost:4173)"}, com \`VITE_ENABLE_MOCKS=true\` (MSW ativo, como no deploy)
- Lighthouse ${versions.lighthouse}, Chrome ${versions.chrome} headless, Node ${process.version}, ${os.type()} ${os.release()} (${os.cpus()[0]?.model.trim()})
- Perfis: mobile (padrão do Lighthouse: Moto G Power, 4G lento simulado, CPU 4x) e desktop (\`desktop-config\`)
- ${runs} execuções por tela e perfil, cada uma em um Chrome novo (sem cache nem localStorage). A linha mostra a execução mediana pela nota de performance, e os relatórios \`<tela>-<perfil>.html/.json\` desta pasta são dessa execução.

${table}
`;

await writeFile(`${outDir}/summary.md`, markdown);
await writeFile(`${outDir}/summary.json`, JSON.stringify({ versions, summary }, null, 2));
console.log(markdown);
await server?.close();
