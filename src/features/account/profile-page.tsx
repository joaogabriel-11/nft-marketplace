import { zodResolver } from "@hookform/resolvers/zod";
import { ImageIcon } from "lucide-react";
import { useId, useRef, useState, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { changePasswordInputSchema, updateProfileInputSchema, type User } from "@/api/contracts";
import { isApiError } from "@/api/errors";
import { Button } from "@/components/ui/button";
import { FieldShell, TextControl } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { AVATAR_ACCEPT, AvatarError, fileToAvatarDataUrl } from "@/lib/image";
import { errorMessage } from "@/lib/notify";
import { useChangePassword, useProfile, useRemoveAvatar, useUpdateAvatar, useUpdateProfile } from "./queries";

/** Erros por campo da API (409/422) vão para o campo; o resto vira alerta do formulário. */
function serverErrors(error: unknown, fields: readonly string[]) {
  if (!isApiError(error)) return { fieldErrors: {}, message: errorMessage(error) };
  const fieldErrors = Object.fromEntries(Object.entries(error.fieldErrors).filter(([field]) => fields.includes(field)));
  return { fieldErrors, message: Object.keys(fieldErrors).length ? null : errorMessage(error) };
}

function FormAlert({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-[6px] border border-error/60 bg-error/10 px-4 py-3 text-13">
      {message}
    </p>
  );
}

export function ProfilePage() {
  const profile = useProfile();

  if (profile.isPending) {
    return (
      <div aria-busy="true" className="grid gap-6 md:grid-cols-2">
        <p role="status" className="sr-only">
          Carregando perfil…
        </p>
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-[79px]" />
        ))}
      </div>
    );
  }
  if (profile.isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-4 rounded-[8px] bg-surface-card p-6">
        <p className="text-18 font-bold">Não conseguimos carregar seu perfil</p>
        <p className="text-14 text-text-secondary">{errorMessage(profile.error)}</p>
        <Button onClick={() => void profile.refetch()}>Tentar novamente</Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-12">
      <ProfileForm key={profile.data.id} user={profile.data} />
      <PasswordForm />
    </div>
  );
}

const PROFILE_FIELDS = ["displayName", "username", "email", "ensName", "walletNickname"] as const;

function ProfileForm({ user }: { user: User }) {
  const update = useUpdateProfile();
  const form = useForm({
    resolver: zodResolver(updateProfileInputSchema),
    defaultValues: {
      displayName: user.displayName,
      username: user.username,
      email: user.email,
      ensName: user.ensName ?? "",
      walletNickname: user.walletNickname ?? "",
    },
  });
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = form;

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = await update.mutateAsync(values);
      reset({
        displayName: saved.displayName,
        username: saved.username,
        email: saved.email,
        ensName: saved.ensName ?? "",
        walletNickname: saved.walletNickname ?? "",
      });
      toast.success("Perfil atualizado.");
    } catch (error) {
      const { fieldErrors, message } = serverErrors(error, PROFILE_FIELDS);
      for (const [field, text] of Object.entries(fieldErrors)) {
        setError(field as (typeof PROFILE_FIELDS)[number], { type: "server", message: text });
      }
      setError("root.server", { message: message ?? undefined });
    }
  });

  return (
    <section aria-labelledby="profile-title" className="flex flex-col gap-6">
      <h1 id="profile-title" className="text-17 leading-4 font-bold">
        Perfil do colecionador
      </h1>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        <FormAlert message={errors.root?.server?.message} />
        <div className="grid gap-x-7 gap-y-6 md:grid-cols-2">
          <FieldShell label="Nome de exibição" required error={errors.displayName?.message}>
            {(a11y) => <TextControl {...a11y} autoComplete="name" {...register("displayName")} />}
          </FieldShell>
          <FieldShell label="Nome de usuário" required error={errors.username?.message}>
            {(a11y) => <TextControl {...a11y} autoComplete="username" {...register("username")} />}
          </FieldShell>
          <FieldShell label="E-mail" required error={errors.email?.message}>
            {(a11y) => <TextControl {...a11y} type="email" autoComplete="email" {...register("email")} />}
          </FieldShell>
          <FieldShell label="Nome ENS" error={errors.ensName?.message} hint="Opcional. Sem o sufixo .eth.">
            {(a11y) => (
              <div className="flex gap-2.5">
                <span aria-hidden="true" className="grid h-10 w-[78px] shrink-0 place-items-center rounded-[3px] border border-border text-15">
                  .eth
                </span>
                <TextControl {...a11y} autoComplete="off" spellCheck={false} {...register("ensName")} />
              </div>
            )}
          </FieldShell>
          <FieldShell label="Apelido da carteira" error={errors.walletNickname?.message} hint="Opcional.">
            {(a11y) => <TextControl {...a11y} {...register("walletNickname")} />}
          </FieldShell>
          <AvatarField user={user} />
        </div>
        <Button type="submit" className="w-fit min-w-[140px]" disabled={update.isPending || !isDirty}>
          {update.isPending ? "Salvando…" : "Salvar"}
        </Button>
      </form>
    </section>
  );
}

