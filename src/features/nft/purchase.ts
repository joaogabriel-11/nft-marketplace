import Decimal from "decimal.js";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import type { Edition, NftDetail } from "@/api/contracts";
import { useAddToCart } from "@/features/cart/queries";
import { errorMessage } from "@/lib/notify";

/** Edição inicial: a disponível com o preço exibido no card; senão a primeira disponível. */
function defaultEdition(nft: NftDetail) {
  const available = nft.editions.filter((e) => e.available > 0);
  return (available.find((e) => e.priceEth === nft.priceEth) ?? available[0] ?? nft.editions[0]).id;
}

/**
 * Estado de compra do detalhe: edição, quantidade limitada por maxPerOrder e adição ao carrinho.
 * Se a disponibilidade mudar (refetch ou evento), a quantidade é recortada ao novo limite.
 */
export function usePurchase(nft: NftDetail) {
  const navigate = useNavigate();
  const addToCart = useAddToCart();
  const [editionId, setEditionId] = useState(() => defaultEdition(nft));
  const [rawQuantity, setQuantity] = useState(1);

  const edition: Edition = nft.editions.find((e) => e.id === editionId) ?? nft.editions[0];
  const canBuy = edition.available > 0 && edition.maxPerOrder > 0;
  const quantity = canBuy ? Math.min(Math.max(1, rawQuantity), edition.maxPerOrder) : 1;
  const totalEth = new Decimal(edition.priceEth).mul(quantity).toFixed();

  function selectEdition(id: string) {
    setEditionId(id);
    setQuantity(1);
  }

  async function add({ goToCart }: { goToCart: boolean }) {
    try {
      await addToCart.mutateAsync({ nftId: nft.id, editionId: edition.id, quantity });
      if (goToCart) {
        await navigate({ to: "/carrinho" });
      } else {
        toast.success(`${nft.name} (${edition.label}) foi adicionado ao carrinho.`);
      }
    } catch (error) {
      toast.error(errorMessage(error, "Não foi possível adicionar ao carrinho."));
    }
  }

  return { edition, selectEdition, quantity, setQuantity, canBuy, totalEth, add, isAdding: addToCart.isPending };
}
