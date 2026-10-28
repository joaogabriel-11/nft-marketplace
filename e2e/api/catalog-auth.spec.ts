import { call, CREDENTIALS, expect, login, setScenario, test } from "../support/api";

test.describe("catálogo", () => {
  test("lista paginada com facetas e contrato de ETH como string", async ({ api }) => {
    const { status, body } = await call(api, "GET", "/nfts");
    expect(status).toBe(200);
    expect(body.items).toHaveLength(9);
    expect(body.total).toBe(45);
    expect(body.totalPages).toBe(5);
    expect(body.items[0].name).toBe("Emerald Ape #042");
    expect(body.items[0].priceEth).toBe("1.19");
    expect(body.facets.priceRange).toEqual({ min: "0.02", max: "12.3" });
    const facetTotal = Object.values<number>(body.facets.networks).reduce((a, b) => a + b, 0);
    expect(facetTotal).toBe(45);
  });

  test("filtros combinados, ordenação e busca sem acento refletem os parâmetros", async ({ api }) => {
    const { body } = await call(api, "GET", "/nfts?categories=musica,colecionaveis&networks=polygon,solana&sort=price-asc&pageSize=48");
    expect(body.items.length).toBeGreaterThan(0);
    for (const item of body.items) {
      expect(["musica", "colecionaveis"]).toContain(item.category);
      expect(["polygon", "solana"]).toContain(item.network);
    }
    const prices = body.items.map((i: { priceEth: string }) => Number(i.priceEth));
    expect(prices).toEqual([...prices].sort((a, b) => a - b));

    const search = await call(api, "GET", "/nfts?q=GOLDEN");
    expect(search.body.items.map((i: { name: string }) => i.name)).toEqual(
      expect.arrayContaining(["Golden Beat #207", "Golden Signal #160"]),
    );

    const range = await call(api, "GET", "/nfts?minPrice=1&maxPrice=1.5&pageSize=48");
    for (const item of range.body.items) expect(Number(item.priceEth)).toBeGreaterThanOrEqual(1);
    for (const item of range.body.items) expect(Number(item.priceEth)).toBeLessThanOrEqual(1.5);
  });

  test("resultado vazio, página além do fim e parâmetros inválidos", async ({ api }) => {
    const empty = await call(api, "GET", "/nfts?q=inexistente-xyz");
    expect(empty.body).toMatchObject({ items: [], total: 0, totalPages: 0 });

    const beyond = await call(api, "GET", "/nfts?page=99");
    expect(beyond.body.items).toEqual([]);
    expect(beyond.body.total).toBe(45);

    const invalid = await call(api, "GET", "/nfts?sort=preco&categories=pintura");
    expect(invalid.status).toBe(422);
    expect(invalid.body.error.code).toBe("validation_error");
  });

  test("detalhe por id, edições com limite e NFT inexistente", async ({ api }) => {
    const { status, body } = await call(api, "GET", "/nfts/emerald-ape-042");
    expect(status).toBe(200);
    expect(body.editions.map((e: { label: string }) => e.label)).toEqual(["1/1", "1/10", "1/50", "ABERTA"]);
    const limited = body.editions.find((e: { label: string }) => e.label === "1/10");
    expect(limited).toMatchObject({ available: 3, maxPerOrder: 3 });

    const missing = await call(api, "GET", "/nfts/nao-existe");
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("not_found");
  });

  test("cenário de falha transitória: primeira chamada 503, a seguinte recupera", async ({ api }) => {
    await setScenario(api, "flaky");
    expect((await call(api, "GET", "/nfts")).status).toBe(503);
    expect((await call(api, "GET", "/nfts")).status).toBe(200);
  });
});

