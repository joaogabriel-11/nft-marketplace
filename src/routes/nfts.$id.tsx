import { createFileRoute, Link, notFound, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { isApiError } from "@/api/errors";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { nftDetailQueryOptions } from "@/features/catalog/queries";
import { NftDetailPage, NftDetailSkeleton } from "@/features/nft/nft-detail-page";
import { errorMessage } from "@/lib/notify";

export const Route = createFileRoute("/nfts/$id")({
  // Acesso direto ou refresh: o loader garante o dado no cache antes de renderizar.
  loader: async ({ context, params }) => {
    try {
      await context.queryClient.ensureQueryData(nftDetailQueryOptions(params.id));
    } catch (error) {
      if (isApiError(error) && error.code === "not_found") throw notFound();
      throw error;
    }
  },
  pendingComponent: NftDetailSkeleton,
  pendingMs: 150,
  notFoundComponent: NftNotFound,
  errorComponent: NftLoadError,
  component: function NftRoute() {
    const { id } = Route.useParams();
    return <NftDetailPage id={id} />;
  },
});

function NftNotFound() {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-5 py-24 text-center">
      <p className="text-14 font-bold text-text-accent">NFT não encontrado</p>
      <h1 className="text-28 font-bold">Este NFT não existe ou saiu do mercado</h1>
      <p className="text-14 leading-[22px] text-text-secondary">Confira o endereço ou explore outras obras do catálogo.</p>
      <Link to="/" hash="catalogo" className={buttonVariants()}>
        Explorar catálogo
      </Link>
    </section>
  );
}

function NftLoadError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <section role="alert" className="mx-auto flex max-w-xl flex-col items-center gap-5 py-24 text-center">
      <h1 className="text-24 font-bold">Não conseguimos carregar este NFT</h1>
      <p className="text-14 text-text-secondary">{errorMessage(error)}</p>
      <Button
        onClick={() => {
          reset();
          void router.invalidate();
        }}
      >
        Tentar novamente
      </Button>
    </section>
  );
}
