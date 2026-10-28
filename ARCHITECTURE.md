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

## Camadas de dados

```
UI / hooks (features)  →  TanStack Query (cache por chave)  →  src/api/endpoints.ts  →  Axios (src/api/client.ts)
                                                                     │ valida com zod                 │ Bearer, X-Guest-Cart-Id, Idempotency-Key
                                                                     ▼                                ▼
                                                        src/api/contracts (fonte única)     rede (service worker do MSW)
                                                                     ▲                                ▼
                                                                     └──────────────  src/mocks (handlers, db, cenários)
```

- **Contratos** (`src/api/contracts`) são schemas zod. Os tipos TypeScript saem deles, o cliente valida toda resposta 2xx e os handlers MSW validam todo corpo recebido. Uma divergência vira `ApiError { kind: "invalid_response" }` em vez de dado corrompido na UI.
- **Erros** chegam à UI sempre como `ApiError`, com `kind` (`http`, `network`, `timeout`, `canceled`, `invalid_response`), `status`, `code` estável e `fieldErrors` por campo. A UI decide pelo `code`, não pelo texto.
- **ETH** trafega como string decimal (`"2.158"`) e é calculado com decimal.js no servidor simulado (6 casas no resultado). Quantidades são inteiras.
- **Mocks** ficam só em `src/mocks`. Componentes, hooks e Axios não sabem que existe simulação: a única ligação é o `VITE_ENABLE_MOCKS` no `main.tsx`.

## Contratos REST

Base `/api`. Rotas marcadas com 🔒 exigem `Authorization: Bearer <token>`. Corpo de erro: `{ error: { code, message, fieldErrors?, details? } }`.

| Método e rota | Descrição | Erros relevantes |
|---|---|---|
| `POST /auth/register` | Cria conta e já devolve `Session` | 422 `validation_error`, 409 `email_taken` / `username_taken` (com `fieldErrors`) |
| `POST /auth/login` | Devolve `Session { token, expiresAt, user }` | 401 `invalid_credentials` (mesma resposta para e-mail inexistente e senha errada) |
| 🔒 `GET /auth/session` | Recupera a sessão após refresh | 401 `unauthorized` / `session_expired` |
| 🔒 `POST /auth/logout` | Encerra o token e as conexões de carteira da sessão | |
| `GET /nfts` | `q`, `categories=a,b`, `networks=a,b`, `minPrice`, `maxPrice`, `tab=all\|new\|trending`, `sort=recent\|price-asc\|price-desc\|name`, `page`, `pageSize`. Devolve itens, paginação e `facets` (contagens sobre busca e aba, faixa de preço do catálogo) | 422 para parâmetros inválidos |
| `GET /nfts/:id` | Detalhe com edições (`available`, `maxPerOrder`, `priceEth`) | 404 |
| `GET /nfts/:id/related` | "Mais desta coleção" | 404 |
| 🔒 `GET/PUT/DELETE /favorites[/:nftId]` | Lista, inclui e remove favoritos; devolve `{ nftIds }` | 404 |
| `GET /cart` | Carrinho do usuário (Bearer) ou do visitante (`X-Guest-Cart-Id`), com preço e disponibilidade atuais, `status` por item e totais | |
| `POST /cart/items` · `PATCH/DELETE /cart/items/:editionId` | Inclui (soma), altera ou remove item | 409 `insufficient_availability` (`details.maxPerOrder`), 409 `edition_unavailable` |
| `PUT/DELETE /cart/coupon` | Aplica ou remove cupom | 422 `coupon_invalid` / `coupon_expired` |
| 🔒 `POST /cart/merge` | Soma o carrinho do visitante ao do usuário (respeitando limites) e apaga o de visitante | |
| 🔒 `POST /checkout/quote` | Cotação com validade de 5 min: snapshot de itens, cupom e totais | 422 `cart_empty`, 409 `insufficient_availability` |
| 🔒 `POST /orders` + `Idempotency-Key` | Cria pedido `pending` a partir da cotação | 409 `idempotency_conflict`, `quote_outdated` / `quote_expired` (`details: { quote, changes }`), `wallet_not_connected`, 422 rede incompatível |
| 🔒 `GET /orders/:id` · `GET /orders?status=` | Estado e recibo; pedido de outra conta responde 403 | 403, 404 |
| 🔒 `GET/PATCH /profile` · `PUT/DELETE /profile/avatar` · `POST /profile/password` | Perfil, avatar (data URL até 512 KB) e senha | 409 conflitos, 422 `invalid_password` |
| 🔒 `GET /wallets` · `PUT /wallets/:slot` | Carteiras `primary` e `secondary`; endereço validado por rede | 422, 409 endereço duplicado |
| 🔒 `POST/DELETE /wallets/:id/connect` | Simula conectar e desconectar a extensão | 409 `wallet_rejected` |

