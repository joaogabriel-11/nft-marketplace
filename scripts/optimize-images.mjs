// Converte as artes exportadas do Figma (PNG 1254px) em WebP responsivo.
// Uso: node scripts/optimize-images.mjs <pasta-com-png>
// Entrada esperada: art-<chave>.png  →  public/images/nfts/<chave>-{512,1024}.webp
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const [inputDir] = process.argv.slice(2);
if (!inputDir) throw new Error("Informe a pasta com os PNGs exportados do Figma");

const outDir = "public/images/nfts";
const WIDTHS = [512, 1024];
await mkdir(outDir, { recursive: true });

for (const file of await readdir(inputDir)) {
  const match = /^art-(.+)\.png$/.exec(file);
  if (!match) continue;
  for (const width of WIDTHS) {
    const out = path.join(outDir, `${match[1]}-${width}.webp`);
    const info = await sharp(path.join(inputDir, file)).resize(width).webp({ quality: 78 }).toFile(out);
    console.log(out, `${Math.round(info.size / 1024)} KB`);
  }
}
