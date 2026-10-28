# Arquitetura

Documento vivo, atualizado a cada bloco de trabalho.

## Stack e organização

| Camada | Escolha | Onde |
|---|---|---|
| Build | Vite 8 + React 19 + TypeScript 5.9 (`strict`) | `vite.config.ts` |
| Rotas | TanStack Router, rotas por arquivo com code splitting automático | `src/routes`, `src/router.tsx` |
| Estado remoto | TanStack Query, com o `QueryClient` injetado no contexto do router | `src/lib/query-client.ts` |
| HTTP | Instância única do Axios | `src/api/client.ts` |
| Mocks | MSW 2 (REST e Socket.IO via `@mswjs/socket.io-binding`) | `src/mocks` |
| Estilo | Tailwind 4 com tokens do Figma em `@theme`, mais shadcn/ui | `src/index.css`, `src/components/ui` |

Domínios ficam em `src/features/{catalog,nft,cart,checkout,auth,profile,wallets}`.

## Decisões

### Bloco 0: setup

- **MSW 2 em vez de 3.** O `@mswjs/socket.io-binding@0.2` declara `msw@^2.10` como dependência par. Forçar a v3 com `--legacy-peer-deps` arriscaria o requisito de Socket.IO, que é eliminatório.
- **Mocks atrás de `VITE_ENABLE_MOCKS`.** O `main.tsx` importa `src/mocks/browser` de forma dinâmica e só renderiza depois de `worker.start()`. Assim a primeira requisição já é interceptada e, sem a flag, o MSW não entra no bundle principal. O `.env` versionado deixa a flag em `true`, porque o deploy de demonstração depende dos mocks.
- **Variáveis de ambiente validadas com zod** em `src/lib/env.ts`. Uma configuração inválida falha no boot, não em tempo de uso.
- **Tokens com o mesmo nome das variáveis do Figma** (`color/primary` vira `--color-primary`). Aliases semânticos do shadcn (`background`, `muted-foreground`, `ring`...) apontam para esses tokens em `@theme inline`. A escala tipográfica do Figma vira `text-9` até `text-43`, registrada também no `tailwind-merge` para o `cn()` não confundir tamanho com cor.
- **Fonte auto-hospedada** (`@fontsource/roboto-mono`, só o subset latino). Funciona offline e evita dependência de CDN no Lighthouse.
- **Padrões iniciais do Query:** `staleTime` de 30s, uma retentativa em queries, nenhuma em mutations (pedidos dependem de idempotência explícita) e sem refetch ao focar a janela. A política completa entra no Bloco 1.
- **E2E contra o build de produção** (`vite build` mais `vite preview`), o mesmo artefato publicado, em Chromium desktop (1440) e mobile (390).
- **SPA na Vercel:** `vercel.json` reescreve todas as rotas para `index.html`. Arquivos estáticos (`/assets`, `mockServiceWorker.js`) têm precedência. O worker é servido com `no-cache` para atualizar a cada deploy.
