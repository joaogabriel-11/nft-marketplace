// Roda a suíte E2E (desktop + mobile) contra o deploy publicado, sem servidor local.
// Uso: npm run test:e2e:deploy [-- --url=https://outra-url.vercel.app] [-- <args do playwright>]
import { spawnSync } from "node:child_process";

const DEFAULT_URL = "https://nft-marketplace-one-fawn.vercel.app";
const args = process.argv.slice(2);
const urlArg = args.find((arg) => arg.startsWith("--url="));
const url = urlArg ? urlArg.slice("--url=".length) : DEFAULT_URL;
const passthrough = args.filter((arg) => arg !== urlArg);

const result = spawnSync("npx", ["playwright", "test", "--project=desktop", "--project=mobile", ...passthrough], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, E2E_BASE_URL: url },
});
process.exit(result.status ?? 1);
