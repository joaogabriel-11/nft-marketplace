# Kurio: Marketplace de NFTs

Desafio técnico de frontend: React, TypeScript, TanStack Router e Query, Axios, Socket.IO, Tailwind, shadcn/ui, MSW, Playwright e Lighthouse.
Todas as APIs são simuladas com MSW na camada de rede.

**Demo:** https://nft-marketplace-one-fawn.vercel.app · **Repositório:** https://github.com/joaogabriel-11/nft-marketplace

> Em construção. Prontos: API simulada completa, Início (catálogo com busca, filtros, ordenação e paginação na URL), Detalhe do NFT, Login e Cadastro, em desktop e mobile. Carrinho, pagamento, tempo real e conta entram nos próximos blocos.

## Credenciais fictícias

| Usuário | E-mail | Senha | Estado inicial |
|---|---|---|---|
| Ana Ribeiro | `ana@kurio.dev` | `ana12345` | Carteira principal MetaMask (Ethereum) e 2 favoritos |
| Bruno Costa | `bruno@kurio.dev` | `bruno12345` | Sem carteiras nem favoritos |

Cupons: `KURIO10` (10%), `GENESIS25` (25%) e `EXPIRADO` (expirado). Qualquer outro código é inválido.

## Cenários e reset

O cenário ativo fica salvo no navegador. Para escolher um, use uma das opções:

- abra a app com `?scenario=<nome>`, por exemplo `/?scenario=slow`;
- ou chame `PUT /api/__dev/scenario` com `{ "name": "<nome>" }`.

| Cenário | Efeito |
|---|---|
| `default` | Sucesso com latência entre 80 e 220 ms |
| `instant` | Sem latência (usado nos testes) |
| `slow` | 2,5 s por resposta (para ver skeletons) |
| `variable-latency` | Entre 0,1 e 2 s (reproduzível) |
| `out-of-order` | Listagens alternam 1,5 s e 0,15 s, e as respostas chegam fora de ordem |
| `empty-catalog` | Catálogo vazio |
| `offline` | Falha de rede em toda a API |
| `server-error` | Catálogo, detalhe e carrinho respondem 500 |
| `flaky` | A primeira chamada de catálogo, detalhe e carrinho responde 503 e a seguinte funciona |
| `session-expired` | A sessão expira 15 s depois do login |
| `forbidden` | Perfil e carteiras respondem 403 |
| `favorites-fail` | Incluir ou remover favorito falha (rollback otimista) |
| `price-change` | O preço do primeiro item sobe 10% depois da primeira cotação |
| `sold-out` | A edição do primeiro item esgota depois da primeira cotação |
| `order-timeout` | O pedido é criado, mas a resposta chega depois do timeout do cliente (10 s) |
| `payment-rejected` | Pagamento recusado |
| `wallet-rejected` | A primeira conexão de carteira é recusada |

Controles da simulação. Eles também funcionam na demo, sem latência nem falhas:

| Ação | Como |
|---|---|
| Restaurar os dados iniciais | `?mock-reset` na URL, ou `POST /api/__dev/reset` com `{ "scenario": "<nome>" }` opcional |
| Ver o cenário ativo e a lista | `GET /api/__dev/scenario` |
| Expirar a sessão do token enviado | `POST /api/__dev/sessions/expire` |
| Alterar preço ou estoque de uma edição | `PATCH /api/__dev/nfts/:nftId/editions/:editionId` com `{ "priceEth": "1.5", "available": 0 }` |

Contratos completos em [ARCHITECTURE.md](./ARCHITECTURE.md#contratos-rest).

## Requisitos

- Node 24 e npm 11
- Chromium do Playwright: `npx playwright install chromium`

## Setup

```bash
npm install
npm run dev        # http://localhost:5173, com mocks ligados
```

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `VITE_ENABLE_MOCKS` | `true` | Liga o MSW (REST e Socket.IO). Também fica `true` no deploy. |
| `VITE_API_URL` | `/api` | Base das chamadas REST. |

Os valores padrão estão em `.env`. Para sobrescrever localmente, use `.env.local` (veja `.env.example`).

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Typecheck e build de produção em `dist/` |
| `npm run preview` | Serve o `dist/` |
| `npm run typecheck` | Verificação de tipos |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Playwright (build, preview e testes em desktop e mobile). Relatório em `playwright-report/` |
| `E2E_BASE_URL=<url> npm run test:e2e` | Roda a mesma suíte contra um deploy publicado, sem servidor local |
| `node scripts/optimize-images.mjs <pasta>` | Regera os WebP das artes a partir dos PNGs exportados do Figma |
| `npm run lighthouse` | Build e auditoria Lighthouse (3 medições por perfil). Relatórios em `lighthouse/reports/` |

Veja também [ARCHITECTURE.md](./ARCHITECTURE.md).
