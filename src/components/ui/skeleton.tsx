import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Placeholder com shimmer. Com prefers-reduced-motion o brilho para e fica só o bloco estático
 * (ver .skeleton em index.css). Decorativo: o estado de carregamento é anunciado por quem o usa.
 */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div aria-hidden="true" className={cn("skeleton rounded-[6px]", className)} {...props} />;
}
