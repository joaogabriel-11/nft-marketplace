import { Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import closeIcon from "@/assets/icons/close.svg";
import { cn } from "@/lib/utils";

/** Dialog do shadcn: foco preso, Esc fecha, conteúdo de fundo fica inerte para leitores de tela. */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

export function DialogContent({
  className,
  children,
  overlayClassName,
  closeLabel = "Fechar",
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { overlayClassName?: string; closeLabel?: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-50 bg-ink/60 data-[state=open]:animate-in data-[state=open]:fade-in-0",
          overlayClassName,
        )}
      />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 w-[calc(100%-32px)] max-w-[500px] -translate-x-1/2 -translate-y-1/2 bg-surface-card shadow-xl outline-none",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute top-3 right-3 grid size-8 place-items-center rounded-full hover:bg-surface-raised"
          aria-label={closeLabel}
        >
          <img src={closeIcon} alt="" width={18} height={18} />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
