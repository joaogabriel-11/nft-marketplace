import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChangePasswordInput, Session, UpdateProfileInput, User } from "@/api/contracts";
import { profileApi } from "@/api/endpoints";
import { queryKeys } from "@/api/query-keys";
import { useSession } from "@/features/auth/session";

export function useProfile() {
  const { user } = useSession();
  return useQuery({
    queryKey: queryKeys.profile(user?.id ?? "anonymous"),
    queryFn: ({ signal }) => profileApi.get({ signal }),
    enabled: !!user,
  });
}

/**
 * Perfil salvo vira a fonte do usuário em toda a app: o cache da sessão é atualizado junto
 * (nome e avatar no header mudam na hora, sem refetch).
 */
function useApplyUser() {
  const queryClient = useQueryClient();
  return (user: User) => {
    queryClient.setQueryData(queryKeys.profile(user.id), user);
    queryClient.setQueryData<Session | null>(queryKeys.session, (session) => (session ? { ...session, user } : session));
  };
}

export function useUpdateProfile() {
  const apply = useApplyUser();
  return useMutation({ mutationFn: (input: UpdateProfileInput) => profileApi.update(input), onSuccess: apply });
}

export function useUpdateAvatar() {
  const apply = useApplyUser();
  return useMutation({ mutationFn: (dataUrl: string) => profileApi.updateAvatar(dataUrl), onSuccess: apply });
}

export function useRemoveAvatar() {
  const apply = useApplyUser();
  return useMutation({ mutationFn: () => profileApi.removeAvatar(), onSuccess: apply });
}

export function useChangePassword() {
  return useMutation({ mutationFn: (input: ChangePasswordInput) => profileApi.changePassword(input) });
}