Erros transversais simulados pelos cenários: 401, 403, 500 `internal_error`, 503 `service_unavailable` e falha de rede.

### Regras de compra

1. **Cotação:** é criada a partir do carrinho e falha se algum item estiver esgotado ou acima do limite.
2. **Pedido:** a criação revalida tudo contra o estado atual: preço, quantidade, disponibilidade, cupom e total. Qualquer diferença responde `409 quote_outdated` com a cotação nova e a lista de mudanças. A UI precisa mostrar as mudanças e pedir uma nova confirmação.
3. **Idempotência:** a chave é por usuário. Mesma chave com o mesmo corpo (comparado por hash estável) devolve o mesmo pedido. Mesma chave com outro corpo responde `409 idempotency_conflict`. Uma chave nova representa uma nova intenção de compra.
4. **Reserva de estoque:** ao criar o pedido, o estoque é reservado. Se o pagamento for recusado, a reserva é devolvida. Se for confirmado, o carrinho perde só as quantidades compradas.
5. **Liquidação:** o pedido guarda `settlesAt` e o desfecho definido pelo cenário. A conclusão é preguiçosa: acontece na próxima requisição ou no intervalo de 1 s do worker. Por isso sobrevive a refresh e funciona com o relógio controlado do Playwright. Pedidos `confirmed` e `rejected` são terminais.
6. **Recibo:** é o snapshot da cotação. Mudanças posteriores no catálogo não o alteram.

## Mocks (MSW)

- **Banco** (`src/mocks/db/store.ts`): estado único em memória, persistido no localStorage (`kurio:mock-db`). Toda escrita passa por `db.write`, que é transacional: roda sobre uma cópia e só troca o estado se não houver erro. Depois persiste e notifica as mudanças (`{ type: "nft" | "order", id, version }`). É esse canal que o Socket.IO vai transmitir no Bloco 4, para REST e eventos nunca divergirem.
- **Versões:** cada NFT e cada pedido têm `version` monotônica, base para descartar eventos antigos ou duplicados.
- **Fixtures determinísticas:** 45 NFTs gerados com PRNG de semente fixa (os 9 primeiros com os nomes e preços do Figma), 2 usuários com senha em PBKDF2, cupons válido e expirado. As fixtures não dependem do relógio real.
- **Isolamento:** todo handler privado resolve o usuário pelo token e filtra pelo `userId`. Carrinho de visitante e carrinho de usuário nunca são acessíveis pela credencial do outro.
- **Cenários** (`src/mocks/scenarios.ts`): configuram latência, falhas por rota (com "só as N primeiras") e efeitos de negócio. A latência variável usa PRNG reiniciado a cada troca de cenário, então é reproduzível.

## Política de cache (TanStack Query)

- **Chaves:** dados públicos sob `["public", ...]`. Dados privados sob `["user", userId, ...]`, com o carrinho de visitante em `["user", "guest", "cart"]`. Trocar de usuário nunca reaproveita cache, e o logout remove `["user"]` inteiro com um único `removeQueries`.
- **Parâmetros na chave:** a lista do catálogo usa os parâmetros validados como chave. Cada combinação tem seu cache, e respostas de parâmetros antigos não sobrescrevem a atual.
- **Cancelamento:** todo endpoint aceita o `signal` do Query, que aborta a requisição obsoleta quando a chave muda.
- **Retry:** queries repetem até 2 vezes, com backoff (500 ms, 1 s, 2 s, no máximo 4 s), só para falhas transitórias (rede, timeout, 502, 503, 504). Erros 4xx e de contrato não são repetidos. Mutations não repetem sozinhas; o pedido é reenviado de forma explícita com a mesma chave de idempotência.
- **`staleTime`** de 30 s e `gcTime` de 5 min. Sem refetch ao focar a janela; o tempo real chega por Socket.IO.

