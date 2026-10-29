# Arquitetura

Decisões técnicas do projeto, registradas bloco a bloco durante o desenvolvimento.

## Stack e organização

| Camada | Escolha | Onde |
|---|---|---|
| Build | Vite 8 + React 19 + TypeScript 5.9 (`strict`) | `vite.config.ts` |
| Rotas | TanStack Router, rotas por arquivo com code splitting automático | `src/routes`, `src/router.tsx` |
| Estado remoto | TanStack Query, com o `QueryClient` injetado no contexto do router | `src/lib/query-client.ts` |
| HTTP | Instância única do Axios | `src/api/client.ts` |
| Mocks | MSW 2 (REST e Socket.IO via `@mswjs/socket.io-binding`) | `src/mocks` |
| Estilo | Tailwind 4 com tokens do Figma em `@theme`, mais shadcn/ui | `src/index.css`, `src/components/ui` |

Domínios ficam em `src/features/{catalog,nft,cart,checkout,auth,account,wallets}` (`account` reúne o layout da área da conta e o perfil).

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

### Rolagem até âncoras

Links com âncora (Mercado e EXPLORAR levam a `/#catalogo`) descem suavemente pelo `defaultHashScrollIntoView` do router, e de forma instantânea com `prefers-reduced-motion`. Não uso `scroll-behavior: smooth` global no CSS porque ele também animaria a volta ao topo em toda troca de página. Quando a URL já é `/#catalogo` e o usuário rolou para cima, o router vê o mesmo endereço, não rola e ainda restaura a rolagem. Um listener de clique em fase de captura (`src/lib/hash-scroll.ts`) trata esse caso: consome o clique e rola até a âncora.

### Leitura da URL

O parser padrão do TanStack Router converte valores numéricos da query string em números (`?minPrice=1.92` vira `1.92`). Como ETH trafega sempre como string decimal, o schema recusava o valor e o descartava sem aviso, e a faixa de preço não filtrava. O mesmo valia para uma busca só de dígitos, como `?q=042`. O `parseSearch` do router (`src/router.tsx`) agora entrega tudo como texto, e cada rota converte o que precisa com zod (`page` usa `z.coerce`).

## Sessão na interface

- A rota raiz chama `ensureQueryData(session)` antes da primeira tela, e o refresh recupera o usuário.
- Rotas privadas usam `requireSession` no `beforeLoad`, que redireciona para `/login?redirect=<destino>`. O `redirect` só aceita caminhos internos, para evitar open redirect.
- Um 401 numa requisição autenticada chama `clearSession`: executa os cleanups registrados (o socket entra no Bloco 4), remove `["user"]` do cache, apaga o token e leva ao login com `reason=expired` e o destino preservado. Várias falhas simultâneas geram um único redirecionamento.
- No login ou cadastro, o carrinho de visitante é mesclado (`/cart/merge`) e o cache de visitante é descartado. A troca de usuário sem logout também limpa o cache do anterior (`applySession`).
- **Favoritos:** atualização otimista com snapshot e rollback em `onError`, e `setQueryData` com a resposta da API no sucesso.

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

## Tempo real (Socket.IO)

### Eventos

| Evento | Quem recebe | Payload |
|---|---|---|
| `nft.updated` | Todas as conexões, inclusive de visitante | Card do NFT + edições (preço, disponibilidade, `maxPerOrder`) |
| `order.updated` | Só as conexões do dono do pedido | Pedido completo (snapshot, status, `txHash`) + `userId` |

Envelope comum: `{ eventId, type, resourceId, version, occurredAt, payload }`, validado com zod no cliente (`src/api/contracts/realtime.ts`). Os eventos são gerados a partir do canal de mudanças do banco simulado (`db.write` → `DbChange`), o mesmo estado que a REST devolve. Por isso REST e eventos nunca divergem.

### Regras no cliente (`src/lib/realtime`)

