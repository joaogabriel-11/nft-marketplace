# Referência local do Figma

Cache das leituras feitas via MCP do Figma, para não repetir chamadas (o assento atual é View, no plano Starter).
Arquivo: `mgWeglbKWTfe0McH6R7RYF` · página `0:1` "Marketplace de NFTs GreenMint" · produto: **Kurio**.

## Frames

| Tela | Desktop (1440) | Mobile (414×896) | Status |
|---|---|---|---|
| Início | `2:2` (h 3668) | `14:5226` | Implementado (Bloco 2) |
| Detalhes do NFT | `10:244` (h 2246) | `15:5536` | Implementado (Bloco 2) |
| Login | `9:115` (modal sobre o mercado) | `16:1022` (tela cheia) | Implementado (Bloco 2) |
| Cadastro | `9:1022` (modal sobre o mercado) | `16:1228` (tela cheia) | Implementado (Bloco 2) |
| Carrinho de NFTs | `11:1278` (h 1754) | `16:360` | Implementado (Bloco 3) |
| Pagamento | `11:2862` (h 1657) | `16:748` | Implementado (Bloco 3) |
| Confirmação de Pedido | `11:4385` (modal sobre o pagamento) | — | Implementado (Bloco 3) |
| Perfil do Colecionador | `9:1238` (h 1080) | — | Bloco 6 |
| Carteiras | `9:1670` (h 1080) | — | Bloco 6 |

Screenshots salvos: `desktop-inicio.png`. Estrutura completa de todos os frames (nomes, textos, posições, tamanhos): `metadata.xml`.

> **Limite do MCP atingido (28/10/2026, plano Starter).** Confirmação desktop e os mobiles de Carrinho e Pagamento foram implementados a partir do cache de metadados (estrutura, textos e medidas). Perfil e Carteiras (Bloco 6) também dependem só desse cache, a menos que a cota seja renovada.

## Componentes do Figma (com descrição no arquivo)

- **Header Row** (`70486:560`): "Início" ativo no Início, Entrar, Criar conta, Perfil e Carteiras; "Mercado" ativo no fluxo de compra. Badge com a contagem do carrinho.
- **Header With Divider** (`70504:3017`): a divisória só aparece no Início, Perfil, Carteiras e nos modais de conta.
- **Filters** (`70485:381`): 310 px de largura, coleções com contagem, faixa de preço com "Aplicar" e redes.
- **Footer** (`70491:1286`) e **Social Button** (`70483:263`).

## Assets exportados

- Artes: 4 imagens raster (1254 px) → `public/images/nfts/{emerald,violet,ivory,golden}-{512,1024}.webp`, geradas por `scripts/optimize-images.mjs`.
- Ícones SVG originais em `src/assets/icons/`. O logo do Google e o ícone central da barra mobile foram exportados como um único SVG via `exportAsync`.

## Tokens

Os valores das variáveis locais estão em `src/index.css` (`@theme`), com o mesmo nome do Figma.
Fonte única: Roboto Mono (400, 500, 700). A escala usada nos frames é 9, 10, 12, 13, 14, 15, 16, 17, 18, 20, 21, 22, 24, 28, 32 e 43 px,
com altura de linha fixa na maioria dos textos (16px; parágrafos com 22–24px).

Gradientes recorrentes:
- `#241612 → #2F1D15` (cards e hero)
- `primary` com alpha variando entre 0% e 54% (overlays, banners e botões do mobile)
