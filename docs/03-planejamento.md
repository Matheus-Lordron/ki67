# 03 · Planejamento

> **Documento vivo.** Versão 0.3, de 07/10/2026. Cronograma, organização do repositório e regras de trabalho do grupo. Quando uma data ou uma regra mudar, este arquivo muda no mesmo pull request.

**Neste documento:** [1. Marcos](#1-marcos-e-entregas) · [2. Cronograma](#2-cronograma) · [3. Backlog por sprint](#3-backlog-do-mvp-por-sprint) · [4. Branches](#4-estratégia-de-branches) · [5. Commits](#5-convenção-de-commits) · [6. Definition of Done](#6-definition-of-done) · [7. Riscos](#7-riscos) · [8. Licença](#8-licença)

---

## 1. Marcos e entregas

| Marco | Data prevista | O que é entregue | Tag |
| --- | --- | --- | --- |
| **Etapa 1 · Documentação** | 07/10/2026 | README, LICENSE, `.env.example` e os três documentos de `docs/`, já com o retorno do professor | `v0.1.0` |
| Sprint 0 · Fundação | 14/10/2026 | Monorepo que roda do zero nas três plataformas, Supabase configurado, bucket no R2 criado e desempenho do canvas medido | — |
| Sprint 1 · Acesso | 24/10/2026 | Login com 2FA, recuperação de senha, usuários, papéis, projetos e gestores | `v0.2.0` |
| Sprint 2 · Imagens | 05/11/2026 | Lotes com N avaliadores, upload com hash, atribuição, abas e painel do gestor | `v0.3.0` |
| Sprint 3 · Anotação | 19/11/2026 | Pontos, caixas e polígonos, com autosave, versões e histórico | `v0.4.0` |
| Sprint 4 · Análise e confiança | 29/11/2026 | Índice na tela, pré-anotação, comparação com concordância, bateria de cegamento, auditoria e exportação | `v0.5.0` |
| **Laboratório de Avaliação do App** | 04/12/2026 *(a confirmar)* | MVP avaliado pelos outros grupos | `v1.0.0` |

As datas depois da Etapa 1 são estimativas. Quando o professor publicar a data do Laboratório de Avaliação, só o marco final muda: as tarefas do cronograma dependem umas das outras (`after`) e se reorganizam sozinhas.

## 2. Cronograma

O MVP ficou maior com o retorno do professor (pré-anotação, caixas e polígonos, índice e comparação). Para caber no prazo, duas frentes andam **em paralelo** à sequência principal, cada uma com integrantes próprios.

```mermaid
gantt
    title Ki67 · cronograma do MVP
    dateFormat YYYY-MM-DD
    axisFormat %d/%m

    section Etapa 1 · Documentação
    Levantamento de requisitos                :done, req, 2026-09-09, 2026-09-23
    Documentação inicial e ajustes            :active, doc, after req, 14d
    Entrega da documentação                   :milestone, m1, after doc, 0d

    section Sprint 0 · Fundação
    Monorepo, Supabase, R2, CI e app vazio    :s0, after doc, 5d
    Prova de conceito do canvas Skia          :crit, poc, after doc, 7d

    section Sequência principal
    Sprint 1 · Acesso, usuários e projetos    :s1, after s0, 12d
    Sprint 2 · Imagens, lotes e atribuição    :s2, after s1, 12d
    Sprint 3 · Pontos, caixas e polígonos     :crit, s3, after s2 poc, 14d
    Sprint 4 · Cegamento, log, índice e saída :s4, after s3, 10d

    section Frentes em paralelo
    Pré-marcação por limiar de cor            :pre, after poc, 21d
    Pré-anotação integrada ao canvas          :prei, after s3 pre, 5d
    Comparação e concordância                 :cmp, after s3, 10d

    section Entrega do App
    Teste em outra máquina e ajustes          :tst, after s4 cmp prei, 5d
    Laboratório de Avaliação do App           :milestone, lab, after tst, 0d
```

As barras vermelhas formam o caminho crítico: a anotação (Sprint 3) só começa quando a prova de conceito do canvas confirmar que o Skia aguenta 2.000 marcações a 30 fps num celular intermediário (RNF-03). Se não aguentar, a [decisão D2](02-arquitetura.md#12-decisões-de-arquitetura) é revista antes de escrever a tela de anotação. O algoritmo de pré-marcação é desenvolvido sobre imagens de exemplo desde a Sprint 0 e só é ligado ao canvas depois da Sprint 3.

A fase 2 ([escopo](01-visao-e-requisitos.md#4-escopo-por-fase)) não tem data: entra depois do Laboratório de Avaliação, se o projeto continuar.

## 3. Backlog do MVP por sprint

| Sprint | Objetivo | Requisitos | Pronto quando |
| --- | --- | --- | --- |
| 0 · Fundação | Um esqueleto que roda do zero nas três plataformas | RNF-01, RNF-03 (prova de conceito), RNF-13 | `npm run dev:app` abre na web, no Android e no iOS; a API responde em `/api/v1/saude` conectada ao Supabase local; o projeto Supabase (região São Paulo, Data API desativada) e o bucket privado no R2 existem; o CI está verde; o canvas com 2.000 marcações foi medido |
| 1 · Acesso, usuários e projetos | Entrar com segurança e organizar quem faz o quê | RF-01 a RF-07, RF-09 (projetos e gestor); RF-37 para os eventos de login | Login, 2FA e recuperação de senha passam nos critérios; o admin cria usuários, papéis e projetos e designa o gestor |
| 2 · Imagens e atribuição | O gestor distribui o trabalho | RF-08, RF-10, RF-11, RF-22, RF-24, RF-25, RF-29 | Lote com N avaliadores, upload em lote com hash, atribuição respeitando N e RN-07, abas e painel com dados reais |
| 3 · Anotação | O núcleo do produto | RF-12 a RF-16, RF-20, RF-21, RF-33, RF-34 | Anotar com pontos, caixas e polígonos, salvar, finalizar e restaurar versões na web e no celular |
| 4 · Cegamento, log, índice e saída | Provar o cegamento, fechar a auditoria e exportar | RF-19, RF-26 a RF-28 (bateria e2e), RF-37 a RF-40 | Índice na tela, bateria de cegamento no CI, log consultável e exportação que abre no Labelme |
| Frente paralela · Pré-anotação | Sugestões automáticas para o avaliador revisar | RF-17, RF-18 | A imagem abre pré-anotada, o botão pré-marca os azul-claros e a origem de cada marcação fica registrada |
| Frente paralela · Comparação | Fechar o ciclo dos N avaliadores | RF-30 a RF-32 | O validador compara as N análises anônimas, vê as métricas de concordância e registra o resultado |
| Entrega | O app roda fora da máquina do grupo | Todos do MVP | Outro grupo roda o app só com o README; capturas reais no README; tag `v1.0.0` |

O cegamento (RF-26 a RF-28) vale desde a Sprint 2, porque toda consulta de análise já nasce filtrada pelo dono; a Sprint 4 fecha a bateria de testes que prova isso.

O trabalho é acompanhado num quadro do GitHub Projects (Backlog → Em andamento → Em revisão → Pronto). Cada card é uma issue com o RF no título e um responsável, e o pull request que a resolve fecha a issue com `Closes #<número>`.

## 4. Estratégia de branches

Cada integrante tem a **própria branch** e entrega o trabalho por **pull request direto na `main`**. Não há branch `develop`: a `main` integra e guarda o que foi entregue, e só recebe código revisado.

```mermaid
gitGraph
    commit id: "Initial commit"
    commit id: "docs: estrutura inicial" tag: "v0.1.0"
    branch Matheus
    commit id: "chore: monorepo e CI"
    checkout main
    branch Fernando
    commit id: "feat: login com senha"
    checkout main
    branch Kiria
    commit id: "feat: canvas de pontos"
    checkout main
    merge Matheus
    checkout Fernando
    merge main
    commit id: "feat: código 2FA"
    checkout main
    merge Fernando
    checkout Kiria
    merge main
    checkout main
    merge Kiria tag: "v0.2.0"
    branch Henrique
    commit id: "feat: pré-anotação"
    checkout main
    branch Ishida
    commit id: "feat: comparação"
    checkout main
    merge Henrique
    checkout Ishida
    merge main
    checkout main
    merge Ishida tag: "v1.0.0"
```

No diagrama, cada linha que chega à `main` é um pull request aceito, e cada linha que sai da `main` para uma branch pessoal é o `git pull origin main` feito antes de entregar.

| Branch | Para quê | Regras |
| --- | --- | --- |
| `main` | Integração e o que pode ser avaliado | Protegida: sem push direto. Só recebe pull request com 1 aprovação e CI verde. Cada entrega recebe uma tag |
| `Matheus`, `Fernando`, `Kiria`, `Henrique`, `Ishida` | Branch de trabalho de cada integrante | Atualizada com a `main` antes de começar cada tarefa e antes de abrir o pull request. A branch não é apagada depois do merge: o integrante continua nela na tarefa seguinte |

**O ciclo de cada tarefa**, na própria branch:

```bash
git switch Kiria
git pull origin main          # traz o que os outros já entregaram
# ... trabalho, com commits pequenos no padrão da seção 5 ...
git pull origin main          # de novo, logo antes de entregar, para resolver conflitos na sua branch
git push origin Kiria         # depois, abra no GitHub o pull request Kiria → main
```

As branches `Henrique` e `Ishida` já existem no GitHub. As de Matheus, Fernando e Kiria são criadas uma vez, a partir da `main` atualizada, com `git switch -c <Nome>` e `git push -u origin <Nome>`.

**Pull request:**

- uma tarefa (ou um RF) por pull request, para a revisão ser rápida;
- título no padrão de commit da [seção 5](#5-convenção-de-commits) e descrição citando os requisitos (por exemplo, "Implementa RF-02") e a issue (`Closes #12`);
- pelo menos **1 aprovação** de outro integrante;
- CI verde: lint, checagem de tipos, testes e build web;
- documentação atualizada no mesmo PR quando o comportamento muda;
- merge com *merge commit*, para o histórico mostrar de onde veio cada entrega, como no diagrama.

## 5. Convenção de commits

Seguimos [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/): o histórico fica legível sem abrir o diff.

```text
<tipo>(<escopo opcional>): <descrição curta, em minúsculas e sem ponto final>
```

| Tipo | Quando usar | Exemplo no Ki67 |
| --- | --- | --- |
| `feat` | Nova funcionalidade | `feat(anotacao): ferramenta de polígono (RF-14)` |
| `fix` | Correção de bug | `fix(auth): código 2FA expirado era aceito` |
| `docs` | Só documentação | `docs: critério de aceitação do RF-07` |
| `refactor` | Muda o código sem mudar o comportamento | `refactor(api): extrai o serviço de versionamento` |
| `test` | Cria ou corrige testes | `test(cegamento): avaliador não acessa análise alheia` |
| `chore` | Build, dependências e configuração | `chore: atualiza dependências do Expo SDK 57` |
| `ci` | Pipeline de integração contínua | `ci: roda lint e testes no pull request` |

- O **escopo** é a área afetada: `auth`, `usuarios`, `projetos`, `imagens`, `preanotacao`, `anotacao`, `cegamento`, `validacao`, `auditoria`, `exportacao`, `app`, `api`, `shared`.
- Cite o requisito entre parênteses quando o commit o implementa ou altera.
- Mudança que quebra compatibilidade leva `!` depois do tipo: `feat(api)!: rota de versões passa a exigir versão base`.
- Mudança de comportamento leva o documento junto, no mesmo commit ou no mesmo PR.

## 6. Definition of Done

Uma tarefa só fecha quando **todos** os itens batem. Código alterado com documento intacto é mudança incompleta, e não tarefa pronta.

- [ ] Código escrito e revisado por outro integrante (pull request aprovado)
- [ ] Testes passando no CI, incluindo os novos para o que mudou
- [ ] Critério de aceitação do requisito atendido ([01 · Visão e requisitos](01-visao-e-requisitos.md#5-requisitos-funcionais))
- [ ] Documentação atualizada no mesmo PR: requisito, arquitetura ou README
- [ ] Testado na web e em pelo menos uma plataforma móvel (RNF-02)
- [ ] O projeto continua rodando do zero em outra máquina seguindo só o README

## 7. Riscos

| Risco | Impacto | Como reduzimos |
| --- | --- | --- |
| MVP maior depois do retorno do professor (pré-anotação, caixas e polígonos, índice e comparação) | Alto | Duas frentes em paralelo no cronograma; pré-anotação simples, por limiar de cor; índice e concordância escritos uma vez no pacote `shared` |
| Canvas lento com milhares de marcações na web ou em celulares intermediários | Alto | Prova de conceito na Sprint 0, antes de escrever a tela de anotação; Skia com desenho em lote e só da área visível |
| Branches pessoais longas divergirem da `main` e gerarem conflitos grandes | Médio | Atualizar a branch com a `main` antes de cada tarefa e de cada PR; pull requests pequenos e frequentes |
| Perguntas em aberto (Q1 a Q10) mudarem o escopo | Médio | Premissas registradas em [01 · Visão e requisitos](01-visao-e-requisitos.md#11-perguntas-em-aberto) e escolhidas para serem baratas de mudar; revisão com o cliente na Sprint 1 |
| As imagens reais serem lâminas inteiras (WSI) | Alto | MVP limitado a campos capturados; WSI com tiles só depois do MVP |
| Dados sensíveis de pacientes (LGPD e CEP), inclusive a região do bucket no R2 | Alto | Só imagens anonimizadas; nenhuma imagem real no repositório; desenvolvimento com imagens sintéticas ou de bases públicas; região do R2 conferida antes de usar imagens reais |
| Limites dos planos gratuitos do Supabase e do R2 (projeto pausado depois de dias sem uso, cotas e backup) | Médio | Desenvolvimento no Supabase local e no disco; `pg_dump` agendado no CI; revisar os planos antes de usar imagens reais do estudo |
| Integrante indisponível | Médio | Pull requests pequenos, revisão cruzada e documentação viva, para ninguém ser o único que sabe uma parte |

## 8. Licença

**MIT**, porque é curta, permissiva e deixa a instituição e outros grupos de pesquisa reutilizarem e adaptarem o código exigindo apenas que o aviso de copyright seja mantido. A Apache 2.0 seria a alternativa se houvesse preocupação com patentes, e a GPL foi descartada porque obrigaria quem integrasse o código a sistemas da instituição a abrir esses sistemas sob a mesma licença. A licença cobre só o código: imagens e anotações são dados de pesquisa, ficam fora do repositório e seguem o protocolo do estudo.

---

| Versão | Data | Mudança |
| --- | --- | --- |
| 0.1 | 07/10/2026 | Cronograma, backlog por sprint, branches, commits, Definition of Done, riscos e licença. |
| 0.2 | 07/10/2026 | Sprint 0 passa a configurar o Supabase; novo risco sobre o plano gratuito. |
| 0.3 | 07/10/2026 | Retorno do professor: branch por integrante com pull request direto na `main` (sem `develop`), MVP maior com frentes em paralelo no cronograma e riscos revistos. |