test.describe("sessão e conta", () => {
  test("login, consulta da sessão e logout", async ({ api }) => {
    const wrong = await call(api, "POST", "/auth/login", { body: { ...CREDENTIALS.ana, password: "errada123" } });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe("invalid_credentials");

    const session = await login(api, "ana");
    const current = await call(api, "GET", "/auth/session", { token: session.token });
    expect(current.body.user.email).toBe("ana@kurio.dev");
    expect(JSON.stringify(current.body)).not.toContain("password");

    expect((await call(api, "POST", "/auth/logout", { token: session.token })).status).toBe(204);
    const after = await call(api, "GET", "/auth/session", { token: session.token });
    expect(after.status).toBe(401);
  });

  test("cadastro com validação e conflito por campo", async ({ api }) => {
    const invalid = await call(api, "POST", "/auth/register", { body: { username: "x", email: "nao-email", password: "123" } });
    expect(invalid.status).toBe(422);
    expect(Object.keys(invalid.body.error.fieldErrors)).toEqual(expect.arrayContaining(["username", "email", "password"]));

    const conflict = await call(api, "POST", "/auth/register", {
      body: { username: "nova.conta", email: "ANA@kurio.dev ", password: "segredo123" },
    });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error).toMatchObject({ code: "email_taken", fieldErrors: { email: expect.any(String) } });

    const created = await call(api, "POST", "/auth/register", {
      body: { username: "nova.conta", email: "nova@kurio.dev", password: "segredo123" },
    });
    expect(created.status).toBe(201);
    expect(created.body.user.username).toBe("nova.conta");
  });

  test("sessão expirada responde session_expired", async ({ api }) => {
    const { token } = await login(api, "ana");
    await call(api, "POST", "/__dev/sessions/expire", { token });
    const result = await call(api, "GET", "/favorites", { token });
    expect(result.status).toBe(401);
    expect(result.body.error.code).toBe("session_expired");
  });

  test("perfil persiste, rejeita conflito e troca de senha valida a senha atual", async ({ api }) => {
    const { token } = await login(api, "ana");
    const conflict = await call(api, "PATCH", "/profile", {
      token,
      body: { displayName: "Ana R.", username: "bruno.costa", email: "ana@kurio.dev" },
    });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.fieldErrors.username).toBeTruthy();

    const updated = await call(api, "PATCH", "/profile", {
      token,
      body: { displayName: "Ana R.", username: "ana.r", email: "ana@kurio.dev" },
    });
    expect(updated.body.displayName).toBe("Ana R.");
    await api.reload();
    expect((await call(api, "GET", "/profile", { token })).body.username).toBe("ana.r");

    const wrong = await call(api, "POST", "/profile/password", {
      token,
      body: { currentPassword: "errada123", newPassword: "novaSenha123" },
    });
    expect(wrong.body.error).toMatchObject({ code: "invalid_password", fieldErrors: { currentPassword: expect.any(String) } });
    const ok = await call(api, "POST", "/profile/password", {
      token,
      body: { currentPassword: "ana12345", newPassword: "novaSenha123" },
    });
    expect(ok.status).toBe(204);
    expect((await call(api, "POST", "/auth/login", { body: { email: "ana@kurio.dev", password: "novaSenha123" } })).status).toBe(200);
  });
});

test.describe("isolamento entre usuários", () => {
  test("rotas privadas exigem token e cada usuário vê só os próprios dados", async ({ api }) => {
    expect((await call(api, "GET", "/favorites")).status).toBe(401);

    const ana = await login(api, "ana");
    const bruno = await login(api, "bruno");
    expect((await call(api, "GET", "/favorites", { token: ana.token })).body.nftIds).toContain("emerald-ape-042");
    expect((await call(api, "GET", "/favorites", { token: bruno.token })).body.nftIds).toEqual([]);

    await call(api, "PUT", "/favorites/sage-nomad-009", { token: bruno.token });
    expect((await call(api, "GET", "/favorites", { token: ana.token })).body.nftIds).not.toContain("sage-nomad-009");

    expect((await call(api, "GET", "/wallets", { token: bruno.token })).body).toEqual({ primary: null, secondary: null });
    expect((await call(api, "GET", "/wallets", { token: ana.token })).body.primary.type).toBe("metamask");
  });

  test("reset restaura integralmente o cenário conhecido", async ({ api }) => {
    const { token } = await login(api, "ana");
    await call(api, "DELETE", "/favorites/emerald-ape-042", { token });
    await call(api, "POST", "/__dev/reset", { body: { scenario: "instant" } });
    const again = await login(api, "ana");
    expect((await call(api, "GET", "/favorites", { token: again.token })).body.nftIds).toContain("emerald-ape-042");
    // Sessões antigas não sobrevivem ao reset.
    expect((await call(api, "GET", "/favorites", { token })).status).toBe(401);
  });
});
