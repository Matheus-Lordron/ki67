# 08 · Plano da refatoração visual

> **Documento vivo.** Versão 0.1, de 17/11/2026. Roteiro para dar ao Segmenta Studio uma identidade visual nova, **escura, laboratorial e sem "cara de IA"**, usando as skills do Claude Code instaladas em `.claude/skills`. Marque cada item quando ele estiver pronto e atualize este arquivo no mesmo pull request.
>
> O número 07 fica reservado para `docs/07-privacidade-lgpd.md` (R-16).

**Neste documento:** [1. Direção](#1-direção) · [2. Ferramentas](#2-ferramentas) · [3. Antes de começar](#3-antes-de-começar) · [4. Fases](#4-fases) · [5. Telas](#5-checklist-por-tela) · [6. Pronto quando](#6-pronto-quando) · [7. Riscos](#7-riscos)

---

## 1. Direção

| Decisão | Valor |
| --- | --- |
| Tema | **Escuro** (padrão do app). Claro só se sobrar tempo |
| Base | Identidade proposta antes: tinta `#0E1A2B`, índigo `#2B3990`, marrom DAB `#9A5626`, anel de foco `#2F57C9`, IBM Plex Sans e Mono |
| Personalidade | Instrumento de laboratório: preciso, sóbrio, denso de informação, confiável |
| Regra de negócio que afeta as telas | **RN-15:** nesta fase o app não mostra índice Ki-67. As telas mostram a **contagem de cada classe** |

### O que é "cara de IA" e fica de fora

- [ ] Gradientes roxo/rosa/azul, brilho (glow) e fundo com "aurora"
- [ ] Vidro fosco (glassmorphism) e sombras grandes e difusas em tudo
- [ ] Cantos muito arredondados em todos os elementos (`rounded-2xl` como padrão)
- [ ] Ícones de emoji e ilustrações genéricas
- [ ] Títulos enormes e espaço vazio de landing page numa ferramenta de trabalho
- [ ] Cartões iguais repetidos em grade só para preencher a tela
- [ ] Textos de marketing ("Potencialize sua análise ✨") no lugar de rótulos objetivos

### O que entra no lugar

- [ ] Superfícies planas em camadas de cinza azulado, separadas por borda fina de 1 px
- [ ] Cor com função: estado (pendente, em análise, finalizada, validada), classe de marcação e foco. Nada de cor decorativa
- [ ] Tipografia com hierarquia clara; números em fonte mono com algarismos tabulares
- [ ] Densidade de ferramenta profissional: tabelas compactas, rótulos curtos, atalhos de teclado visíveis
- [ ] **Imagem em primeiro lugar:** em volta da lâmina, um cinza neutro, sem tom azul ou marrom, para não alterar a percepção do DAB (marrom) e da hematoxilina (azul)

## 2. Ferramentas

| Skill | Para que serve aqui | Como chamar |
| --- | --- | --- |
| **impeccable** | Contexto do produto, crítica, auditoria e ajustes finos. Os hooks conferem cada tela editada | `/impeccable init`, `document`, `shape`, `critique`, `audit`, `extract`, `typeset`, `colorize`, `layout`, `clarify`, `adapt`, `harden`, `quieter`, `distill`, `polish` |
| **ui-ux-pro-max** | Gera e guarda o design system, com regras de acessibilidade e de React Native | `python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<consulta>" --design-system --persist -p "Segmenta Studio" --output-dir .` e buscas com `--stack react-native` |
| **playwright-cli** | Abre o app web, navega pelas telas e tira as capturas de antes e depois (web e celular) | `playwright-cli open http://localhost:8081`, `snapshot`, `screenshot` |

**No Windows:** se `python3` abrir a Microsoft Store, use o Python do Anaconda (`%USERPROFILE%\anaconda3\python.exe`).

Pré-requisitos: sessão do Claude Code aberta na pasta `ki67`, `npm install -g @playwright/cli@latest` e os hooks da Impeccable ativos (`npx impeccable install`, só na sua máquina).

## 3. Antes de começar

- [x] `/impeccable init` concluído, com o `PRODUCT.md` revisado (usuários, tom, princípios)
- [ ] Combinar com o Fernando a **janela da R-07**, que move `apps/mobile` para `frontend/`. Não abrir PR grande de tela perto dela
- [ ] Combinar a ordem com as tarefas de tela da frente B (R-24, R-25, R-27 a R-30), para não editar a mesma tela ao mesmo tempo
- [ ] Pedir um ID para a tarefa (sugestão: **R-31 · refatoração visual**), para citar nos commits e passar no commitlint
- [ ] Criar a branch de trabalho a partir da `main` atualizada

## 4. Fases

### Fase 1 · Diagnóstico (sem mexer em código)

- [ ] **Capturas de antes** com o playwright-cli: todas as telas da [seção 5](#5-checklist-por-tela), em 1440 px e em 375 px. Guardar em `docs/capturas/antes/` *(login feito em 17/11/2026)*
- [x] `/impeccable document`: gerar o `DESIGN.md` do visual **atual** (cores, fontes, espaçamentos, componentes)
- [ ] `/impeccable critique` nas 4 telas mais usadas: login, fila do avaliador, anotação e comparação *(login feito: 24/40. P1: nome do produto ausente; placeholder de senha que parece preenchido. P2: excesso de selos e legenda de corantes, texto "Workspace Clínico", botões de demonstração com 32 px)*
- [ ] `/impeccable audit` no app todo (acessibilidade, contraste, tema, responsividade)
- [ ] Juntar os problemas numa lista única, ordenada por gravidade

### Fase 2 · Direção visual (proposta para aprovar)

- [ ] ui-ux-pro-max com a consulta `"scientific laboratory image annotation tool dark professional"`, opções `--design-system --density 8 --variance 3 --motion 2`
- [ ] Ajustar o resultado à base (tinta, índigo, DAB, IBM Plex) e salvar com `--persist`, que gera `design-system/segmenta-studio/MASTER.md`
- [ ] `/impeccable shape` para planejar login, fila, anotação e comparação antes do código
- [ ] Montar **2 ou 3 direções** (mesmas telas, variações de cor, tipo e densidade) e escolher uma com o grupo
- [ ] Atualizar o `DESIGN.md` com a direção escolhida. Daqui em diante, ele é a referência

### Fase 3 · Fundação (tokens e componentes)

Arquivos: `apps/mobile/src/theme/colors.ts`, `apps/mobile/src/theme/fonts.ts`, `apps/mobile/tailwind.config.js`, `apps/mobile/src/global.css`.

- [ ] Tokens de cor: fundo, superfícies 1 a 3, borda, texto (primário, secundário, desabilitado), foco, estados (sucesso, aviso, erro, info) e as cores das classes de marcação
- [ ] Contraste conferido: texto 4.5:1, ícones e bordas de controle 3:1
- [ ] Escala de espaçamento, raios (no máximo 6 px), uma sombra só para diálogos e espessura de borda
- [ ] Fontes: IBM Plex Sans (interface) e IBM Plex Mono (códigos, números e contagens); escala tipográfica com `/impeccable typeset`
- [ ] Componentes em `src/components/ui` refeitos sobre os tokens: `Button`, `Card`, `DataTable`, `Dialog`, `Field`, `Grid`, `Screen`, `Select`
- [ ] Layout: `AuthShell` e `TopHeader`
- [ ] Estados de todo componente: normal, hover, pressionado, foco visível, desabilitado e carregando
- [ ] Alvo de toque mínimo de 44 × 44 px no celular
- [ ] `/impeccable extract` para juntar padrões repetidos nas telas
- [ ] Testes do Jest continuam passando

### Fase 4 · Telas, uma área por PR

Para **cada tela** da [seção 5](#5-checklist-por-tela):

1. Ler `MASTER.md` e, se existir, `design-system/segmenta-studio/pages/<tela>.md`
2. Aplicar os componentes e tokens novos (os hooks da Impeccable avisam se algo fugir das regras)
3. `/impeccable layout` e `/impeccable clarify` (espaçamento, hierarquia e textos)
4. Capturas de depois com o playwright-cli, em 1440 px e 375 px
5. `/impeccable polish`

Ordem sugerida (do mais usado para o menos usado):

- [ ] PR 1 · Autenticação
- [ ] PR 2 · Avaliador
- [ ] PR 3 · Validador
- [ ] PR 4 · Gestor
- [ ] PR 5 · Admin e diagnóstico

### Fase 5 · Acabamento

- [ ] `/impeccable audit` de novo: nenhum problema crítico de acessibilidade
- [ ] `/impeccable adapt`: celular (375 px), tablet (768 px) e desktop (1440 px), sem rolagem horizontal
- [ ] `/impeccable harden`: textos longos, listas vazias, erros de rede e carregamento
- [ ] `/impeccable quieter` ou `distill` onde ainda houver excesso
- [ ] Movimento só funcional (150 a 200 ms), respeitando "reduzir movimento" do sistema
- [ ] Teste no Android, no seu celular, com o build de desenvolvimento
- [ ] Atualizar README e `docs/02-arquitetura.md` (tema e componentes) com capturas novas

## 5. Checklist por tela

| Área | Tela | Arquivo em `apps/mobile/src/app/` | Atenção especial | Feita |
| --- | --- | --- | --- | --- |
| Autenticação | Login | `(auth)/login.tsx` | Primeira impressão da marca; erro genérico de login (R-14) | [ ] |
| Autenticação | Código 2FA | `(auth)/verificacao.tsx` | Campo de 6 dígitos, reenviar e tempo restante | [ ] |
| Autenticação | Esqueci a senha | `(auth)/esqueci-senha.tsx` | | [ ] |
| Autenticação | Redefinir senha | `(auth)/redefinir-senha.tsx` | Regras de senha visíveis | [ ] |
| Avaliador | Fila | `(app)/avaliador/index.tsx` | Estado de cada imagem legível de relance | [ ] |
| Avaliador | **Anotação** | `(app)/avaliador/anotacao/[imageId].tsx` | Tela principal: imagem com o máximo de área, entorno neutro, ferramentas compactas, contagem por classe, atalhos | [ ] |
| Avaliador | Finalizada | `(app)/avaliador/finalizada/[imageId].tsx` | Somente leitura, claramente diferente da edição | [ ] |
| Validador | Fila | `(app)/validador/index.tsx` | Divergência entre avaliadores visível na lista | [ ] |
| Validador | **Comparação** | `(app)/validador/comparacao/[imageId].tsx` | Cegamento: sem nome de avaliador; contagens lado a lado | [ ] |
| Gestor | Painel | `(app)/gestor/index.tsx` | | [ ] |
| Gestor | Lotes | `(app)/gestor/lotes.tsx` | Envio de imagens com progresso e erros por arquivo | [ ] |
| Gestor | Atribuição | `(app)/gestor/atribuicao.tsx` | | [ ] |
| Gestor | Exportação | `(app)/gestor/exportacao.tsx` | | [ ] |
| Gestor | Auditoria | `(app)/gestor/auditoria.tsx` | Tabela densa, data e hora em mono | [ ] |
| Admin | Usuários | `(app)/admin/usuarios.tsx` | Papéis como etiquetas, ativo e inativo | [ ] |
| Admin | Projetos | `(app)/admin/projetos.tsx` | | [ ] |
| Admin | Auditoria | `(app)/admin/auditoria.tsx` | Mesmo componente do gestor | [ ] |
| Geral | Diagnóstico | `diagnostico.tsx` | | [ ] |

## 6. Pronto quando

Cada PR de tela só entra na `main` quando:

- [ ] Usa só tokens e componentes do design system (nenhuma cor ou tamanho solto no código)
- [ ] Os hooks da Impeccable não apontam problema na tela
- [ ] Traz capturas de antes e depois, em 1440 px e 375 px (regra do [06](06-plano-de-execucao.md))
- [ ] Contraste e foco visível conferidos; navegação por teclado funciona na web
- [ ] Lint, tipos, testes e build web passam no CI
- [ ] Commits no padrão do grupo, com o ID da tarefa

## 7. Riscos

| Risco | Como evitar |
| --- | --- |
| Conflito com a R-07 (mudança de pasta) | Combinar a janela com o Fernando e fazer PRs pequenos, um por área |
| Conflito com as tarefas de tela R-24 a R-30 | Combinar a ordem; a fundação (fase 3) entra antes e as telas novas da frente B já nascem com ela |
| Cor da interface atrapalhar a leitura da lâmina | Entorno neutro na anotação e na comparação, testado com imagens reais de IHC |
| Visual bonito, mas lento no celular | Sem desfoque, sombra pesada nem animação contínua; conferir no Android |
| A proposta agradar só a quem fez | Escolher a direção com o grupo na fase 2, antes de qualquer código de tela |
