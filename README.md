# Kurio: Marketplace de NFTs

Desafio técnico de frontend: React, TypeScript, TanStack Router e Query, Axios, Socket.IO, Tailwind, shadcn/ui, MSW, Playwright e Lighthouse.
Todas as APIs (REST e Socket.IO) são simuladas com MSW na camada de rede, inclusive no deploy.

**Demo:** https://nft-marketplace-one-fawn.vercel.app · **Repositório:** https://github.com/joaogabriel-11/nft-marketplace

Telas: Início (catálogo com busca, filtros, ordenação e paginação na URL), Detalhe do NFT, Login, Cadastro, Carrinho, Pagamento, Confirmação de pedido, Perfil (dados, avatar e senha) e Carteiras (principal e secundária), em desktop e mobile, com tempo real via Socket.IO (preço, disponibilidade e pedidos).

## Setup

Requisitos: Node 24 e npm 11.

```bash
npm install
npx playwright install chromium   # só para os testes E2E
npm run dev                       # http://localhost:5173, com mocks ligados
```

Funciona a partir de um checkout limpo, sem backend nem serviços externos.

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `VITE_ENABLE_MOCKS` | `true` | Liga o MSW (REST e Socket.IO). Também fica `true` no deploy. |
| `VITE_API_URL` | `/api` | Base das chamadas REST. |
| `VITE_SOCKET_URL` | (mesma origem) | Endpoint do Socket.IO. Vazio usa a origem da página, onde o MSW intercepta o WebSocket. |

Os valores padrão estão em `.env`. Para sobrescrever localmente, use `.env.local` (veja `.env.example`).

## Credenciais fictícias

| Usuário | E-mail | Senha | Estado inicial |
|---|---|---|---|
| Ana Ribeiro | `ana@kurio.dev` | `ana12345` | Carteira principal MetaMask (Ethereum) e 2 favoritos |
| Bruno Costa | `bruno@kurio.dev` | `bruno12345` | Sem carteiras nem favoritos |

Cupons: `KURIO10` (10%), `GENESIS25` (25%) e `EXPIRADO` (expirado). Qualquer outro código é inválido. As senhas não ficam salvas: as fixtures guardam só salt e hash PBKDF2.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Typecheck e build de produção em `dist/` |
| `npm run preview` | Serve o `dist/` |
| `npm run typecheck` | Verificação de tipos (app, config e testes) |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Playwright em Chromium desktop (1440) e mobile (390), contra o build de produção |
| `npm run test:e2e:ui` | Playwright em modo interativo |
| `npm run test:e2e:report` | Abre o último relatório HTML |
| `npm run test:e2e:deploy` | Roda a suíte contra a demo publicada (`-- --url=<outra url>` para outra) |
| `npm run test:visual` | Regressão visual de Início, Detalhe, Carrinho e Pagamento |
| `npm run test:visual:update` | Regera as baselines visuais |
| `npm run lighthouse` | Build e Lighthouse de Início e Detalhe, mobile e desktop, 3 execuções cada. Resumo em `lighthouse/reports/summary.md` (`-- --url=<url>` audita outro endereço) |
| `node scripts/optimize-images.mjs <pasta>` | Regera os WebP das artes a partir dos PNGs exportados do Figma |

## Cenários e reset

O cenário ativo fica salvo no navegador. Para escolher um:

- abra a app com `?scenario=<nome>` (por exemplo, `/?scenario=slow`); o parâmetro sai da URL depois de aplicado;
- ou chame `PUT /api/__dev/scenario` com `{ "name": "<nome>" }`.

Para restaurar os dados iniciais, use `?mock-reset` na URL ou `POST /api/__dev/reset` (aceita `{ "scenario": "<nome>" }`).

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

### Controles da simulação

Funcionam também na demo e não sofrem latência nem falhas. Rode-os no console do DevTools da própria aba (o "servidor" simulado vive na aba), por exemplo:

```js
const dev = (path, body, method = "POST") =>
  fetch(`/api/__dev${path}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
