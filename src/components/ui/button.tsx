import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Botão shadcn adaptado aos tokens do Figma (cantos de 6px, Roboto Mono bold). */
export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 font-bold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_img]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-ink hover:bg-primary-light active:bg-primary-dark",
        outline: "border border-primary text-text-accent hover:bg-primary/10",
        ghost: "text-foreground hover:bg-surface-raised",
        subtle: "border border-border bg-surface-raised text-foreground hover:border-primary",
        link: "text-text-accent underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-[35px] rounded-[6px] px-3 text-14",
        md: "h-10 rounded-[6px] px-6 text-16",
        lg: "h-[45px] rounded-[5px] px-6 text-16",
        pill: "h-[60px] rounded-[40px] px-10 text-16",
        icon: "size-[35px] rounded-[4px]",
        "icon-round": "size-[35px] rounded-full",
        none: "",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      // Evita submit acidental em formulários quando o type não é informado.
      type={asChild ? undefined : (type ?? "button")}
      {...props}
    />
  );
}
