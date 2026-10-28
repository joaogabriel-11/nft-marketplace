import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/api/client";

export const Route = createFileRoute("/")({
  component: HomePlaceholder,
});

// Placeholder do Bloco 0: comprova Router + Query + Axios + MSW de ponta a ponta.
// A tela real de Início é implementada no Bloco 2.
function HomePlaceholder() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: async () => (await api.get<{ status: string }>("/health")).data,
  });

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-32 font-bold">KURIO</h1>
      <p className="text-14 text-text-secondary">Marketplace de NFTs em construção.</p>
      <p role="status" aria-live="polite" className="text-14 text-text-accent">
        {health.isPending && "Verificando API…"}
        {health.isError && "API indisponível"}
        {health.isSuccess && `API: ${health.data.status}`}
      </p>
    </main>
  );
}
