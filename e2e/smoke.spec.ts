import { expect, test } from "@playwright/test";

test("a aplicação sobe com o MSW ativo e responde pela API simulada", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "KURIO" })).toBeVisible();
  // O texto só aparece se o Axios recebeu a resposta do handler MSW.
  await expect(page.getByRole("status")).toHaveText("API: ok");
});

test("rota inexistente mostra a página 404 sem quebrar a SPA", async ({ page }) => {
  await page.goto("/rota-que-nao-existe");
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  await page.getByRole("link", { name: "Voltar ao início" }).click();
  await expect(page).toHaveURL("/");
});