- **Uma conexão por sessão.** O visitante conecta sem token e recebe só `nft.updated`. Login ou troca de usuário abre uma conexão nova com o novo token. O logout encerra a conexão pelo `onSessionEnd` e remove todos os listeners (`removeAllListeners` no socket e no Manager).
- **Deduplicação:** um `eventId` já visto é descartado (entrega duplicada).
- **Ordem:** guarda a última `version` aplicada por recurso, e evento com versão menor ou igual é descartado. A atualização do cache também compara com a versão do dado em cache, então um evento atrasado não sobrescreve um refetch mais novo.
- **`nft.updated`:**
  - atualiza no lugar o detalhe e os cards de listas e "relacionados";
  - marca as listas como desatualizadas (`refetchType: "none"`), já que filtros de preço ou disponibilidade podem mudar o resultado;
  - recarrega o carrinho pela REST se o NFT estiver nele (totais e avisos são da API) e anuncia a mudança por toast.
- **Checkout:** um `nft.updated` de item da cotação aberta marca a revisão como desatualizada. O botão vira "Atualizar cotação" e só depois de revisar os novos valores é possível confirmar. A API rejeitaria a cotação antiga de qualquer forma (409).
- **`order.updated`:** grava o pedido no cache (se for mais novo) e, no estado terminal, anuncia confirmação ou recusa, limpa o pedido pendente e recarrega o carrinho. Evento com `userId` diferente da sessão atual é descartado (defesa extra; o servidor já filtra).
- **Reconexão:** backoff de 0,5 a 3 s. Ao reconectar, `invalidateQueries({ type: "active" })` refaz pela REST tudo que está na tela, cobrindo eventos perdidos durante a queda. Enquanto desconectado, aparece um toast "Reconectando…" e o pedido pendente volta a ser consultado a cada 1,5 s (com socket conectado, a cada 10 s, só como reserva).
- O estado da conexão fica em `html[data-realtime]` (`connecting`, `connected`, `reconnecting` ou `idle`), para diagnóstico e para os testes.

### Transporte nos mocks e limitações

- O `socket.io-client` real conecta em `ws(s)://<origem>/socket.io/` só com `transports: ["websocket"]`. O MSW intercepta o WebSocket na própria aba; o long-polling do Engine.IO exigiria simular o protocolo HTTP e não é usado.
- O cliente Socket.IO é carregado sob demanda depois do `worker.start()`. O `engine.io-client` captura `globalThis.WebSocket` ao ser importado; se entrasse no bundle principal, guardaria o WebSocket nativo antes de o MSW substituí-lo.
- O `ws.link` aponta para a origem, porque o MSW remove o prefixo `/socket.io/` da URL antes de comparar.
- O `@mswjs/socket.io-binding` codifica e decodifica os eventos, mas tem duas limitações que o servidor simulado completa:
  - ele responde ao CONNECT do Socket.IO automaticamente, sem ler `auth`. Por isso o token vai na query do handshake e é validado antes de montar o binding; token inválido recebe `CONNECT_ERROR` (`44`). Num backend real, o token iria em `auth` e nunca na URL;
  - ele anuncia `pingInterval` mas não envia ping. O mock envia ping a cada 20 s, senão o cliente derrubaria a conexão a cada 30 s.
- O "servidor" vive na aba: não há tempo real entre abas ou dispositivos. Duas abas abertas têm bancos simulados independentes, que só se cruzam pelo `localStorage` no próximo carregamento. Vale o mesmo para a demo publicada.
- Uma queda simulada aceita o transporte e fecha logo em seguida. O Manager do `socket.io-client` só agenda nova tentativa para quedas depois do `open` do Engine.IO; recusar antes disso deixaria o cliente parado até o timeout de 20 s.

## Estratégia de testes

| Camada | Onde | O que garante |
|---|---|---|
| Contrato da API | `e2e/api` | Handlers MSW chamados por `fetch` de dentro da página (pelo service worker): validação, erros por código, isolamento por usuário, idempotência, revalidação, reset. |
| Interface | `e2e/ui` | Fluxos completos pela UI, em desktop e mobile, observando a tela e o resultado das operações (estado da API). |
| Tempo real | `e2e/ui/realtime.spec.ts` | Eventos gerados no servidor simulado e recebidos pelo `socket.io-client` real; sem refresh e sem polling nas queries envolvidas. |
| Relógio | `e2e/ui/clock.spec.ts` | `page.clock` controla a app e a simulação (o MSW roda na página): expiração de cotação, TTL de sessão, liquidação. |
| Acessibilidade | `e2e/ui/a11y.spec.ts` | axe-core (WCAG 2.1 A e AA) em todas as telas e estados finais (revisão e recibo), em desktop e mobile: violação séria ou crítica falha. Sem rolagem horizontal em 320 px. Shimmer ligado normalmente e parado com `prefers-reduced-motion`. |
| Teclado e foco | `e2e/ui/keyboard.spec.ts` | Skip link, filtros, ordenação, paginação e edições pelo teclado; foco preso e devolvido em dialogs e sheets; foco no primeiro campo inválido. |
| Visual | `e2e/visual` | Screenshots de página inteira com dados estáveis; baselines por plataforma, fora do CI. |

