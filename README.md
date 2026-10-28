# Kurio: Marketplace de NFTs

Desafio técnico de frontend: React, TypeScript, TanStack Router e Query, Axios, Socket.IO, Tailwind, shadcn/ui, MSW, Playwright e Lighthouse.
Todas as APIs são simuladas com MSW na camada de rede.

> Em construção. Credenciais fictícias, cenários, reset e fluxos de falha serão documentados nos próximos blocos.

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
| `npm run lighthouse` | Build e auditoria Lighthouse (3 medições por perfil). Relatórios em `lighthouse/reports/` |

Veja também [ARCHITECTURE.md](./ARCHITECTURE.md).
