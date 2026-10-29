# Lighthouse: resumo

Gerado por `npm run lighthouse` em 2026-10-29.

- Alvo: build de produção servido por `vite preview` (localhost:4173), com `VITE_ENABLE_MOCKS=true` (MSW ativo, como no deploy)
- Lighthouse 13.6.0, Chrome 156.0.0.0 headless, Node v24.12.0, Windows_NT 10.0.26300 (13th Gen Intel(R) Core(TM) i5-13420H)
- Perfis: mobile (padrão do Lighthouse: Moto G Power, 4G lento simulado, CPU 4x) e desktop (`desktop-config`)
- 3 execuções por tela e perfil, cada uma em um Chrome novo (sem cache nem localStorage). A linha mostra a execução mediana pela nota de performance, e os relatórios `<tela>-<perfil>.html/.json` desta pasta são dessa execução.

| Tela | Perfil | Performance | Acessibilidade | Boas práticas | SEO | FCP (ms) | LCP (ms) | CLS | TBT (ms) | Performance por execução |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Início | mobile | 86 | 100 | 100 | 100 | 762 | 4138 | 0 | 71 | 86 / 86 / 86 |
| Início | desktop | 99 | 100 | 100 | 100 | 213 | 840 | 0.001 | 0 | 99 / 99 / 99 |
| Detalhe | mobile | 87 | 100 | 100 | 100 | 763 | 3991 | 0 | 34 | 87 / 87 / 86 |
| Detalhe | desktop | 99 | 100 | 100 | 100 | 212 | 840 | 0 | 0 | 99 / 99 / 99 |
