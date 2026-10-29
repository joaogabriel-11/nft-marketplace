import { useState } from "react";
import type { NftDetail } from "@/api/contracts";
import zoomIcon from "@/assets/icons/zoom.svg";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { nftImageSrcSet } from "@/lib/format";
import { cn } from "@/lib/utils";

export function GalleryImage({
  image,
  className,
  sizes,
  priority,
}: {
  image: NftDetail["images"][number];
  className?: string;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <div className={cn("overflow-hidden", className)}>
      <img
        src={image.url}
        srcSet={nftImageSrcSet(image.url)}
        sizes={sizes}
        alt={image.alt}
        width={512}
        height={512}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        className="size-full object-cover"
      />
    </div>
  );
}

/**
 * Galeria desktop do Figma: 4 miniaturas à esquerda, imagem principal de 444px e lupa. A arte aparece
 * inteira em todas; a selecionada tem borda primary e as outras ficam esmaecidas (estado além da cor).
 */
export function NftGallery({ nft }: { nft: NftDetail }) {
  const [selected, setSelected] = useState(0);
  const current = nft.images[selected] ?? nft.images[0];

  return (
    <div className="flex shrink-0 gap-7">
      <div role="group" aria-label={`Imagens de ${nft.name}`} className="flex w-[100px] shrink-0 flex-col gap-4">
        {nft.images.map((image, index) => (
          <button
            key={index}
            type="button"
            aria-label={`Mostrar imagem ${index + 1} de ${nft.images.length}`}
            aria-pressed={index === selected}
            onClick={() => setSelected(index)}
            className={cn(
              "size-[100px] overflow-hidden rounded-[8px] border-2 bg-surface-card transition-opacity motion-reduce:transition-none",
              index === selected ? "border-primary" : "border-transparent opacity-60 hover:opacity-100",
            )}
          >
            <GalleryImage image={{ ...image, alt: "" }} sizes="100px" className="size-full rounded-[8px]" />
          </button>
        ))}
      </div>
      <div className="relative grid size-[min(444px,42vw)] shrink-0 place-items-center rounded-[6px] bg-surface-card p-4">
        <GalleryImage image={current} sizes="404px" priority className="size-full rounded-[24px]" />
        <Dialog>
          <DialogTrigger className="absolute top-[15px] right-[15px] rounded-full" aria-label={`Ampliar ${current.alt}`}>
            <img src={zoomIcon} alt="" width={30} height={30} />
          </DialogTrigger>
          <DialogContent className="max-w-[min(90vw,820px)] rounded-[12px] p-4" closeLabel="Fechar imagem ampliada">
            <DialogTitle className="sr-only">{current.alt}</DialogTitle>
            <GalleryImage image={current} sizes="820px" className="aspect-square w-full rounded-[12px]" />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
