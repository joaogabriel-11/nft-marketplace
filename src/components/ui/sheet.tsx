import { Dialog as SheetPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import closeIcon from "@/assets/icons/close.svg";
import { cn } from "@/lib/utils";

/** Sheet (drawer) do shadcn sobre o Dialog do Radix: mesmo controle de foco do dialog. */
export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export const SheetTitle = SheetPrimitive.Title;
export const SheetDescription = SheetPrimitive.Description;

export function SheetContent({
  className,
  children,
  side = "bottom",
  ...props
}: ComponentProps<typeof SheetPrimitive.Content> & { side?: "bottom" | "right" }) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/70 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <SheetPrimitive.Content
        className={cn(
          "fixed z-50 flex flex-col bg-surface-card outline-none data-[state=open]:animate-in",
          side === "bottom" &&
            "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-[31px] data-[state=open]:slide-in-from-bottom",
          side === "right" && "inset-y-0 right-0 w-[min(360px,100%)] data-[state=open]:slide-in-from-right",
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close
          className="absolute top-4 right-4 grid size-8 place-items-center rounded-full hover:bg-surface-raised"
          aria-label="Fechar"
        >
          <img src={closeIcon} alt="" width={18} height={18} />
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}
