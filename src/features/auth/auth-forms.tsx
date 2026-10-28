import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type FieldValues, type Path, type UseFormSetError } from "react-hook-form";
import { z } from "zod";
import { loginInputSchema, registerInputSchema } from "@/api/contracts";
import { isApiError } from "@/api/errors";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { errorMessage, notifyUnavailable } from "@/lib/notify";
import { useLogin, useRegister } from "./use-auth-actions";

/** Erros por campo vindos da API vão para o campo certo; o resto vira mensagem do formulário. */
function applyApiErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, fields: readonly string[]) {
  if (!isApiError(error)) return errorMessage(error);
  let assigned = false;
  for (const [field, message] of Object.entries(error.fieldErrors)) {
    if (fields.includes(field)) {
      setError(field as Path<T>, { type: "server", message });
      assigned = true;
    }
  }
  return assigned ? null : errorMessage(error);
}

function FormAlert({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-[5px] border border-error/60 bg-error/10 px-4 py-3 text-13 text-foreground">
      {message}
    </p>
  );
}

export function LoginForm({ redirect }: { redirect?: string }) {
  const login = useLogin(redirect);
  const form = useForm({ resolver: zodResolver(loginInputSchema), defaultValues: { email: "", password: "" } });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = form;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
    } catch (error) {
      setError("root.server", { message: applyApiErrors(error, setError, ["email", "password"]) ?? undefined });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col">
      <div className="flex flex-col gap-3">
        <FormAlert message={errors.root?.server?.message} />
        <FormField
          label="E-mail"
          hideLabel
          type="email"
          autoComplete="email"
          placeholder="contato@email.com"
          error={errors.email?.message}
          {...register("email")}
        />
        <FormField
          label="Senha"
          hideLabel
          type="password"
          revealable
          autoComplete="current-password"
          placeholder="Senha"
          error={errors.password?.message}
          {...register("password")}
        />
        <button
          type="button"
          className="self-end text-14 leading-4 text-text-accent hover:underline"
          onClick={() => notifyUnavailable("A recuperação de senha")}
        >
          Esqueceu a senha?
        </button>
      </div>
      <Button type="submit" size="lg" className="mt-6 w-full md:mt-6 max-md:h-[60px] max-md:rounded-[10px]" disabled={login.isPending}>
        {login.isPending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}

/** Cadastro: o schema do contrato + confirmação de senha (regra só de interface). */
const registerFormSchema = registerInputSchema
  .extend({ confirmPassword: z.string().min(1, "Confirme sua senha") })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não conferem",
  });

export function RegisterForm({ redirect }: { redirect?: string }) {
  const registerAccount = useRegister(redirect);
  const form = useForm({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { username: "", email: "", password: "", confirmPassword: "" },
  });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = form;

  const onSubmit = handleSubmit(async ({ confirmPassword: _confirm, ...values }) => {
    try {
      await registerAccount.mutateAsync(values);
    } catch (error) {
      setError("root.server", {
        message: applyApiErrors(error, setError, ["username", "email", "password"]) ?? undefined,
      });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col">
      <div className="flex flex-col gap-3">
        <FormAlert message={errors.root?.server?.message} />
        <FormField
          label="Nome de usuário"
          hideLabel
          autoComplete="username"
          placeholder="Nome de usuário"
          error={errors.username?.message}
          {...register("username")}
        />
        <FormField
          label="E-mail"
          hideLabel
          type="email"
          autoComplete="email"
          placeholder="Digite seu e-mail"
          error={errors.email?.message}
          {...register("email")}
        />
        <FormField
          label="Senha"
          hideLabel
          type="password"
          revealable
          autoComplete="new-password"
          placeholder="Senha"
          hint="Mínimo de 8 caracteres, com letras e números."
          error={errors.password?.message}
          {...register("password")}
        />
        <FormField
          label="Confirmar senha"
          hideLabel
          type="password"
          revealable
          autoComplete="new-password"
          placeholder="Confirmar senha"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
      </div>
      <Button type="submit" size="lg" className="mt-6 w-full max-md:mt-10 max-md:h-[60px] max-md:rounded-[10px]" disabled={registerAccount.isPending}>
        {registerAccount.isPending ? "Criando conta…" : (
          <>
            <span className="md:hidden">Criar perfil</span>
            <span className="hidden md:inline">Criar conta</span>
          </>
        )}
      </Button>
    </form>
  );
}
