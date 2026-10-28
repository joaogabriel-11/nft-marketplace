import type { Locator } from "@playwright/test";
import { expect, openApp, test } from "../support/api";
import { main, readyForCheckout } from "../support/app";

/** O elemento focado está dentro do locator? (foco preso em dialogs e sheets) */
const focusInside = (container: Locator) =>
  container.evaluate((element) => element.contains(document.activeElement));

async function outlineOf(locator: Locator) {
  return locator.evaluate((element) => getComputedStyle(element).outlineStyle);
}

test("pular para o conteúdo move o foco para o main com foco visível", async ({ page }) => {
  await openApp(page);
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Pular para o conteúdo" });
  await expect(skip).toBeFocused();
  expect(await outlineOf(skip)).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(page.locator("main#conteudo")).toBeFocused();
});

test.describe("teclado (desktop)", () => {
  test.skip(({ isMobile }) => isMobile, "Filtros laterais, galeria e busca do header existem a partir do tablet");

  test("filtros, ordenação e paginação do catálogo pelo teclado", async ({ page }) => {
    await openApp(page);
    const catalog = page.locator("#catalogo");

    const category = catalog.getByRole("checkbox", { name: /Música/ });
    await category.focus();
    await page.keyboard.press("Space");
    await expect(page).toHaveURL(/categories=musica/);
    await expect(category).toBeChecked();

    const sort = page.getByRole("combobox", { name: /Ordenar por/ });
    await sort.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/sort=price-asc/);
    await expect(sort).toBeFocused();

    await page.goto("/");
    const page2 = page.getByRole("button", { name: "Página 2" });
    await page2.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/page=2/);
  });

  test("edição com setas, busca e zoom com foco preso e devolvido ao fechar", async ({ page }) => {
    await openApp(page, "/nfts/emerald-ape-042");
    const edition = (label: string) => main(page).getByRole("radio", { name: label }).filter({ visible: true });
    await edition("1/50").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(edition("1/10")).toBeChecked();
    await expect(edition("1/10")).toBeFocused();

    // Zoom da galeria: o foco fica no dialog e volta para o gatilho com Esc.
    const zoom = page.getByRole("button", { name: /^Ampliar / });
    await zoom.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Tab");
      expect(await focusInside(dialog)).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(zoom).toBeFocused();

    // Busca do header: o foco entra no campo; Esc devolve à lupa.
    const searchTrigger = page.getByRole("button", { name: "Buscar NFTs" });
    await searchTrigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("searchbox", { name: "Termo de busca" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(searchTrigger).toBeFocused();
  });

  test("pagamento: enviar com erros foca o primeiro campo inválido com a mensagem associada", async ({ page }) => {
    await readyForCheckout(page, { who: "bruno" });
    await page.getByRole("button", { name: "Confirmar compra" }).click();
    const network = page.getByLabel("Rede");
    await expect(network).toBeFocused();
    await expect(network).toHaveAttribute("aria-invalid", "true");
    await expect(network).toHaveAccessibleDescription("Selecione uma rede");
  });
});

test("sheet de filtros mobile: foco preso, Esc fecha e devolve o foco", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Sheet de filtros do layout mobile");
  await openApp(page);
  const trigger = page.getByRole("button", { name: "Filtros", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const sheet = page.getByRole("dialog", { name: "Filtros" });
  await expect(sheet).toBeVisible();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    expect(await focusInside(sheet)).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(trigger).toBeFocused();
});