Isolamento: cada teste abre um contexto novo (storage e service worker limpos) com `?mock-reset&scenario=instant`. Os helpers ficam em `e2e/support`, e nenhum teste depende de outro.

### Matriz requisito → teste

| Requisito do desafio | Testes |
|---|---|
| Busca, filtros combinados, ordenação, paginação e histórico | `ui/catalog`: filtros combinados…, Mercado desce até o catálogo…, faixa de preço filtra pela API…, carrossel do hero…, abas e busca…, busca com debounce… (mobile) |
| Acesso direto ao detalhe e recurso inexistente | `ui/detail-auth`: acesso direto…, NFT inexistente… |
| Cadastro, login, expiração, logout e troca de usuário | `ui/detail-auth`: login valida…, cadastro…, sessão expirada…, logout e troca…; `ui/clock`: sessão expira pelo tempo… |
| Favoritos com falha e recuperação | `ui/detail-auth`: favorito com falha da API… |
| Carrinho, quantidades, remoção, cupom, persistência após refresh e login | `ui/checkout`: quantidade, remoção, cupom…, do catálogo ao recibo (merge no login); `api/cart-orders` |
| Compra completa até o recibo | `ui/checkout`: do catálogo ao recibo confirmado |
| Pagamento recusado, clique repetido, timeout com o mesmo pedido | `ui/checkout`: pagamento recusado…, clique repetido…, timeout após criar o pedido… |
| Perfil, avatar, senha e carteiras com validação | `ui/account`: edição com conflito…, avatar: envio, persistência, remoção e arquivos recusados, troca de senha…, cadastro de principal e secundária…, acesso sem login e falha 403…, menu da conta…; `api/catalog-auth` (perfil e senha), `api/cart-orders` (carteiras); `ui/checkout`: usuário sem carteira cadastra… |
| Preço e disponibilidade via Socket.IO durante o checkout | `ui/realtime`: checkout: evento durante a revisão…, carrinho aberto… |
| Eventos duplicados ou antigos, desconexão e pedido pendente | `ui/realtime`: eventos duplicados…, eventos perdidos…, queda com pedido pendente… |
| Teclado, foco de dialogs e validação de formulários | `ui/keyboard` (todos); `ui/detail-auth`: dialog de login: Esc… |
| Skeletons em carregamento lento, falha e nova tentativa | `ui/catalog`: skeletons…, falha do servidor…, falha transitória… |
| Regressão visual de início, detalhe, carrinho e pagamento | `visual/screens` (desktop e mobile) |
| Acessibilidade automatizada, reflow e movimento reduzido | `ui/a11y` (todos) |
| Performance (Lighthouse) | `npm run lighthouse`, resultados em `lighthouse/reports/summary.md` (fora do Playwright) |

## Desvios do Figma e ações fora do escopo