function AvatarField({ user }: { user: User }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const update = useUpdateAvatar();
  const remove = useRemoveAvatar();
  const id = useId();
  const busy = update.isPending || remove.isPending;

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      await update.mutateAsync(dataUrl);
      toast.success("Avatar atualizado.");
    } catch (err) {
      setError(err instanceof AvatarError ? err.message : errorMessage(err, "Não foi possível enviar o avatar."));
    }
  }

  return (
    <div className="flex flex-col gap-2.5" role="group" aria-labelledby={`${id}-label`} aria-describedby={error ? `${id}-error` : undefined}>
      <span id={`${id}-label`} className="text-15 leading-[15px]">
        Avatar
      </span>
      <div className="flex items-center gap-6">
        <span className="grid size-[50px] shrink-0 place-items-center overflow-hidden rounded-[6px] border border-border bg-surface-card">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={`Avatar de ${user.displayName}`} width={50} height={50} className="size-full object-cover" />
          ) : (
            <ImageIcon aria-label="Sem avatar" className="size-6 text-text-secondary" strokeWidth={1.5} />
          )}
        </span>
        <input
          ref={inputRef}
          id={`${id}-input`}
          type="file"
          accept={AVATAR_ACCEPT.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-label="Arquivo do avatar"
          onChange={(event) => void onFile(event)}
        />
        <Button className="w-[98px]" disabled={busy} onClick={() => inputRef.current?.click()}>
          {update.isPending ? "Enviando…" : "Alterar"}
        </Button>
        {user.avatarUrl && (
          <Button
            variant="link"
            size="none"
            className="text-16 font-medium"
            disabled={busy}
            onClick={() =>
              remove.mutate(undefined, {
                onSuccess: () => toast.success("Avatar removido."),
                onError: (err) => setError(errorMessage(err)),
              })
            }
          >
            Remover
          </Button>
        )}
      </div>
      <p className="text-12 text-text-secondary">PNG, JPG ou WEBP até 5 MB. A imagem é recortada em quadrado.</p>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-12 text-coral">
          {error}
        </p>
      )}
    </div>
  );
}

const passwordFormSchema = changePasswordInputSchema
  .extend({ confirmPassword: z.string().min(1, "Confirme a nova senha") })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não conferem",
  });

function PasswordForm() {
  const change = useChangePassword();
  const form = useForm({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = form;

  const onSubmit = handleSubmit(async ({ confirmPassword: _confirm, ...values }) => {
    try {
      await change.mutateAsync(values);
      reset();
      toast.success("Senha alterada. Outras sessões abertas foram encerradas.");
    } catch (error) {
      const { fieldErrors, message } = serverErrors(error, ["currentPassword", "newPassword"]);
      for (const [field, text] of Object.entries(fieldErrors)) {
        setError(field as "currentPassword" | "newPassword", { type: "server", message: text });
      }
      setError("root.server", { message: message ?? undefined });
    }
  });

  return (
    <section aria-labelledby="password-title" className="flex flex-col gap-6">
      <h2 id="password-title" className="text-17 leading-4 font-bold">
        Alterar senha
      </h2>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        <FormAlert message={errors.root?.server?.message} />
        <div className="grid gap-x-7 gap-y-6 md:grid-cols-3">
          <FieldShell label="Senha atual" required error={errors.currentPassword?.message}>
            {(a11y) => <TextControl {...a11y} type="password" autoComplete="current-password" {...register("currentPassword")} />}
          </FieldShell>
          <FieldShell label="Nova senha" required error={errors.newPassword?.message} hint="Mínimo de 8 caracteres, com letras e números.">
            {(a11y) => <TextControl {...a11y} type="password" autoComplete="new-password" {...register("newPassword")} />}
          </FieldShell>
          <FieldShell label="Confirmar nova senha" required error={errors.confirmPassword?.message}>
            {(a11y) => <TextControl {...a11y} type="password" autoComplete="new-password" {...register("confirmPassword")} />}
          </FieldShell>
        </div>
        <Button type="submit" className="w-fit min-w-[140px]" disabled={change.isPending}>
          {change.isPending ? "Salvando…" : "Salvar nova senha"}
        </Button>
      </form>
    </section>
  );
}
