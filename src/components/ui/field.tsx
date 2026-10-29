import { forwardRef, useId, type ComponentProps, type ReactNode } from "react";
import arrowDown from "@/assets/icons/arrow-down.svg";
import { cn } from "@/lib/utils";

/**
 * Campo rotulado do Figma (checkout, perfil e carteiras): label 15px, asterisco coral nos
 * obrigatórios, caixa de 40px com borda border. Label, descrição e erro associados ao controle.
 */
interface FieldShellProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  className?: string;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string; "aria-required"?: boolean }) => ReactNode;
}

export function FieldShell({ label, required, error, hint, className, children }: FieldShellProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col", className)}>
      {/* Altura fixa (a do asterisco no Figma): rótulos com e sem * alinham na mesma linha do grid. */}
      <label htmlFor={id} className="mb-2.5 flex h-[29px] items-center gap-1 text-15 leading-[15px]">
        {label}
        {required && (
          <span aria-hidden="true" className="text-22 leading-[29px] text-coral">
            *
          </span>
        )}
        {required && <span className="sr-only">(obrigatório)</span>}
      </label>
      <div>
        {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy, "aria-required": required || undefined })}
      </div>
      {hint && (
        <p id={hintId} className="mt-1 text-12 text-text-secondary">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-12 text-coral">
          {error}
        </p>
      )}
    </div>
  );
}

const CONTROL =
  "h-10 w-full rounded-[3px] border border-border bg-transparent px-3 text-14 text-foreground placeholder:text-secondary focus-visible:border-primary focus-visible:outline-none aria-invalid:border-error disabled:opacity-60";

export const TextControl = forwardRef<HTMLInputElement, ComponentProps<"input">>(function TextControl({ className, ...props }, ref) {
  return <input ref={ref} className={cn(CONTROL, className)} {...props} />;
});

export const TextAreaControl = forwardRef<HTMLTextAreaElement, ComponentProps<"textarea">>(function TextAreaControl(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} className={cn(CONTROL, "h-[152px] resize-none py-3", className)} {...props} />;
});

/** Select nativo (teclado, leitor de tela e mobile corretos) com a seta do Figma. */
export const SelectControl = forwardRef<HTMLSelectElement, ComponentProps<"select">>(function SelectControl(
  { className, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(CONTROL, "appearance-none pr-10 invalid:text-secondary", className)} {...props}>
        {children}
      </select>
      <img src={arrowDown} alt="" width={11} height={6} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2" />
    </div>
  );
});