## Sessão

- O token fica no localStorage (`kurio:token`) para a sessão sobreviver a refresh, conforme o requisito. É opaco, expira no servidor (2 h, ou 15 s no cenário `session-expired`) e não carrega dados.
- O interceptor do Axios envia o Bearer quando há token, e o `X-Guest-Cart-Id` quando não há. Um 401 numa requisição que levou token notifica os assinantes de `onUnauthorized`. A camada de auth (Bloco 2) usa isso para limpar o cache e redirecionar ao login com o destino preservado.
- Trocar a senha encerra as outras sessões do usuário; a atual continua válida.

## Estado na URL (catálogo)

- `/` aceita `q`, `categories=a,b`, `networks=a,b`, `minPrice`, `maxPrice`, `tab`, `sort` e `page`. O `validateSearch` passa tudo pelo zod com `.catch()`: um link antigo ou editado à mão abre o catálogo com os padrões, em vez de quebrar. Os padrões (`tab=all`, `sort=recent`, `page=1`) são removidos da URL por `stripSearchParams`.
- O router serializa a busca como query string simples (sem JSON e com vírgula literal), porque a URL é parte da interface.
- Qualquer mudança de filtro, aba, ordenação ou busca volta para a página 1. A digitação na busca usa `replace` (não polui o histórico); filtros e páginas criam entradas novas, então voltar e avançar refazem o caminho.
- Os parâmetros da URL são exatamente os da API e a chave do cache. As listas são ordenadas antes de entrar na chave, então `musica,fotografia` e `fotografia,musica` compartilham o cache.

## Sessão na interface

- A rota raiz chama `ensureQueryData(session)` antes da primeira tela, e o refresh recupera o usuário.
- Rotas privadas usam `requireSession` no `beforeLoad`, que redireciona para `/login?redirect=<destino>`. O `redirect` só aceita caminhos internos, para evitar open redirect.
- Um 401 numa requisição autenticada chama `clearSession`: executa os cleanups registrados (o socket entra no Bloco 4), remove `["user"]` do cache, apaga o token e leva ao login com `reason=expired` e o destino preservado. Várias falhas simultâneas geram um único redirecionamento.
- No login ou cadastro, o carrinho de visitante é mesclado (`/cart/merge`) e o cache de visitante é descartado. A troca de usuário sem logout também limpa o cache do anterior (`applySession`).
- **Favoritos:** atualização otimista com snapshot e rollback em `onError`, e `setQueryData` com a resposta da API no sucesso.

### Bloco 2: início, detalhe e login

- **Login e cadastro como modal sobre o mercado no desktop**, como no Figma. Ao fundo fica o Início, inerte (`aria-hidden` e foco preso no dialog). No mobile são tela cheia. Fechar (X ou Esc) volta ao `redirect`.
- **Detalhe com loader:** `ensureQueryData` no loader garante acesso direto e refresh. Um 404 da API vira `notFound()` com página própria, e outros erros mostram a página de erro com nova tentativa. O `pendingComponent` é o mesmo esqueleto da tela.
- **Respostas fora de ordem:** cada combinação de parâmetros tem sua chave, a requisição anterior é abortada pelo `signal` e `placeholderData` mantém a página anterior visível (com `aria-busy`) até a nova chegar.
- **Skeletons** com as mesmas dimensões dos cards (`aspect-ratio`), sem deslocamento de layout. Com `prefers-reduced-motion`, o shimmer para.
- **Inputs de filtro e edição** são checkbox e radio nativos invisíveis cobrindo a linha ou pílula inteira: teclado, leitor de tela e clique funcionam sem ARIA extra, e o estado ativo tem marcador visual além da cor.
- **Imagens:** as 4 artes do Figma, convertidas para WebP em 512 e 1024 px (`scripts/optimize-images.mjs`), com `srcset`, dimensões explícitas e `fetchpriority=high` só na primeira dobra.

## Carrinho e checkout

