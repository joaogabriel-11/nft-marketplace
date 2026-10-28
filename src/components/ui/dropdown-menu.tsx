import { DropdownMenu as MenuPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;
export const DropdownMenuLabel = MenuPrimitive.Label;

export function DropdownMenuContent({ className, ...props }: ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        align="end"
        sideOffset={8}
        className={cn("z-50 min-w-48 rounded-[6px] border border-border bg-surface-raised p-1 shadow-lg", className)}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({ className, ...props }: ComponentProps<typeof MenuPrimitive.Item>) {
  return (
    <MenuPrimitive.Item
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-[4px] px-3 py-2 text-14 text-foreground outline-none select-none data-[highlighted]:bg-surface-card data-[highlighted]:text-text-accent",
        className,
      )}
      {...props}
    />
  );
}
