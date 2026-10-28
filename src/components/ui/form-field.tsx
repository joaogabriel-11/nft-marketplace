import { useId, useState, type ComponentProps, type ReactNode } from "react";
import eyeHide from "@/assets/icons/eye-hide.svg";
import { cn } from "@/lib/utils";
import { Input } from "./input";

interface FormFieldProps extends Omit<ComponentProps<"input">, "id"> {
  label: string;
  error?: string;
  hint?: ReactNode;
  /** O Figma usa só placeholder; o label existe para leitores de tela e fica oculto. */
  hideLabel?: boolean;
  /** Campo de senha com botão mostrar/ocultar. */
  revealable?: boolean;
}

/** Label, campo e erro associados (aria-invalid + aria-describedby). */
export function FormField({ label, error, hint, hideLabel = false, revealable = false, className, type, ...props }: FormFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const [revealed, setRevealed] = useState(false);
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className={cn("text-14 font-bold", hideLabel && "sr-only")}>
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          type={revealable && revealed ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(revealable && "pr-11")}
          {...props}
        />
        {revealable && (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            aria-label={revealed ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={revealed}
            aria-controls={id}
            className="absolute top-1/2 right-3 grid size-7 -translate-y-1/2 place-items-center rounded-full"
          >
            <img src={eyeHide} alt="" width={19} height={15} className={cn(revealed && "opacity-50")} />
          </button>
        )}
      </div>
      {hint && (
        <p id={hintId} className="text-12 text-text-secondary">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-12 text-coral">
          {error}
        </p>
      )}
    </div>
  );
}