| Item | Decisão |
|---|---|
| Galeria do detalhe | O Figma repete a mesma arte nas 4 miniaturas, e cada NFT tem uma única arte. A API devolve as 4 posições com a obra completa e a galeria mostra a arte inteira em todas. A miniatura selecionada tem borda primary de 2 px e as outras ficam esmaecidas, para o estado não depender só da cor. Os botões se chamam "Mostrar imagem N de 4", porque o texto alternativo é o mesmo nas quatro. Antes, as miniaturas 2 a 4 eram recortes ampliados (1,7×) da mesma arte, que ficavam borrados. |
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
| Área da conta: barra lateral | Os ícones dos itens são do lucide (mesmo traço e tamanho), porque os SVGs do Figma não foram exportados antes do fim da cota do MCP. Atividade, Lista de interesse, Ofertas, Downloads e Suporte não têm tela e mostram o aviso de fora do escopo. No mobile e no tablet, a barra vira abas em pílula acima do conteúdo (não há frame mobile dessas telas). |
| Perfil: campos obrigatórios | O Figma põe asterisco em todos os campos. Nome ENS e Apelido da carteira ficaram opcionais, porque a API aceita perfil sem eles. O sufixo `.eth` aparece fixo ao lado do campo, e o usuário digita só o nome. |
| Avatar | O arquivo é recortado ao centro e reduzido para 256×256 em WebP no navegador (canvas) antes do envio: a API aceita até 512 KB, e uma foto de celular passaria disso. A origem aceita PNG, JPG ou WEBP de até 5 MB. |
| Carteiras: "Nome do perfil" | O Figma tem "Nome do perfil" na carteira, mas o contrato não tinha esse dado. Entrou `profileName` (opcional) na carteira, preenchido com o nome de exibição quando vazio. |
| Carteiras: "Igual à carteira principal" | Copia para a secundária rede, nome do perfil, tipo, ENS, indicação, nome de exibição, apelido e e-mail, menos o endereço: a API recusa o mesmo endereço nas duas carteiras (409). |
| Hero do Início (desktop) | O Figma tem um retângulo atrás do hero (`Rectangle 3`). Por ajuste de design, o hero fica sobre o fundo da página, sem painel; o layout e o recuo de 40 px do texto seguem o Figma. |
| Carrossel do hero | O Figma mostra três pontos, sem os outros slides desenhados. Cada ponto é um slide com a arte de um NFT do catálogo (Emerald Ape, Ivory Baron e Golden Beat), com link para o detalhe; título e texto ficam fixos. O ponto atual fica sólido e os outros com 40% de opacidade (o estado ativo não está desenhado). Os slides ficam lado a lado. Clicar, segurar e arrastar em qualquer ponto do hero (mouse, caneta ou dedo) faz a arte acompanhar o ponteiro, com o cursor de mão em toda a área. Ao soltar depois de 60 px, vai para o slide seguinte ou anterior. O arraste só começa depois de 6 px, então um clique simples ainda abre o NFT ou o EXPLORAR. O `dragstart` nativo é bloqueado no hero: sem isso, segurar sobre um link ou imagem iniciaria o arrastar-e-soltar do navegador e cancelaria o arraste. A troca é automática a cada 6 s e para com o ponteiro, o foco ou um arraste no carrossel; com `prefers-reduced-motion` ela não acontece. **Limitação conhecida:** por decisão de design não há botão de pausa. A WCAG 2.2.2 pede um para conteúdo que muda sozinho por mais de 5 s; aqui a pausa existe só pelo hover e pelo foco (inclusive pelo teclado, nos pontos). No toque não há hover: a pausa dura só o arraste, e quem precisa parar a troca depende do `prefers-reduced-motion` do sistema. No mobile, os pontos ficam abaixo do card de 190 px, porque o conteúdo do Figma ocupa o card inteiro. A semântica segue o padrão de carrossel do WAI-ARIA (APG): `aria-roledescription`, slides inativos com `inert` e anúncio da troca só fora da reprodução automática. |
| Header no tablet | Entre 768 e 1023 px, o logo usa só a largura do texto (no desktop são 160 px fixos, como no Figma) e os itens do menu ficam a 20 px um do outro. Em 768 px sobravam 3 px entre "Aprenda" e os ícones. |
| Divisória do header | No Figma é `foreground` com 40% de opacidade. Por ajuste de design, usa a cor `primary` (#D28A4C), a mesma do indicador do item ativo. |
| Footer no mobile | Os frames mobile não têm footer (a barra inferior ocupa o rodapé), então ele só aparece a partir do tablet. |

## Lighthouse

`npm run lighthouse` faz o build, serve o `dist/` com `vite preview` e audita Início e Detalhe nos perfis mobile e desktop, 3 execuções cada, cada uma num Chrome novo. O resumo com versões e ambiente fica em [`lighthouse/reports/summary.md`](./lighthouse/reports/summary.md), ao lado dos relatórios HTML e JSON da execução mediana.

| Tela | Perfil | Performance | Acessibilidade | Boas práticas | SEO | LCP | CLS | TBT |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Início | mobile | 86 | 100 | 100 | 100 | 4,2 s | 0 | 105 ms |
| Início | desktop | 99 | 100 | 100 | 100 | 0,9 s | 0,001 | 0 ms |
| Detalhe | mobile | 87 | 100 | 100 | 100 | 4,0 s | 0 | 46 ms |
| Detalhe | desktop | 99 | 100 | 100 | 100 | 0,8 s | 0 | 0 ms |

As medições locais variam alguns pontos com a carga da máquina. Para comparar versões, meço as duas na mesma sessão: foi assim que apareceu a regressão do carrossel descrita abaixo.

Metas: Performance ≥ 90, Acessibilidade ≥ 95, Boas práticas ≥ 95, SEO ≥ 90.

- **Desktop** passa em tudo. O CLS de 0,18 no Detalhe vinha do skeleton, mais baixo que a página carregada: o rodapé aparecia na tela e era empurrado. O skeleton agora ocupa pelo menos a altura da viewport.
- **Mobile fica em 86 a 87 de Performance**, abaixo da meta. A causa é o LCP de cerca de 4 s no 4G lento simulado: a app só renderiza depois que o MSW inicia, e o chunk do MSW tem cerca de 170 kB comprimidos (perto de 40% do JS da primeira tela, com `tough-cookie` e `tldts`, que o MSW usa para cookies). Esse custo não existiria numa API de verdade. Acessibilidade, Boas práticas e SEO ficam em 100.
- **Regressão do carrossel, corrigida:** medindo na mesma sessão, o carrossel derrubou o Início mobile de 85 para 82, com LCP cerca de 160 ms maior. Dois motivos. As artes dos slides 2 e 3 carregavam junto com a primeira: o `loading="lazy"` não adianta, porque o Chrome carrega de imediato imagens lazy a menos de uns 1.250 px da tela. E a arte de 1024 px do hero desktop, escondida no mobile, era baixada com prioridade alta (55 kB), o que já acontecia antes do carrossel. Agora as artes dos outros slides só entram depois do evento `load`, e só a versão do hero visível na largura atual pede a primeira arte com prioridade; a versão escondida fica `lazy` e, com `display: none`, nem é baixada. Resultado na mesma sessão: 82 → 86 no Início e 84 → 87 no Detalhe.
- **O que mais foi feito:** `modulepreload` do chunk do MSW no HTML, injetado no build por um plugin do `vite.config.ts` só quando `VITE_ENABLE_MOCKS=true`. Ele baixa em paralelo com o bundle principal em vez de esperar o `index.js` executar (cerca de 200 ms a menos no LCP mobile).
- **O que não foi feito, e por quê:** trocar `tough-cookie` por um stub tiraria bytes, mas mexe na parte interna do MSW, que guarda cookies com ele. Renderizar antes do worker exigiria que o Axios esperasse o MSW, ligando a camada de API aos mocks, o que as regras do projeto proíbem. Um shell estático no HTML não ajudaria, porque o LCP é a arte do NFT ou o hero, que dependem dos dados.

## Decisões

### Bloco 6: perfil, carteiras, acessibilidade e Lighthouse

- **Campos de carteira compartilhados** (`src/features/wallets/wallet-schema.ts` e `wallet-fields.tsx`): o pagamento e a tela de Carteiras usam o mesmo schema, os mesmos campos e o mesmo mapa de erros da API. O formulário fica com o `FormProvider` de cada tela.
- **Perfil atualiza a sessão:** salvar o perfil ou o avatar grava a resposta no cache do perfil e no `session.user`, e o header muda sem nova busca. Trocar a senha encerra as outras sessões no servidor simulado; a atual continua.
- **Rótulos com altura fixa** no `FieldShell` (a do asterisco no Figma), para campos com e sem asterisco alinharem na mesma linha do grid.
- **Correções do axe:** o grupo "Taxa de rede" do resumo tinha `dt` e `dd` dentro de um `div` aninhado, com a nota "Taxa estimada" solta no `dl` (agora a nota fica dentro do `dd`). O botão da conta tinha a inicial do avatar como texto visível fora do nome acessível (WCAG 2.5.3); a inicial agora vem de CSS. Os subtítulos da aba de detalhes eram `h3` logo depois do `h1` no mobile e viraram `h2`.
- **Corrida na mesclagem do carrinho (bug encontrado na verificação com checkout limpo):** o login troca a sessão e já dispara o `GET /cart` do usuário, em paralelo ao `POST /cart/merge`. Se o mock respondesse a leitura antes da mesclagem e ela chegasse por último, o cache ficava com o carrinho vazio, e o pagamento mostrava "Seu carrinho está vazio" (cerca de 3 em 20 execuções do teste de compra sob carga). Agora a leitura em andamento é cancelada antes de gravar o resultado da mesclagem: 0 falhas em 50 execuções.
- **Teste de tempo real intermitente só na demo:** "eventos duplicados ou antigos" falhava em cerca de 3 de 20 execuções contra a Vercel. O app estava certo: com os chunks vindo da rede, o socket conectava antes de a tela do detalhe montar, e o evento chegava antes. Ao montar, a edição padrão (a primeira com o preço do card) já era a ABERTA, porque a 1/50 tinha mudado de preço, e a tela mostrava corretamente o preço dela. O teste passou a esperar o detalhe renderizado antes de alterar o preço. Reproduzido localmente atrasando os `/assets/*.js` com `page.route`; depois da correção, 128 de 128 execuções passaram contra a demo.
- **Reflow:** testado em 320 px de largura, o equivalente a 1280 px com zoom de 400%. Cobre também o zoom de 200% pedido pela WCAG 1.4.4.


### Bloco 5: testes e documentação

- **Regressão visual em projetos próprios** (`visual-desktop`, `visual-mobile`), fora do `test:e2e` e do CI. As baselines levam o sufixo de plataforma (`-win32`), porque Windows e Linux renderizam fontes de forma diferente. Os dados são estáveis (reset, `instant`, `page.clock.setFixedTime`), e a captura espera fontes, imagens visíveis carregadas e nenhum toast ou `aria-busy` na tela.
- **Relógio controlado:** como o "servidor" MSW roda na página, `page.clock` controla a expiração de cotação e de sessão e a liquidação do pagamento na app e na simulação ao mesmo tempo. Um bug encontrado assim: a cotação nova devolvida no `409 quote_expired` não era gravada no mock, e confirmar com ela dava 404.
- **CI no GitHub Actions** (Ubuntu): typecheck, lint, build e `test:e2e`, com 1 retry em CI. O relatório HTML é sempre publicado e os traces, quando há falha.
- **Skip link:** chama `focus()` no `main`, porque a âncora sozinha só rola a página e não move o foco do teclado no Chrome.

### Bloco 2: início, detalhe e login

- **Login e cadastro como modal sobre o mercado no desktop**, como no Figma. Ao fundo fica o Início, inerte (`aria-hidden` e foco preso no dialog). No mobile são tela cheia. Fechar (X ou Esc) volta ao `redirect`.
- **Detalhe com loader:** `ensureQueryData` no loader garante acesso direto e refresh. Um 404 da API vira `notFound()` com página própria, e outros erros mostram a página de erro com nova tentativa. O `pendingComponent` é o mesmo esqueleto da tela.
- **Respostas fora de ordem:** cada combinação de parâmetros tem sua chave, a requisição anterior é abortada pelo `signal` e `placeholderData` mantém a página anterior visível (com `aria-busy`) até a nova chegar.
- **Skeletons** com as mesmas dimensões dos cards (`aspect-ratio`), sem deslocamento de layout. Com `prefers-reduced-motion`, o shimmer para.
- **Inputs de filtro e edição** são checkbox e radio nativos invisíveis cobrindo a linha ou pílula inteira: teclado, leitor de tela e clique funcionam sem ARIA extra, e o estado ativo tem marcador visual além da cor.
- **Imagens:** as 4 artes do Figma, convertidas para WebP em 512 e 1024 px (`scripts/optimize-images.mjs`), com `srcset`, dimensões explícitas e `fetchpriority=high` só na primeira dobra.

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
