import { toSocketIo } from "@mswjs/socket.io-binding";
import { ws } from "msw";
import {
  REALTIME_EVENTS,
  type NftUpdatedEvent,
  type OrderUpdatedEvent,
} from "@/api/contracts";
import { toEdition, toSummary } from "./domain/catalog";
import { db, type DbChange } from "./db/store";
import { toOrder } from "./handlers/orders";
import { randomId } from "./lib/crypto";
import { nowIso } from "./lib/http";

/**
 * "Servidor" Socket.IO simulado sobre o WebSocket interceptado pelo MSW.
 *
 * - Transporte: só WebSocket (o cliente usa transports: ["websocket"]).
 * - Autenticação: token na query do handshake. O @mswjs/socket.io-binding responde ao CONNECT
 *   do Socket.IO automaticamente (sem ler `auth`), então a validação acontece aqui, antes de
 *   montar o binding; token inválido recebe CONNECT_ERROR ("44") como um servidor real enviaria.
 * - Heartbeat: o binding anuncia pingInterval 25 s mas não envia ping; sem isso o cliente
 *   derrubaria a conexão a cada 30 s. O ping é enviado aqui.
 * - Eventos: derivados do canal de mudanças do banco (o mesmo estado da API REST).
 *   nft.updated vai para todos; order.updated só para conexões do dono do pedido.
 */
// O MSW remove o prefixo "/socket.io/" da URL do cliente antes de comparar,
// então o link é a própria origem (ws://host ou wss://host), a mesma do socket.io-client.
const socketLink = ws.link(window.location.origin.replace(/^http/, "ws"));

const HEARTBEAT_MS = 20_000;
const HISTORY_SIZE = 50;

type RealtimeEvent = NftUpdatedEvent | OrderUpdatedEvent;

interface Client {
  id: string;
  userId: string | null;
  emit: (event: string, payload: unknown) => void;
  close: () => void;
}

const clients = new Set<Client>();
const history: RealtimeEvent[] = [];
/** Bloqueio de conexões (simula queda do servidor de tempo real até `blockedUntil`). */
let blockedUntil = 0;
/** Entrega pausada: eventos gerados nesse período não chegam (como mensagens perdidas). */
let paused = false;

function userForToken(token: string | null) {
  if (!token) return { ok: true as const, userId: null };
  const session = db.state.sessions.find((s) => s.token === token);
  if (!session || Date.parse(session.expiresAt) <= Date.now()) return { ok: false as const };
  return { ok: true as const, userId: session.userId };
}

const ENGINE_OPEN = (sid: string) =>
  "0" + JSON.stringify({ sid, upgrades: [], pingInterval: 25_000, pingTimeout: 20_000, maxPayload: 1_000_000 });

export const realtimeHandlers = [
  socketLink.addEventListener("connection", (connection) => {
    const url = new URL(connection.client.url);
    if (Date.now() < blockedUntil) {
      // Aceita o transporte e cai em seguida: o Manager do socket.io-client só agenda nova
      // tentativa (com backoff) para quedas após o "open" do Engine.IO; fechar antes disso
      // deixaria o cliente preso em "opening" até o timeout de 20 s.
      connection.client.send(ENGINE_OPEN(randomId("sid")));
      window.setTimeout(() => connection.client.close(4000, "Servidor de tempo real indisponível"), 0);
      return;
    }

    const auth = userForToken(url.searchParams.get("token"));
    if (!auth.ok) {
      // Engine.IO aberto + CONNECT_ERROR no namespace "/": o cliente emite connect_error.
      connection.client.send(ENGINE_OPEN(randomId("sid")));
      connection.client.send("44" + JSON.stringify({ message: "unauthorized", data: { code: "unauthorized" } }));
      return;
    }

    const io = toSocketIo(connection);
    const heartbeat = window.setInterval(() => connection.client.send("2"), HEARTBEAT_MS);
    const client: Client = {
      id: randomId("sock"),
      userId: auth.userId,
      emit: (event, payload) => io.client.emit(event, payload),
      close: () => connection.client.close(4001, "Conexão encerrada pelo servidor"),
    };
    clients.add(client);
    connection.client.addEventListener("close", () => {
      window.clearInterval(heartbeat);
      clients.delete(client);
    });
  }),
];

function deliver(event: RealtimeEvent) {
  if (paused) return;
  for (const client of clients) {
    if (event.type === "order.updated" && client.userId !== event.userId) continue;
    client.emit(event.type, event);
  }
}

function record(event: RealtimeEvent) {
  history.push(event);
  if (history.length > HISTORY_SIZE) history.shift();
  deliver(event);
}

function buildEvent(change: DbChange): RealtimeEvent | null {
  if (change.type === "nft") {
    const nft = db.state.nfts.find((n) => n.id === change.id);
    if (!nft) return null;
    return {
      eventId: randomId("evt"),
      type: REALTIME_EVENTS.nftUpdated,
      resourceId: nft.id,
      version: nft.version,
      occurredAt: nowIso(),
      payload: { ...toSummary(nft), editions: nft.editions.map(toEdition) },
    };
  }
  const order = db.state.orders.find((o) => o.id === change.id);
  if (!order) return null;
  return {
    eventId: randomId("evt"),
    type: REALTIME_EVENTS.orderUpdated,
    resourceId: order.id,
    version: order.version,
    occurredAt: nowIso(),
    userId: order.userId,
    payload: toOrder(order),
  };
}

db.subscribe((change) => {
  const event = buildEvent(change);
  if (event) record(event);
});

/** Controles usados pelos endpoints /api/__dev/realtime (testes e demo). */
export const realtimeControls = {
  status: () => ({
    clients: [...clients].map((c) => ({ id: c.id, userId: c.userId })),
    paused,
    blocked: Date.now() < blockedUntil,
    lastEvents: history.slice(-5).map((e) => ({ eventId: e.eventId, type: e.type, resourceId: e.resourceId, version: e.version })),
  }),
  /** Derruba todas as conexões; com blockMs, recusa reconexões nesse intervalo. */
  disconnect(blockMs = 0) {
    blockedUntil = Date.now() + blockMs;
    for (const client of [...clients]) client.close();
  },
  pause(value: boolean) {
    paused = value;
  },
  /** Reenvia o último evento com o mesmo eventId (entrega duplicada). */
  duplicateLast() {
    const last = history.at(-1);
    if (last) deliver(last);
    return last ?? null;
  },
  /** Reenvia um evento anterior do mesmo recurso do último evento (versão antiga, fora de ordem). */
  replayStale() {
    const last = history.at(-1);
    if (!last) return null;
    const older = [...history].reverse().find((e) => e.resourceId === last.resourceId && e.version < last.version);
    if (older) deliver({ ...older, eventId: randomId("evt") });
    return older ?? null;
  },
  /**
   * O reset apaga as sessões: conexões autenticadas são encerradas (o token deixou de valer).
   * Conexões de visitante não dependem de sessão e seguem abertas — fechá-las dispararia uma
   * reconciliação no cliente que consumiria falhas "só da primeira chamada" dos cenários.
   */
  reset() {
    history.length = 0;
    paused = false;
    blockedUntil = 0;
    for (const client of [...clients]) if (client.userId) client.close();
  },
};
