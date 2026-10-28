import { Select as SelectPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import arrowDown from "@/assets/icons/arrow-down.svg";
import { cn } from "@/lib/utils";

/** Select do shadcn com o visual do "Ordenar por" do Figma (texto + seta, sem caixa). */
export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({ className, children, ...props }: ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn("inline-flex items-center gap-2 rounded-[4px] text-15 text-foreground", className)}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <img src={arrowDown} alt="" width={11} height={6} />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({ className, children, ...props }: ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position="popper"
        sideOffset={8}
        className={cn(
          "z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[6px] border border-border bg-surface-raised p-1 shadow-lg",
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({ className, children, ...props }: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "cursor-pointer rounded-[4px] px-3 py-2 text-14 text-foreground outline-none select-none data-[highlighted]:bg-surface-card data-[state=checked]:text-text-accent",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}
