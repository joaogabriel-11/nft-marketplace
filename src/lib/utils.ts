import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Escala tipográfica do Figma (text-14, text-15...). Sem isso o tailwind-merge
// trata "text-14" como cor e descarta "text-foreground" no mesmo className.
const FIGMA_TEXT_SIZES = [
  "9", "10", "12", "13", "14", "15", "16", "17", "18",
  "20", "21", "22", "24", "28", "32", "43",
];

const twMerge = extendTailwindMerge({
  extend: {
    theme: { text: FIGMA_TEXT_SIZES },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
