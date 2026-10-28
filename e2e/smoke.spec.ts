import { expect, test } from "@playwright/test";
import { openApp } from "./support/api";

test("a aplicação sobe com o MSW ativo e lista o catálogo simulado", async ({ page }) => {
  await openApp(page);
  // A lista só aparece se o Axios recebeu a resposta do handler MSW.
  await expect(page.locator("#catalogo [role=status]")).toHaveText("45 NFTs encontrados");
});

test("rota inexistente mostra a página 404 sem quebrar a SPA", async ({ page }) => {
  await openApp(page, "/rota-que-nao-existe");
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  await page.getByRole("link", { name: "Voltar ao início" }).click();
  await expect(page).toHaveURL("/");
});
