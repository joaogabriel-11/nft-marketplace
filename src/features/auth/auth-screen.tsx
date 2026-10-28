import { Link, useRouter } from "@tanstack/react-router";
import facebookBrand from "@/assets/icons/facebook-brand.svg";
import googleIcon from "@/assets/icons/google.svg";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { HomePage } from "@/features/catalog/home-page";
import { catalogSearchSchema } from "@/features/catalog/search";
import { notifyUnavailable } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { LoginForm, RegisterForm } from "./auth-forms";
import { safeRedirect } from "./session";

interface AuthScreenProps {
  mode: "login" | "register";
  redirect?: string;
  reason?: "expired";
}

const DEFAULT_SEARCH = catalogSearchSchema.parse({});

/**
 * Login e cadastro. Desktop: modal sobre o mercado (como no Figma, a página fica inerte ao fundo).
 * Mobile: tela cheia. Fechar volta para onde o usuário estava.
 */
export function AuthScreen({ mode, redirect, reason }: AuthScreenProps) {
  const router = useRouter();
  const isLogin = mode === "login";
  const close = () => void router.navigate({ href: safeRedirect(redirect), replace: true });

  return (
    <>
      <div className="hidden md:block" aria-hidden="true">
        <HomePage search={DEFAULT_SEARCH} onChange={() => undefined} interactive={false} />
      </div>
      <Dialog open onOpenChange={(open) => !open && close()}>
        <DialogContent
          closeLabel="Fechar e voltar"
          overlayClassName="max-md:bg-ink"
          className={cn(
            "overflow-y-auto pb-12 max-md:inset-0 max-md:top-0 max-md:left-0 max-md:h-dvh max-md:w-full max-md:max-w-none max-md:translate-0 max-md:bg-ink max-md:pb-10",
            "md:max-h-[calc(100dvh-48px)] md:rounded-[8px]",
          )}
          onOpenAutoFocus={(event) => {
            // Foco no primeiro campo, não no botão fechar.
            event.preventDefault();
            (event.currentTarget as HTMLElement).querySelector<HTMLInputElement>("input")?.focus();
          }}
        >
          <div className="flex flex-col items-center px-7 pt-[120px] md:px-12 md:pt-12">
            <p aria-hidden="true" className="mb-[90px] text-32 font-bold tracking-[0.1em] md:hidden">
              KURIO
            </p>
            <nav aria-label="Acesso à conta" className="hidden items-center gap-2 text-20 leading-4 font-medium md:flex">
              <Link
                to="/login"
                search={{ redirect }}
                replace
                aria-current={isLogin ? "page" : undefined}
                className={isLogin ? "text-text-accent" : "hover:text-text-accent"}
              >
                Entrar
              </Link>
              <span aria-hidden="true" className="h-5 w-px bg-coral" />
              <Link
                to="/cadastro"
                search={{ redirect }}
                replace
                aria-current={!isLogin ? "page" : undefined}
                className={!isLogin ? "text-text-accent" : "hover:text-text-accent"}
              >
                Criar conta
              </Link>
            </nav>
            <DialogTitle className="text-center text-20 font-bold max-[400px]:text-18 md:sr-only">
              {isLogin ? "Entrar" : "Criar perfil de colecionador"}
            </DialogTitle>
            <DialogDescription className="mt-10 hidden text-center text-13 leading-4 md:block">
              {isLogin
                ? "Entre para gerenciar sua carteira, coleção e perfil de criador."
                : "Crie seu perfil de colecionador e conecte uma carteira quando quiser."}
            </DialogDescription>
          </div>

          <div className="flex flex-col px-7 pt-10 md:px-20 md:pt-6">
            {reason === "expired" && isLogin && (
              <p role="status" className="mb-4 rounded-[5px] border border-primary/60 bg-primary/10 px-4 py-3 text-13">
                Sua sessão expirou. Entre novamente para continuar de onde parou.
              </p>
            )}
            {isLogin ? <LoginForm redirect={redirect} /> : <RegisterForm redirect={redirect} />}
          </div>

          <div className="flex flex-col gap-3 pt-6 md:pt-6">
            <div className="flex items-center gap-3 px-7 md:px-0">
              <span aria-hidden="true" className="h-px flex-1 bg-border" />
              <span className="text-13 leading-4">Ou continue com</span>
              <span aria-hidden="true" className="h-px flex-1 bg-border" />
            </div>
            <div className="flex flex-col gap-3 px-7 md:px-20">
              <SocialButton icon={googleIcon} label="Continuar com Google" />
              <SocialButton icon={facebookBrand} label="Continuar com Facebook" />
            </div>
          </div>

          <p className="mt-12 text-center text-15 text-text-secondary md:hidden">
            {isLogin ? (
              <Link to="/cadastro" search={{ redirect }} replace className="hover:text-text-accent">
                Novo na Kurio? Crie uma conta
              </Link>
            ) : (
              <Link to="/login" search={{ redirect }} replace className="hover:text-text-accent">
                Já tem uma conta? Entre
              </Link>
            )}
          </p>
          <span aria-hidden="true" className="absolute inset-x-0 bottom-0 hidden h-[10px] bg-primary md:block" />
        </DialogContent>
      </Dialog>
    </>
  );
}

function SocialButton({ icon, label }: { icon: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => notifyUnavailable("O login social")}
      className="flex h-10 items-center justify-center gap-3 rounded-[5px] border border-border text-13 leading-4 font-medium text-text-secondary hover:border-primary"
    >
      <img src={icon} alt="" width={20} height={20} />
      {label}
    </button>
  );
}
