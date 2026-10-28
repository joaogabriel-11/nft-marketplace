# Marketplace de NFTs (desafio técnico frontend)

O enunciado completo está em DESAFIO.md. Em caso de dúvida, ele manda.
Prazo curto: priorize fluxos funcionando de ponta a ponta antes de polir.

## Ambiente

- Windows, projeto em C:\Users\jota\Documents\GitHub\nft-marketplace
- Vite + React + TypeScript 5.9.3 (NÃO atualizar para TS 7: conflita com typescript-eslint)
- Já instalados: TanStack Router e Query, Axios, socket.io-client, decimal.js, zod,
  react-hook-form, Tailwind 4, MSW, @mswjs/socket.io-binding, Playwright, Lighthouse
- MSW fixado na v2 (o @mswjs/socket.io-binding exige msw@^2; não atualizar para v3)
- Bloco 0 configurou: vite.config (router plugin, tailwind, alias @), shadcn/ui (components.json),
  .env, bootstrap do MSW, rotas base, vercel.json, scripts, Playwright e Lighthouse
- Referência local do Figma (IDs dos frames, screenshots): docs/figma/README.md

## Figma

- Arquivo: [https://www.figma.com/design/mgWeglbKWTfe0McH6R7RYF/Frontend-Challenge--Copy-?node-id=0-1&p=f&t=9FehLP0MspVbZLhu-0]
- Use o MCP do Figma para ler medidas, cores, tipografia e componentes antes de implementar
  cada tela. Não invente estilos: o que não estiver no Figma segue o padrão visual existente.
- Um frame por vez: tokens → componentes → tela desktop → mobile.

## Regras de arquitetura

- Mocks só em src/mocks (handlers MSW, db em memória com persistência em localStorage,
  fixtures, cenários, reset). Componentes, hooks e Axios não têm respostas fictícias
  nem caminhos alternativos de negócio.
- Mocks ligados por VITE_ENABLE_MOCKS=true, inclusive no deploy.
- ETH sempre como string decimal (decimal.js). Quantidades inteiras.
- Busca, filtros, ordenação e paginação ficam na URL (search params validados).
- Sessão por token Bearer; todo handler privado valida o token e isola dados por userId.
- Logout ou troca de usuário: limpar o cache do Query, fechar o socket, apagar o token.
- Pedidos com chave de idempotência; revalidar a cotação antes de confirmar.
- Socket.IO real: eventos nft.updated e order.updated com id e versão, deduplicação,
  atualização do cache do Query, reconciliação via REST ao reconectar, cleanup de listeners.
- Atualização otimista com rollback em pelo menos os favoritos.
- Skeletons com shimmer, respeitando prefers-reduced-motion.
- Acessibilidade: foco visível, foco em dialogs e drawers, labels e erros associados, aria-live.

## Eliminatórios (nunca violar)

Não usar a stack de verdade; fluxos só visuais; compra confirmada sem resposta do mock;
dados vazando entre usuários; eventos simulados direto na UI (sem socket real);
ausência de E2E executáveis.

## Estrutura

src/api, src/mocks, src/features/{catalog,nft,cart,checkout,auth,profile,wallets},
src/components/ui, src/routes, src/lib

## Como trabalhar

- Um bloco por vez, na ordem: 0 setup e deploy → 1 contratos e MSW → 2 início, detalhe e login
  → 3 carrinho e checkout → 4 Socket.IO → 5 Playwright e docs → 6 perfil, carteiras, a11y, Lighthouse.
- Antes de cada bloco, apresente um plano curto e espere minha aprovação.
- Ao terminar um bloco: rode `npm run typecheck` e `npm run build`, faça commit com
  mensagem clara e me diga em poucas linhas o que foi feito e o que ficou pendente.
- Explique decisões importantes de forma breve (vou precisar defender o código).
- Anote decisões de cache, sessão e reconciliação em ARCHITECTURE.md ao longo do caminho.

## Entrega

README.md (setup, env, credenciais fictícias, cenários e reset, comandos de falha),
ARCHITECTURE.md (contratos, sessão, carrinho, cache, REST x socket, limitações, desvios do Figma),
deploy na Vercel com vercel.json (rewrite para SPA).
Scripts: dev, build, preview, typecheck, lint, test:e2e, lighthouse.
