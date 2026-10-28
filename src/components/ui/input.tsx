import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Campo do Figma: borda border, 40px, placeholder secondary; foco e erro em destaque. */
export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-[5px] border border-border bg-transparent px-4 text-14 text-foreground placeholder:text-secondary",
        "focus-visible:border-primary focus-visible:outline-none",
        "aria-invalid:border-error",
        "disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
