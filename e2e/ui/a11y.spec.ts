import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { call, CREDENTIALS, expect, openApp, test } from "../support/api";
import { EMERALD, IVORY } from "../support/app";

/**
 * Acessibilidade automática (axe-core, WCAG 2.1 A/AA) em todas as telas, desktop e mobile,
 * mais reflow sem rolagem horizontal e movimento reduzido. Violações "serious"/"critical"
 * falham o teste; o relatório lista o que foi encontrado.
 */
async function loginWithToken(page: Page) {
  const session = await call<{ token: string }>(page, "POST", "/auth/login", { body: CREDENTIALS.ana });
  await page.evaluate((token) => localStorage.setItem("kurio:token", token), session.body.token);
  return session.body.token;
}

async function expectNoSeriousViolations(page: Page, screen: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const report = serious.map(
    (v) => `${v.id} (${v.impact}): ${v.help}\n${v.nodes.slice(0, 4).map((n) => `  - ${n.target.join(" ")} ${n.failureSummary?.split("\n")[1] ?? ""}`).join("\n")}`,
  );
  expect(report, `${screen}: violações de acessibilidade`).toEqual([]);
}

/** Telas públicas e privadas, já no estado final (dados carregados). */
const SCREENS: Array<{ name: string; prepare: (page: Page) => Promise<void> }> = [
  {
    name: "início",
    prepare: async (page) => {
      await openApp(page);
      await expect(page.locator("#catalogo [role=status]")).toHaveText("45 NFTs encontrados");
    },
  },
  {
    name: "detalhe",
    prepare: async (page) => {
      await openApp(page, "/nfts/emerald-ape-042");
      await expect(page.getByRole("heading", { name: "Mais desta coleção" })).toBeVisible();
    },
  },
  {
    name: "login",
    prepare: async (page) => {
      await openApp(page, "/login");
      await expect(page.getByRole("dialog")).toBeVisible();
    },
  },
  {
    name: "cadastro",
    prepare: async (page) => {
      await openApp(page, "/cadastro");
      await expect(page.getByRole("dialog")).toBeVisible();
    },
  },
  {
    name: "carrinho",
    prepare: async (page) => {
      await openApp(page);
      const token = await loginWithToken(page);
      await call(page, "POST", "/cart/items", { token, body: { ...EMERALD, quantity: 2 } });
      await call(page, "POST", "/cart/items", { token, body: { ...IVORY, quantity: 1 } });
      await page.goto("/carrinho");
      await expect(page.getByRole("listitem").filter({ hasText: "Ivory Baron #088" })).toBeVisible();
    },
  },
  {
    name: "pagamento",
    prepare: async (page) => {
      await openApp(page);
      const token = await loginWithToken(page);
      await call(page, "POST", "/cart/items", { token, body: { ...EMERALD, quantity: 1 } });
      await page.goto("/pagamento");
      await expect(page.getByRole("button", { name: "Confirmar compra" })).toBeEnabled();
    },
  },
  {
    name: "perfil",
    prepare: async (page) => {
      await openApp(page);
      await loginWithToken(page);
      await page.goto("/perfil");
      await expect(page.getByLabel("Nome de exibição")).toHaveValue("Ana Ribeiro");
    },
  },
  {
    name: "carteiras",
    prepare: async (page) => {
      await openApp(page);
      await loginWithToken(page);
      await page.goto("/perfil/carteiras");
      await expect(page.getByRole("region", { name: "Carteira principal" })).toBeVisible();
    },
  },
  {
    name: "404",
    prepare: async (page) => {
      await openApp(page, "/rota-inexistente");
      await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
    },
  },
];

for (const screen of SCREENS) {
  test(`axe: ${screen.name} sem violações sérias`, async ({ page }) => {
    await screen.prepare(page);
    await expectNoSeriousViolations(page, screen.name);
  });
}

test("axe: dialog de revisão do pagamento e recibo confirmado", async ({ page }) => {
  await SCREENS.find((s) => s.name === "pagamento")!.prepare(page);
  await page.getByRole("button", { name: "Confirmar compra" }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Confirmar pagamento" })).toBeVisible();
  await expectNoSeriousViolations(page, "revisão");
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar pagamento" }).click();
  await expect(page.getByRole("heading", { name: "Seus NFTs agora estão na sua carteira" })).toBeVisible({ timeout: 10_000 });
  await expectNoSeriousViolations(page, "recibo");
});

test.describe("reflow e zoom", () => {
  // 320 px de largura equivale a 1280 px com zoom de 400% (WCAG 1.4.10).
  test.use({ viewport: { width: 320, height: 720 } });

  for (const screen of SCREENS) {
    test(`sem rolagem horizontal em 320 px: ${screen.name}`, async ({ page }) => {
      await screen.prepare(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${screen.name} transborda ${overflow}px na horizontal`).toBeLessThanOrEqual(0);
    });
  }
});

const firstSkeleton = (page: Page) => page.locator("#catalogo .skeleton").filter({ visible: true }).first();

test("skeletons com shimmer quando o movimento é permitido", async ({ page }) => {
  await openApp(page, "/", "slow");
  await expect(firstSkeleton(page)).toBeVisible();
  expect(await firstSkeleton(page).evaluate((element) => getComputedStyle(element).animationName)).toBe("shimmer");
});

test.describe("movimento reduzido", () => {
  test.use({ reducedMotion: "reduce" });

  test("skeletons sem animação com prefers-reduced-motion", async ({ page }) => {
    await openApp(page, "/", "slow");
    await expect(firstSkeleton(page)).toBeVisible();
    expect(await firstSkeleton(page).evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  });
});
