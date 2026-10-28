import minusIcon from "@/assets/icons/minus.svg";
import plusIcon from "@/assets/icons/plus.svg";
import { cn } from "@/lib/utils";

interface QuantityStepperProps {
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
  size?: "lg" | "sm";
  disabled?: boolean;
  className?: string;
}

/**
 * Seletor de quantidade do Figma (botões em pílula vertical primary).
 * O valor é anunciado via role="status"; os limites desabilitam os botões em vez de só esconder.
 */
export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  label,
  size = "lg",
  disabled = false,
  className,
}: QuantityStepperProps) {
  const button = cn(
    "grid place-items-center rounded-[33px] border border-ink bg-primary shadow-[0_6px_10px_rgba(20,13,10,0.15)] disabled:opacity-40",
    size === "lg" ? "h-[49.5px] w-[33px]" : "h-[30px] w-5",
  );
  const icon = size === "lg" ? 26 : 16;
  return (
    <div role="group" aria-label={label} className={cn("flex items-center gap-3", className)}>
      <button
        type="button"
        className={button}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        aria-label="Diminuir quantidade"
      >
        <img src={minusIcon} alt="" width={icon} height={icon} />
      </button>
      <output
        aria-live="polite"
        className={cn("min-w-6 text-center text-foreground", size === "lg" ? "text-20 leading-7" : "text-18 leading-[25px] font-medium")}
      >
        {value}
      </output>
      <button
        type="button"
        className={button}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        aria-label="Aumentar quantidade"
      >
        <img src={plusIcon} alt="" width={icon} height={icon} />
      </button>
    </div>
  );
}
