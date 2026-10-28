import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { Socket } from "socket.io-client";
import { toast } from "sonner";
import { nftUpdatedEventSchema, orderUpdatedEventSchema, REALTIME_EVENTS } from "@/api/contracts";
import { onSessionEnd, useSession } from "@/features/auth/session";
import { env } from "@/lib/env";
import { applyNftUpdated, applyOrderUpdated } from "./apply";
import { eventGate, realtimeStore } from "./store";

/**
 * Ciclo de vida do Socket.IO: uma conexão por sessão (visitante também recebe nft.updated).
 * Troca de token = conexão nova; logout fecha a conexão e descarta listeners.
 * Ao reconectar, tudo que está ativo na tela é reconciliado pela REST.
 */
export function RealtimeBridge() {
  const queryClient = useQueryClient();
  const { session, isPending } = useSession();
  const token = session?.token ?? null;
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (isPending) return;
    let disposed = false;
    let dispose = () => {
      disposed = true;
    };

    // Import sob demanda: o engine.io-client captura `globalThis.WebSocket` ao ser carregado;
    // carregando depois do worker.start(), ele usa o WebSocket interceptado pelo MSW.
    // Também mantém o cliente Socket.IO fora do bundle inicial.
    void import("socket.io-client").then(({ io }) => {
      if (disposed) return;
      dispose = connect(io);
    });
    return () => dispose();

    function connect(io: typeof import("socket.io-client").io) {
    const socket: Socket = io(env.VITE_SOCKET_URL ?? window.location.origin, {
      transports: ["websocket"],
      query: token ? { token } : {},
      reconnectionDelay: 500,
      reconnectionDelayMax: 3_000,
    });
    let connectedBefore = false;
    realtimeStore.setStatus("connecting");

    socket.on("connect", () => {
      realtimeStore.setStatus("connected");
      if (connectedBefore) {
        // Eventos podem ter se perdido durante a queda: a REST é a fonte da verdade.
        void queryClient.invalidateQueries({ type: "active" });
      }
      connectedBefore = true;
    });
    socket.on("disconnect", () => realtimeStore.setStatus("reconnecting"));
    socket.io.on("reconnect_attempt", () => realtimeStore.setStatus("reconnecting"));
    socket.on("connect_error", (error) => {
      // Token recusado: a sessão REST decide (o próximo 401 leva ao login); sem retry em loop.
      if (error.message === "unauthorized") {
        realtimeStore.setStatus("idle");
        socket.disconnect();
        return;
      }
      realtimeStore.setStatus("reconnecting");
    });

    socket.on(REALTIME_EVENTS.nftUpdated, (raw: unknown) => {
      const parsed = nftUpdatedEventSchema.safeParse(raw);
      if (!parsed.success) return;
      const event = parsed.data;
      if (!eventGate.accept(event.eventId, `nft:${event.resourceId}`, event.version)) return;
      applyNftUpdated(queryClient, userId ?? "guest", event);
    });

    socket.on(REALTIME_EVENTS.orderUpdated, (raw: unknown) => {
      const parsed = orderUpdatedEventSchema.safeParse(raw);
      if (!parsed.success || !userId) return;
      const event = parsed.data;
      if (!eventGate.accept(event.eventId, `order:${event.resourceId}`, event.version)) return;
      applyOrderUpdated(queryClient, userId, event);
    });

    const stopOnLogout = onSessionEnd(() => socket.disconnect());

    return () => {
      stopOnLogout();
      socket.removeAllListeners();
      socket.io.removeAllListeners();
      socket.disconnect();
      realtimeStore.setStatus("idle");
    };
    }
  }, [token, userId, isPending, queryClient]);

  return <RealtimeStatusNotice />;
}

/** Aviso discreto e acessível quando o tempo real cai (os dados podem estar desatualizados). */
function RealtimeStatusNotice() {
  useEffect(
    () =>
      realtimeStore.subscribe(() => {
        const { status } = realtimeStore.get();
        if (status === "reconnecting") {
          toast.loading("Reconectando atualizações em tempo real…", { id: "realtime-status" });
        } else if (status === "connected") {
          toast.dismiss("realtime-status");
        }
      }),
    [],
  );
  return null;
}
