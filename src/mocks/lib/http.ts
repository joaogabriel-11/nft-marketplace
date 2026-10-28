import { delay, http, HttpResponse, type DefaultBodyType, type PathParams } from "msw";
import type { z } from "zod";
import type { ApiErrorBody, ApiErrorCode } from "@/api/contracts";
import type { UserRecord } from "../db/schema";
import { db } from "../db/store";
import { scenario, type RouteTag } from "../scenarios";
import { createRandom } from "./crypto";

/** Erro de negócio lançado pelos handlers e convertido no corpo padrão `{ error }`. */
export class MockHttpError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly extra: Pick<ApiErrorBody["error"], "fieldErrors" | "details">;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    extra: Pick<ApiErrorBody["error"], "fieldErrors" | "details"> = {},
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }

  toResponse() {
    const body: ApiErrorBody = { error: { code: this.code, message: this.message, ...this.extra } };
    return HttpResponse.json(body, { status: this.status });
  }
}

export const fail = (...args: ConstructorParameters<typeof MockHttpError>): never => {
  throw new MockHttpError(...args);
};

export const notFound = (what: string) => fail(404, "not_found", `${what} não encontrado`);

/** Valida o corpo com o mesmo schema zod do contrato; falhas viram 422 com erros por campo. */
export async function parseBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail(422, "validation_error", "Corpo da requisição inválido");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".") || "_root";
      fieldErrors[key] ??= issue.message;
    }
    return fail(422, "validation_error", "Verifique os campos destacados", { fieldErrors });
  }
  return result.data;
}

function readBearer(request: Request) {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

/** Resolve o usuário do token. Sessão expirada é removida e responde 401 session_expired. */
export function authenticate(request: Request): { user: UserRecord; token: string } | null {
  const token = readBearer(request);
  if (!token) return null;
  const session = db.state.sessions.find((s) => s.token === token);
  if (!session) return fail(401, "unauthorized", "Sessão inválida");
  if (Date.parse(session.expiresAt) <= Date.now()) {
    db.write((draft) => {
      draft.sessions = draft.sessions.filter((s) => s.token !== token);
    });
    return fail(401, "session_expired", "Sua sessão expirou. Entre novamente.");
  }
  const user = db.state.users.find((u) => u.id === session.userId);
  if (!user) return fail(401, "unauthorized", "Sessão inválida");
  return { user, token };
}

// --- Simulação de rede ---------------------------------------------------------------

let random = createRandom(1);
let lastScenario = scenario.name;

async function simulateNetwork(tag: RouteTag): Promise<Response | undefined> {
  if (lastScenario !== scenario.name) {
    random = createRandom(1);
    lastScenario = scenario.name;
  }
  const config = scenario.config;

  const rule = config.failures?.find((f) => f.tags === "*" || f.tags.includes(tag));
  if (rule && (rule.times === undefined || scenario.hit(`fail:${tag}`) < rule.times)) {
    await delay(config.latency.min);
    if (rule.kind === "network") return HttpResponse.error();
    const codes = { 500: "internal_error", 503: "service_unavailable", 401: "unauthorized", 403: "forbidden" } as const;
    return new MockHttpError(rule.kind, codes[rule.kind], "Falha simulada pelo cenário").toResponse();
  }

  let ms = config.latency.min + Math.round(random() * (config.latency.max - config.latency.min));
  if (config.outOfOrder && tag === "nfts.list") {
    // Requisições ímpares demoram mais que as pares seguintes: a resposta antiga chega por último.
    ms = scenario.hit("out-of-order") % 2 === 0 ? 1500 : 150;
  }
  if (ms > 0) await delay(ms);
  return undefined;
}

// --- Definição de rotas ----------------------------------------------------------------

type Method = "get" | "post" | "put" | "patch" | "delete";

interface ResolverContext<Params extends PathParams> {
  request: Request;
  params: Params;
  url: URL;
}

type Hook = () => void;
const beforeEach: Hook[] = [];
/** Executado antes de cada handler (ex.: liquidar pedidos vencidos). */
export const onBeforeRequest = (hook: Hook) => beforeEach.push(hook);

export function route<Params extends PathParams = PathParams>(
  method: Method,
  path: string,
  tag: RouteTag,
  resolver: (ctx: ResolverContext<Params>) => Response | Promise<Response>,
) {
  return http[method]<Params, DefaultBodyType>(`*/api${path}`, async ({ request, params }) => {
    const simulated = await simulateNetwork(tag);
    if (simulated) return simulated;
    try {
      for (const hook of beforeEach) hook();
      return await resolver({ request, params, url: new URL(request.url) });
    } catch (error) {
      if (error instanceof MockHttpError) return error.toResponse();
      console.error("[mocks] erro inesperado no handler", tag, error);
      return new MockHttpError(500, "internal_error", "Erro inesperado").toResponse();
    }
  });
}

/** Rotas privadas: sem token válido respondem 401 antes de chegar no resolver. */
export function privateRoute<Params extends PathParams = PathParams>(
  method: Method,
  path: string,
  tag: RouteTag,
  resolver: (ctx: ResolverContext<Params> & { user: UserRecord; token: string }) => Response | Promise<Response>,
) {
  return route<Params>(method, path, tag, (ctx) => {
    const auth = authenticate(ctx.request) ?? fail(401, "unauthorized", "Entre para continuar");
    return resolver({ ...ctx, ...auth });
  });
}

export const noContent = () => new HttpResponse(null, { status: 204 });
export const nowIso = () => new Date().toISOString();
