import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import type { Favorites } from "@/api/contracts";
import { favoritesApi } from "@/api/endpoints";
import { queryKeys } from "@/api/query-keys";
import { useSession } from "@/features/auth/session";
import { errorMessage } from "@/lib/notify";

export function useFavorites() {
  const { user } = useSession();
  return useQuery({
    queryKey: queryKeys.favorites(user?.id ?? "anonymous"),
    queryFn: ({ signal }) => favoritesApi.list({ signal }),
    enabled: !!user,
    staleTime: 60_000,
  });
}

/**
 * Favoritar com atualização otimista: o coração muda na hora; se a API falhar,
 * o cache volta ao snapshot anterior e o usuário é avisado. Visitante vai ao login
 * e retorna para a mesma tela.
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user } = useSession();
  const key = queryKeys.favorites(user?.id ?? "anonymous");

  const mutation = useMutation({
    mutationFn: ({ nftId, favorite }: { nftId: string; favorite: boolean; name: string }) =>
      favorite ? favoritesApi.add(nftId) : favoritesApi.remove(nftId),
    onMutate: async ({ nftId, favorite }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Favorites>(key);
      queryClient.setQueryData<Favorites>(key, (current) => {
        const ids = new Set(current?.nftIds ?? []);
        if (favorite) ids.add(nftId);
        else ids.delete(nftId);
        return { nftIds: [...ids] };
      });
      return { previous };
    },
    onError: (error, { favorite, name }, context) => {
      queryClient.setQueryData(key, context?.previous);
      toast.error(`Não foi possível ${favorite ? "favoritar" : "remover dos favoritos"} ${name}. ${errorMessage(error, "")}`.trim());
    },
    onSuccess: (data, { favorite, name }) => {
      queryClient.setQueryData(key, data);
      toast.success(favorite ? `${name} foi adicionado aos favoritos.` : `${name} foi removido dos favoritos.`, {
        id: `favorite:${name}`,
      });
    },
  });

  return {
    isPending: mutation.isPending,
    toggle(nftId: string, name: string, favorite: boolean) {
      if (!user) {
        toast.info("Entre para salvar seus favoritos.");
        void router.navigate({ to: "/login", search: { redirect: router.state.location.href } });
        return;
      }
      mutation.mutate({ nftId, favorite, name });
    },
  };
}
