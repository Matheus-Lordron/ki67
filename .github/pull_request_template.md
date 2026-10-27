## O que muda

<!-- Uma ou duas frases: o problema e a solução. -->

**Tarefa e requisitos:** <!-- ex.: R-05, RF-14, RN-07 -->
Closes #<!-- número da issue -->

## Como testar

<!-- Comandos e passos para o revisor conferir. Diga quais testes são novos. -->

## Checklist (Definition of Done: docs/03, seção 6, e docs/06, seção 3)

- [ ] Commit de teste que falhava antes da correção (`test(...)`)
- [ ] CI verde (lint, tipos, testes, build, segredos, dependências e commits)
- [ ] Nenhum segredo no diff e nenhum dado real de paciente
- [ ] Documentação atualizada no mesmo PR (requisito, arquitetura, README ou plano)
- [ ] Mudança de tela: captura antes e depois, na web e na largura de celular
- [ ] Mudança de banco: patch para quem já tem o banco e teste pgTAP
- [ ] Nada aplicado no Supabase ou no Cloudflare reais sem autorização registrada

## Observações para o revisor

<!-- Riscos, decisões tomadas, o que ficou de fora. Apague se não houver. -->
