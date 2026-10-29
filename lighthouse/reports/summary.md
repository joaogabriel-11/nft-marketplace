# Lighthouse: resumo

Gerado por `npm run lighthouse` em 2026-10-29.

- Alvo: build de produção servido por `vite preview` (localhost:4173), com `VITE_ENABLE_MOCKS=true` (MSW ativo, como no deploy)
- Lighthouse 13.6.0, Chrome 156.0.0.0 headless, Node v24.12.0, Windows_NT 10.0.26300 (13th Gen Intel(R) Core(TM) i5-13420H)
- Perfis: mobile (padrão do Lighthouse: Moto G Power, 4G lento simulado, CPU 4x) e desktop (`desktop-config`)
- 3 execuções por tela e perfil, cada uma em um Chrome novo (sem cache nem localStorage). A linha mostra a execução mediana pela nota de performance, e os relatórios `<tela>-<perfil>.html/.json` desta pasta são dessa execução.

| Tela | Perfil | Performance | Acessibilidade | Boas práticas | SEO | FCP (ms) | LCP (ms) | CLS | TBT (ms) | Performance por execução |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Início | mobile | 86 | 100 | 100 | 100 | 773 | 4164 | 0 | 105 | 86 / 85 / 86 |
| Início | desktop | 99 | 100 | 100 | 100 | 221 | 878 | 0.001 | 0 | 99 / 99 / 99 |
| Detalhe | mobile | 87 | 100 | 100 | 100 | 764 | 4017 | 0 | 46 | 87 / 86 / 87 |
| Detalhe | desktop | 99 | 100 | 100 | 100 | 216 | 849 | 0 | 0 | 99 / 99 / 99 |