- **Estado do carrinho:** fica no servidor simulado (de visitante ou do usuário) e o cache guarda a resposta inteira. Toda mutation (adicionar, quantidade, remover, cupom) responde com o carrinho recalculado e é gravada com `setQueryData`; não há totais calculados no cliente.
- **Fila de mutations:** as mutations do carrinho compartilham `scope: { id: "cart" }`, então o Query as executa em série, na ordem dos cliques. O `+`/`−` tem debounce de 350 ms por linha: cliques seguidos viram uma requisição com o valor final.
- **Avisos por item:** vêm do `status` de cada item na API (`price_changed`, `quantity_exceeds`, `sold_out`) e têm ação explícita (aceitar o novo preço, ajustar a quantidade ou remover). Enquanto houver aviso, o checkout fica bloqueado.
- **Pagamento em etapas, num único "Confirmar compra":**
  1. grava a carteira só se o formulário diferir do cadastro;
  2. conecta a carteira (a recusa aparece inline, com nova tentativa);
  3. cria a cotação;
  4. abre a revisão com prazo de validade.
- **Revalidação no envio:** `409 quote_outdated` ou `quote_expired` trocam a cotação na revisão pela cotação nova, listam as mudanças e exigem um novo clique ("Confirmar novos valores"). Uma edição esgotada (`insufficient_availability`) leva de volta ao carrinho.
- **Idempotência:** a chave é gerada por intenção (cotação + carteira) e guardada em `localStorage`. Clique repetido, reenvio automático (até 3, só em timeout ou erro de rede) e refresh usam a mesma chave, e o servidor devolve o mesmo pedido. Uma cotação nova é uma nova intenção e recebe chave nova.
- **Retomada do pedido:** o pedido criado e ainda pendente fica registrado por usuário. Carrinho e pagamento mostram "Você tem um pedido em processamento", e `/pedidos/$id` faz polling a cada 1,5 s até um estado terminal; no Bloco 4 o socket adianta isso e o polling fica como reserva. No estado terminal, o registro é limpo e o carrinho é recarregado (a API já removeu só o que foi comprado ou devolveu o estoque).
- **Rascunho do pagamento:** fica no `localStorage` por usuário. Uma sessão que expira no meio leva ao login com `redirect=/pagamento`, e o formulário volta preenchido.
- **Recibo:** mostra só o snapshot do pedido. "Confirmado" aparece apenas quando a API devolve `status: "confirmed"`. Um pedido de outra conta mostra "Pedido não encontrado" (403 da API).

## Desvios do Figma e ações fora do escopo

| Item | Decisão |
|---|---|
| Galeria do detalhe | O Figma repete a mesma arte nas 4 miniaturas. A API devolve 4 vistas da obra (completa, superior, central e inferior) e a UI aplica o recorte. |
| "Contrato" e "Direitos autorais" | No Figma os textos estão trocados entre os dois títulos. Na implementação, o endereço fica em "Contrato" e o royalty em "Direitos autorais". |
| Preço riscado e selo RARO | O Figma mostra o selo com canto reto sobre o card arredondado e um preço "2.29 ETH" solto. Implementei o preço anterior como campo do contrato (`compareAtPriceEth`), riscado ao lado do preço atual, e o selo para NFTs com atributo Raro ou Lendário. |
| Estado "favoritado" | Não está desenhado. Usei o mesmo botão com fundo `primary/15` e o texto "Favoritado" (mais `aria-pressed`). |
| Estados não desenhados (erro, vazio, esgotado, 404) | Seguem as superfícies e tipografia do Figma. |
| Busca no desktop | O Figma só mostra a lupa. Ela abre um dialog de busca que grava `?q=` no catálogo. |
| Criadores, Aprenda, blog, links do footer, newsletter, login social, "Esqueceu a senha?", leitor de QR e lista de favoritos na barra mobile | Fora do escopo: exibem um aviso de "não disponível nesta demonstração", sem simular sucesso. Redes sociais e compartilhamento abrem os sites reais. |
| Pagamento: campos obrigatórios | O Figma marca "Código de indicação" e "Nome ENS (.eth)" como obrigatórios. Na implementação, a indicação é opcional, e o nome ENS virou o campo opcional "ENS ou carteira secundária", porque nenhum dos dois é necessário para pagar. |
| Pagamento: "Tipo de carteira" e "Carteira e rede" | O Figma mostra o mesmo dado em dois controles (select e lista de provedores). Os dois ficam ligados ao mesmo campo do formulário. |
| Pagamento: quantos passos | O Figma tem um único "Confirmar compra". A implementação acrescenta um dialog de revisão com a cotação, exigido pelo desafio ("permitir revisão antes do envio"). |
| Confirmação | No Figma é um modal sobre o pagamento. A implementação é uma página própria (`/pedidos/$id`), com o mesmo cartão, porque precisa abrir por link direto e sobreviver a refresh. O ícone "thank-you" foi substituído pelo `CheckCircle2` do lucide: o limite de chamadas do MCP do Figma (plano Starter) acabou antes da exportação. Pendente e recusado não estão desenhados e seguem o mesmo cartão. |
| Mobile do carrinho e do pagamento | Implementados a partir da estrutura salva no cache de metadados do Figma (nomes, textos e medidas), sem o código gerado, pelo mesmo limite. A marca da Coinbase usa a letra "C", como WalletConnect e MetaMask. |
| Footer no mobile | Os frames mobile não têm footer (a barra inferior ocupa o rodapé), então ele só aparece a partir do tablet. |

