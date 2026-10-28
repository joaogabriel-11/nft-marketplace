import { http, HttpResponse } from "msw";
import { z } from "zod";
import { ethAmountSchema } from "@/api/contracts";
import { db } from "../db/store";
import { MockHttpError, noContent, parseBody } from "../lib/http";
import { isScenarioName, scenario, SCENARIOS, type ScenarioName } from "../scenarios";
import { mutateEdition } from "./orders";

/**
 * Controles da simulação (reset, cenário, sessão, catálogo). Não sofrem latência nem
 * falhas de cenário. Usados pelos testes e disponíveis na demo para reproduzir fluxos.
 */
const dev = (path: string) => `*/api/__dev${path}`;

const listScenarios = () =>
  Object.entries(SCENARIOS).map(([name, config]) => ({ name, description: config.description }));

const guard = async (fn: () => Response | Promise<Response>) => {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof MockHttpError) return error.toResponse();
    throw error;
  }
};

export const devHandlers = [
  // Prontidão da simulação (usado pelos testes): sem latência, mesmo no cenário "slow".
  http.get("*/api/health", () => HttpResponse.json({ status: "ok", scenario: scenario.name })),

  http.post(dev("/reset"), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { scenario?: string };
    db.reset();
    scenario.set(isScenarioName(body.scenario) ? body.scenario : "default");
    return HttpResponse.json({ ok: true, scenario: scenario.name });
  }),

  http.get(dev("/scenario"), () => HttpResponse.json({ active: scenario.name, scenarios: listScenarios() })),

  http.put(dev("/scenario"), ({ request }) =>
    guard(async () => {
      const { name } = await parseBody(request, z.object({ name: z.string() }));
      if (!isScenarioName(name)) {
        return HttpResponse.json({ error: { code: "not_found", message: `Cenário ${name} não existe` } }, { status: 404 });
      }
      scenario.set(name as ScenarioName);
      return HttpResponse.json({ active: scenario.name });
    }),
  ),

  /** Expira imediatamente a sessão do token enviado (ou todas, sem token). */
  http.post(dev("/sessions/expire"), ({ request }) => {
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    const past = new Date(Date.now() - 1000).toISOString();
    db.write((draft) => {
      for (const session of draft.sessions) if (!token || session.token === token) session.expiresAt = past;
    });
    return noContent();
  }),

  /** Altera preço/disponibilidade de uma edição (gera nft.updated no Bloco 4). */
  http.patch<{ nftId: string; editionId: string }>(dev("/nfts/:nftId/editions/:editionId"), ({ request, params }) =>
    guard(async () => {
      const input = await parseBody(
        request,
        z.object({ priceEth: ethAmountSchema.optional(), available: z.number().int().nonnegative().optional() }),
      );
      const nft = mutateEdition(params.nftId, params.editionId, (edition) => {
        if (input.priceEth !== undefined) edition.priceEth = input.priceEth;
        if (input.available !== undefined) edition.available = input.available;
      });
      return HttpResponse.json({ id: nft.id, version: nft.version });
    }),
  ),
];