```

| Ação | Como |
|---|---|
| Ver o cenário ativo e a lista | `GET /api/__dev/scenario` |
| Expirar a sessão do token enviado | `POST /api/__dev/sessions/expire` com o header `Authorization` |
| Alterar preço ou estoque de uma edição (emite `nft.updated`) | `dev("/nfts/emerald-ape-042/editions/emerald-ape-042--1-50", { priceEth: "1.5" }, "PATCH")` |
| Ver conexões Socket.IO e últimos eventos | `GET /api/__dev/realtime` |
| Derrubar o tempo real (e recusar reconexões por N ms) | `dev("/realtime/disconnect", { blockMs: 5000 })` |
| Pausar ou retomar a entrega de eventos | `dev("/realtime/pause", { paused: true })` |
| Reenviar o último evento (duplicata) ou um evento antigo | `dev("/realtime/duplicate")` · `dev("/realtime/stale")` |

## Como reproduzir cada fluxo de falha

| Fluxo | Passos | O que deve acontecer |
|---|---|---|
| Skeletons | `/?scenario=slow` | Catálogo, detalhe e carrinho mostram skeletons com shimmer (parados com `prefers-reduced-motion`) sem deslocar o layout. |
| Respostas fora de ordem | `/?scenario=out-of-order`, clique rápido em "Novos lançamentos" e depois em "Em alta" | A grade termina com o resultado de "Em alta"; a resposta atrasada de "Novos lançamentos" é descartada. |
| Erro e nova tentativa | `/?scenario=server-error`, depois troque para `default` e clique em "Tentar novamente" | Mensagem de erro com ação, e a recuperação acontece sem refresh. |
| Falha transitória | `/?scenario=flaky` | A primeira chamada responde 503 e o Query repete sozinho; o usuário nem percebe. |
| Sem conexão | `/?scenario=offline` | Mensagem "Sem conexão" e opção de tentar de novo. |
| Resultado vazio | `/?q=nada` ou `/?scenario=empty-catalog` | Estado vazio com "Limpar filtros". |
| Sessão expirada | Entre, rode `POST /api/__dev/sessions/expire` (ou use `?scenario=session-expired` e espere 15 s) e favorite algo | Leva ao login com "Sua sessão expirou" e, depois de entrar, volta para a mesma tela. |
| Favorito com falha | `?scenario=favorites-fail`, logado, clique em favoritar | O coração muda na hora e volta ao estado anterior com um aviso (rollback). |
| Cadastro com conflito | `/cadastro` com `ana@kurio.dev` | Erro "Este e-mail já está cadastrado" no próprio campo. |
| Cupom inválido ou expirado | No carrinho, aplique `NADA` ou `EXPIRADO` | Erro no campo; o total não muda. |
| Preço alterado na compra | `?scenario=price-change`, siga até "Confirmar pagamento" | "Os valores mudaram", com a diferença, e exige "Confirmar novos valores". |
| Edição esgotada na compra | `?scenario=sold-out`, siga até "Confirmar pagamento" | Mostra o item esgotado e leva de volta ao carrinho. |
| Timeout com idempotência | `?scenario=order-timeout`, confirme o pagamento | Espera cerca de 10 s, reenvia com a mesma chave e mostra o mesmo pedido; `GET /api/orders` tem um só. |
| Clique repetido | Clique duas vezes em "Confirmar pagamento" | Um único pedido. |
| Pagamento recusado | `?scenario=payment-rejected` | "Pagamento recusado", com o motivo e o carrinho preservado. |
| Carteira recusada | `?scenario=wallet-rejected`, "Confirmar compra" | "A conexão foi recusada na carteira"; a segunda tentativa conecta. |
| Perfil e carteiras sem permissão | Logado, `?scenario=forbidden` em `/perfil` ou `/perfil/carteiras` | Mensagem de erro com "Tentar novamente"; volte para `default` e tente de novo. |
| Conflitos no perfil | Em `/perfil`, use o nome de usuário `bruno.costa` | "Este nome de usuário já está em uso" no próprio campo. |
| Avatar recusado | Em `/perfil`, envie um arquivo que não seja PNG, JPG ou WEBP, ou maior que 5 MB | Erro abaixo do avatar; nada é enviado. |
| Carteira duplicada | Em `/perfil/carteiras`, use na secundária o endereço da principal | "Este endereço já está na sua outra carteira" (409). |
| Mudança em tempo real | Carrinho aberto + `PATCH` de preço pelo controle de simulação | Aviso no carrinho e resumo atualizado; com a revisão aberta, "Atualizar cotação". |
| Queda do tempo real | `dev("/realtime/disconnect", { blockMs: 5000 })` | Toast "Reconectando…"; ao voltar, os dados da tela são buscados de novo pela REST. |
| Pedido pendente após refresh | Confirme o pagamento e recarregue a página antes de concluir | O pedido é retomado (banner "Você tem um pedido em processamento") sem criar outro. |

## Testes

- **Onde ficam:** `e2e/api` (contratos REST pelo service worker do MSW), `e2e/ui` (fluxos de interface, tempo real, teclado e relógio) e `e2e/visual` (regressão visual).
- **Como rodam:** contra o build de produção servido pelo `vite preview` (o mesmo artefato do deploy), em Chromium desktop (1440×900) e mobile (390×844). Cada teste parte de um contexto novo, com banco resetado e cenário conhecido.
- **Relógio:** os cenários sensíveis a tempo usam `page.clock` (expiração de cotação, TTL de sessão, liquidação do pagamento). Os eventos de tempo real são disparados no servidor simulado e chegam pelo `socket.io-client` real.
- **Relatórios:** o HTML fica em `playwright-report/` (`npm run test:e2e:report`), e os traces das falhas em `test-results/` (`npx playwright show-trace <arquivo>`).
- **Acessibilidade:** `e2e/ui/a11y.spec.ts` roda o axe-core (WCAG 2.1 A e AA) em todas as telas, inclusive a revisão do pagamento e o recibo, e falha em violações sérias ou críticas. Também confere que nenhuma tela rola na horizontal em 320 px (equivale a 1280 px com zoom de 400%) e que o shimmer para com `prefers-reduced-motion`. O teclado é coberto em `e2e/ui/keyboard.spec.ts`.
- **Regressão visual:** baselines versionadas em `e2e/visual/__screenshots__`, com dados estáveis (reset, cenário `instant`, relógio fixo). Elas são geradas no Windows; a renderização de fontes muda entre sistemas, por isso o projeto visual roda localmente e fica fora do CI Linux. Para outra plataforma, rode `npm run test:visual:update` nela.
- **CI:** o GitHub Actions (`.github/workflows/ci.yml`) roda typecheck, lint, build e `test:e2e` em Ubuntu a cada push, e publica o relatório e os traces como artefatos.

**Lighthouse** (build local, medianas de 3 execuções; detalhes e relatórios em [`lighthouse/reports/summary.md`](./lighthouse/reports/summary.md)): ver a tabela e a justificativa do mobile em [ARCHITECTURE.md](./ARCHITECTURE.md#lighthouse).

Arquitetura, contratos, cache, sessão, tempo real, matriz de testes, limitações e desvios do Figma estão em [ARCHITECTURE.md](./ARCHITECTURE.md).
