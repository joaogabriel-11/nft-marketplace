import { Tabs as TabsPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Abas do Figma: rótulo ativo em accent com sublinhado de 3px; setas do teclado navegam. */
export const Tabs = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn("flex gap-6 overflow-x-auto border-b border-border/60 md:gap-8", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "-mb-px shrink-0 border-b-[3px] border-transparent pb-3 text-15 leading-4 whitespace-nowrap text-foreground md:text-17",
        "data-[state=active]:border-primary data-[state=active]:font-bold data-[state=active]:text-text-accent",
        className,
      )}
      {...props}
    />
  );
}
