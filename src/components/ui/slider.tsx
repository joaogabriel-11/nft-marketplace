import { Slider as SliderPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Slider de faixa do Figma: trilho fino, trecho ativo em primary e alças de 15px com aro ink. */
export function Slider({
  className,
  thumbLabels,
  ...props
}: ComponentProps<typeof SliderPrimitive.Root> & { thumbLabels: string[] }) {
  const count = (props.value ?? props.defaultValue ?? [0]).length;
  return (
    <SliderPrimitive.Root
      className={cn("relative flex h-5 w-full touch-none items-center select-none", className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-[3px] grow rounded-full bg-border-soft">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-primary" />
      </SliderPrimitive.Track>
      {Array.from({ length: count }, (_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          aria-label={thumbLabels[index]}
          className="block size-[15px] rounded-full border-[3px] border-ink bg-primary outline-offset-2"
        />
      ))}
    </SliderPrimitive.Root>
  );
}