## Decisões

### Bloco 1: contratos e MSW

- **Carrinho de visitante no servidor simulado**, identificado por id, em vez de só no localStorage. Assim os totais e a disponibilidade vêm sempre da API, e a mesclagem no login é uma operação do servidor (`/cart/merge`), não uma lógica de cliente.
- **Cupom gravado no carrinho:** o resumo exibido é sempre o calculado pela API. Um cupom que expira depois de aplicado deixa de valer no cálculo.
- **Taxa de rede fixa de 0,016 ETH por pedido**, o valor do Figma.
- **Limite por pedido:** o menor entre o disponível e 10 (edições limitadas) ou 20 (edição aberta).
- **Conexão de carteira presa à sessão:** o pedido exige uma `connectionId` ativa da mesma sessão e uma rede igual à da carteira.
- **Endpoints `/api/__dev/*`:** controlam a simulação (reset, cenário, expirar sessão, alterar uma edição). Não sofrem latência nem falhas e ficam disponíveis na demo para reproduzir os fluxos.

### Bloco 0: setup

- **MSW 2 em vez de 3.** O `@mswjs/socket.io-binding@0.2` declara `msw@^2.10` como dependência par. Forçar a v3 com `--legacy-peer-deps` arriscaria o requisito de Socket.IO, que é eliminatório.
- **Mocks atrás de `VITE_ENABLE_MOCKS`.** O `main.tsx` importa `src/mocks/browser` de forma dinâmica e só renderiza depois de `worker.start()`. Assim a primeira requisição já é interceptada e, sem a flag, o MSW não entra no bundle principal. O `.env` versionado deixa a flag em `true`, porque o deploy de demonstração depende dos mocks.
- **Variáveis de ambiente validadas com zod** em `src/lib/env.ts`. Uma configuração inválida falha no boot, não em tempo de uso.
- **Tokens com o mesmo nome das variáveis do Figma** (`color/primary` vira `--color-primary`). Aliases semânticos do shadcn (`background`, `muted-foreground`, `ring`...) apontam para esses tokens em `@theme inline`. A escala tipográfica do Figma vira `text-9` até `text-43`, registrada também no `tailwind-merge` para o `cn()` não confundir tamanho com cor.
- **Fonte auto-hospedada** (`@fontsource/roboto-mono`, só o subset latino). Funciona offline e evita dependência de CDN no Lighthouse.
- **Padrões iniciais do Query:** `staleTime` de 30s, uma retentativa em queries, nenhuma em mutations (pedidos dependem de idempotência explícita) e sem refetch ao focar a janela. A política completa entra no Bloco 1.
- **E2E contra o build de produção** (`vite build` mais `vite preview`), o mesmo artefato publicado, em Chromium desktop (1440) e mobile (390).
- **SPA na Vercel:** `vercel.json` reescreve todas as rotas para `index.html`. Arquivos estáticos (`/assets`, `mockServiceWorker.js`) têm precedência. O worker é servido com `no-cache` para atualizar a cada deploy.
