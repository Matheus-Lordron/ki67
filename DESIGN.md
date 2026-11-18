---
name: Segmenta Studio
description: Anotação cega e versionada de imagens de lâminas, com o Ki-67 como primeiro estudo.
colors:
  primary: "#00236f"
  primary-dark: "#1e3a8a"
  primary-soft: "#dce9ff"
  surface: "#f8f9ff"
  surface-alt: "#eff4ff"
  white: "#ffffff"
  ink: "#0b1c30"
  ink-muted: "#444651"
  ink-subtle: "#757682"
  line: "#c5c5d3"
  instrument-dark: "#0f172a"
  dab: "#8e4d2d"
  dab-dashed: "#ffb595"
  hema: "#0284c7"
  hema-dashed: "#38bdf8"
  hema-soft: "#e0f2fe"
  hema-ink: "#0369a1"
  selection: "#fbbf24"
  success: "#047857"
  success-soft: "#ecfdf5"
  warn: "#78350f"
  warn-soft: "#fef3c7"
  danger: "#ba1a1a"
  danger-soft: "#ffdad6"
  danger-dark: "#93000a"
typography:
  display:
    fontFamily: "Inter_800ExtraBold, Inter, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: "36px"
  headline:
    fontFamily: "Inter_700Bold, Inter, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: "28px"
  title:
    fontFamily: "Inter_700Bold, Inter, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: "24px"
  body:
    fontFamily: "Inter_400Regular, Inter, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "20px"
  action:
    fontFamily: "Inter_600SemiBold, Inter, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: "16px"
  data:
    fontFamily: "JetBrainsMono_400Regular, JetBrains Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
  label:
    fontFamily: "JetBrainsMono_700Bold, JetBrains Mono, ui-monospace, monospace"
    fontSize: "10px"
    fontWeight: 700
    lineHeight: "14px"
rounded:
  xs: "2px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    typography: "{typography.action}"
    rounded: "{rounded.xs}"
    padding: "8px 14px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.primary-dark}"
  button-outline:
    backgroundColor: "{colors.white}"
    textColor: "{colors.primary}"
    typography: "{typography.action}"
    rounded: "{rounded.xs}"
    padding: "8px 14px"
    height: "40px"
  button-outline-hover:
    backgroundColor: "{colors.surface-alt}"
  button-soft:
    backgroundColor: "{colors.hema-soft}"
    textColor: "{colors.hema-ink}"
    typography: "{typography.action}"
    rounded: "{rounded.xs}"
    padding: "8px 14px"
    height: "40px"
  button-danger:
    backgroundColor: "{colors.white}"
    textColor: "{colors.danger}"
    typography: "{typography.action}"
    rounded: "{rounded.xs}"
    padding: "8px 14px"
    height: "40px"
  icon-button:
    backgroundColor: "transparent"
    rounded: "{rounded.xs}"
    size: "44px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xs}"
    padding: "8px 12px"
    height: "40px"
  card:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.xs}"
    padding: "20px"
  badge:
    backgroundColor: "{colors.surface-alt}"
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    rounded: "{rounded.xs}"
    padding: "2px 8px"
  segmented-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    typography: "{typography.action}"
    rounded: "{rounded.xs}"
    padding: "8px 16px"
    height: "40px"
  segmented-idle:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.action}"
    rounded: "{rounded.xs}"
    padding: "8px 16px"
    height: "40px"
  nav-tab-active:
    textColor: "{colors.primary}"
    typography: "{typography.action}"
    height: "40px"
  nav-tab-idle:
    textColor: "{colors.ink-muted}"
    height: "40px"
---

# Design System: Segmenta Studio

<!-- Os títulos das seções ficam em inglês porque as ferramentas de DESIGN.md os leem; o conteúdo é em português. -->

## Overview

**Creative North Star: "O Laudo de Bancada"**

O Segmenta Studio parece um instrumento de laboratório, não um aplicativo de consumo. O azul-marinho institucional assina a identidade. Os cantos são quase retos, as bordas são finas e os rótulos em fonte mono funcionam como etiquetas de lâmina. A cor com significado fica reservada aos dois corantes da imuno-histoquímica: o marrom do DAB (núcleo reagente) e o azul da hematoxilina (não reagente). Todo o resto é neutro, para que a imagem da lâmina seja sempre a protagonista.

O tom é clínico e preciso. As telas são densas, com tipografia pequena e dados em mono, e transmitem rigor e rastreabilidade: versão, hora, lote e estado aparecem como carimbos, não como enfeite. Na anotação, a moldura escura em volta do canvas (`instrument-dark`) faz o papel da sala escura do microscópio, e os painéis claros ao redor fazem o papel da bancada.

O sistema é hoje uma linguagem única, desenhada para a web e levada sem mudanças ao Android e ao iOS. Pelo PRODUCT.md, a plataforma é `adaptive`: os padrões de navegação, os diálogos e os controles nativos de cada sistema devem prevalecer onde divergirem desta base. Cores dos corantes, tokens e a voz de "laudo" ficam iguais em todas as plataformas.

**Key Characteristics:**
- Azul-marinho institucional como única cor de marca; os corantes DAB e hematoxilina como únicas cores semânticas do conteúdo.
- Cantos de 2 px, bordas finas cinza-azuladas, sombra quase ausente.
- Inter para interface, JetBrains Mono para dados, códigos, versões e rótulos-carimbo.
- Densidade alta: corpo de 12 px, rótulos de 10 a 11 px.
- Canvas de anotação sobre fundo escuro, cercado por painéis claros.

## Colors

Paleta fria e institucional: azul-marinho, superfícies azul-gelo e tinta quase preta, com dois corantes de laboratório carregando todo o significado do conteúdo.

### Primary
- **Marinho Institucional** (`primary`): botões primários, título de página, aba ativa, papel ativo, ícones de marca e o bloco da marca. É a voz da plataforma.
- **Marinho Profundo** (`primary-dark`): hover do botão primário, foco dos campos e avatar do usuário.
- **Azul Etiqueta** (`primary-soft`): fundo de selos de marca ("IHC Ki-67") e hover das opções de papel.

### Secondary
- **Marrom DAB** (`dab`): núcleo reagente, em pontos, caixas, polígonos, seletor de classe e contagens. **Pêssego DAB** (`dab-dashed`) é o contorno tracejado das marcações reagentes vindas da pré-anotação.
- **Azul Hematoxilina** (`hema`): núcleo não reagente, com o mesmo papel do DAB. **Celeste Hematoxilina** (`hema-dashed`) marca a pré-anotação não reagente. **Névoa Hematoxilina** (`hema-soft`) e **Tinta Hematoxilina** (`hema-ink`) formam o botão suave de "Pré-marcar não reagentes".

### Tertiary
- **Âmbar Seleção** (`selection`): marcação selecionada, desenho em andamento (caixa e polígono) e mapa de calor. É a única cor de interação dentro do canvas.

### Neutral
- **Gelo de Bancada** (`surface`): fundo das telas e dos campos de texto.
- **Gelo Azulado** (`surface-alt`): faixas de informação, hover, selos neutros, estado selecionado de checkbox e radio.
- **Branco** (`white`): cartões, cabeçalho, diálogos.
- **Tinta de Laudo** (`ink`): texto principal. **Grafite** (`ink-muted`): descrições e abas inativas. **Cinza Etiqueta** (`ink-subtle`): dicas, placeholders e metadados.
- **Fio de Lâmina** (`line`): toda borda e divisória.
- **Sala Escura** (`instrument-dark`): fundo do canvas de anotação, da lupa, da visualização da análise finalizada e do log de auditoria em destaque.

### Estados
- **Verde Conferido** (`success`, `success-soft`): online, salvo, validado.
- **Âmbar Atenção** (`warn`, `warn-soft`): offline, em andamento, contagem parcial.
- **Vermelho Recusa** (`danger`, `danger-soft`, `danger-dark`): erro, sair, ações destrutivas.

### Named Rules
**A Regra dos Dois Corantes.** No conteúdo, marrom significa reagente e azul significa não reagente, e nada mais. Nenhum elemento de interface usa `dab` ou `hema` como decoração. Quando as classes passarem a ser configuráveis por projeto (RN-10), cada classe traz a própria cor, e as cores de interface continuam fora dessa paleta.

**A Regra do Símbolo.** Uma classe nunca depende só da cor: o ponto reagente é um disco cheio com centro branco, o não reagente é um anel com miolo claro, e a pré-anotação acrescenta um contorno tracejado.

**A Regra do Marinho Único.** O azul-marinho é a única cor de ação. Ele não aparece em textos longos nem em fundos de áreas grandes, exceto no bloco da marca e no botão primário.

## Typography

**Display Font:** Inter (com system-ui)
**Body Font:** Inter (com system-ui)
**Label/Mono Font:** JetBrains Mono (com ui-monospace)

**Character:** A Inter dá à interface uma voz neutra e legível em tamanhos pequenos. A JetBrains Mono transforma códigos de imagem, versões, horários, contagens e rótulos em caixa alta em carimbos de laboratório.

No Android e no iOS, cada peso é uma família própria (`Inter_600SemiBold`, `JetBrainsMono_700Bold`...). Por isso o peso é escolhido pela família (`font-sans-semibold`), nunca por `font-weight`.

### Hierarchy
- **Display** (800, 30 px, 36 px): números de destaque, como a contagem principal do painel de quantificação.
- **Headline** (700, 20 px, 28 px): título de página e de cartão de autenticação, em `primary` nas telas internas e em `ink` nas públicas.
- **Title** (700, 16 px, 24 px): nome da marca no cabeçalho, título de diálogo e de estado vazio.
- **Body** (400, 12 px, 20 px): descrições, observações e textos de ajuda. Textos longos ficam em até 28rem (cerca de 65 caracteres).
- **Action** (600, 12 px): botões, abas, rótulos de campo.
- **Data** (mono 400, 12 px): pares chave e valor, códigos, datas e contagens em listas.
- **Label** (mono 700, 10 a 11 px, caixa alta quando é carimbo): selos, estados ("PROTOCOLO CEGO ATIVO", "AMBIENTE PROTEGIDO"), metadados da lâmina.

### Named Rules
**A Regra do Carimbo.** Tudo o que é dado verificável (código de imagem, versão, hora, hash, contagem, papel) vai em mono. Frases para ler vão em Inter.

**A Regra do Piso.** Nenhum texto fica abaixo de 10 px. Os 8 e 9 px existem só no rótulo SVG das caixas dentro do canvas e não se repetem fora dele.

## Layout

Cabeçalho fixo em duas faixas: a barra de marca, papel, conexão e usuário (mínimo de 56 px) e a faixa de abas do papel (40 px), que rola de lado no celular e mantém a aba ativa visível. O conteúdo fica num fundo `surface`, com cartões brancos empilhados e espaçamento de 16 a 24 px.

As listas usam uma grade de cartões (três colunas no desktop, uma no celular). A anotação divide a tela em trilho de ferramentas vertical à esquerda, canvas escuro no centro e painel de quantificação de cerca de 340 px à direita. Abaixo de 768 px, o painel desce para baixo do canvas.

Quebras observadas: 640 px (sm), 768 px (md, limite do modo compacto no código), 900 px (nome do usuário aparece), 1024 px (lg, margem lateral passa a 24 px) e 1280 px (selo "Sessão cega" aparece). As telas públicas centralizam um cartão de até 440 px entre um cabeçalho fino e o rodapé com o aviso regulatório.

O ritmo segue a escala de 4 px do Tailwind: 8 px entre itens próximos, 12 a 16 px entre grupos, 20 px dentro dos cartões, 24 a 32 px nos cartões de autenticação.

## Elevation & Depth

O sistema é plano e usa camadas de tom. A profundidade vem de branco sobre gelo azulado e de bordas finas, não de sombra. Existem sombras, mas são discretas e reservadas a quem flutua.

### Shadow Vocabulary
- **Fio** (`0 1px 2px 0 rgb(0 0 0 / 0.05)`): cartões e cabeçalho. Quase imperceptível; separa sem levantar.
- **Cartão de acesso** (`0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`): o cartão central do login e do 2FA, e a legenda flutuante do canvas.
- **Flutuante** (`0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)`): diálogos, folhas e a lupa da anotação.

### Named Rules
**A Regra da Bancada Plana.** Nada na bancada tem sombra além do fio. Sombra maior só para o que de fato flutua sobre a tela: diálogo, folha, lupa, aviso.

## Shapes

Cantos quase retos (2 px) em tudo o que é retangular: botões, campos, cartões, selos, diálogos e abas segmentadas. Círculos completos só para o avatar, os ícones de estado vazio e de diálogo, o radio, os pontos de marcação e a lupa. A folha inferior no celular é a única exceção, com o topo arredondado em 8 px. As bordas têm sempre 1 px em `line`. O destaque de aviso usa uma barra lateral de 4 px.

## Components

### Buttons
Precisos e contidos: retos, compactos e com rótulo em semibold de 12 px.
- **Shape:** cantos de 2 px (`rounded.xs`); altura mínima de 32, 40 ou 44 px (pequeno, médio, grande).
- **Primary:** fundo `primary`, texto branco, ícone de 16 px à esquerda e seta opcional à direita. É a ação principal da tela ("Finalizar análise", "Iniciar Anotação").
- **Hover / Focus:** na web, o hover escurece para `primary-dark`. Desabilitado ou carregando reduz a opacidade para 50 % e troca o ícone por um indicador de atividade.
- **Outline:** fundo branco, borda `line`, texto `primary`, hover `surface-alt`. É a ação secundária.
- **Soft:** fundo `hema-soft`, borda `hema`, texto `hema-ink`. Só para a pré-marcação automática.
- **Danger:** fundo branco, borda rosada, texto `danger`.
- **Icon button:** alvo de 44 × 44 px, transparente, preenchido de `primary` quando ativo (ferramenta selecionada).

### Chips
- **Style:** selos retos de 2 px com borda, fundo claro do tom e texto mono bold de 10 px, em caixa alta quando são carimbos. Tons: marca, sucesso, atenção, perigo, neutro, DAB e hematoxilina.
- **State:** são informativos e não clicáveis. A escolha fica com os controles segmentados.

### Cards / Containers
- **Corner Style:** 2 px.
- **Background:** branco sobre `surface`.
- **Shadow Strategy:** fio (ver Elevation & Depth).
- **Border:** 1 px em `line`.
- **Internal Padding:** 20 px; 24 a 32 px nos cartões de autenticação.
- **Callout:** o aviso de erro ou alerta usa uma barra lateral de 4 px na cor do estado sobre fundo suave. O aviso informativo usa `surface-alt` com borda fina.

### Inputs / Fields
- **Style:** fundo `surface`, borda `line` de 1 px, cantos de 2 px, altura mínima de 40 px, texto de 12 px, ícone de 16 px à esquerda em `ink-subtle`. O rótulo fica acima, em semibold de 12 px, com uma dica opcional à direita.
- **Focus:** a borda passa a `primary-dark`; na web, sem o contorno padrão do navegador.
- **Código e senha:** os campos de código 2FA usam mono bold.
- **Checkbox / Radio:** linhas de 44 px com borda, que passam a `primary` sobre `surface-alt` quando marcadas.

### Navigation
- **Cabeçalho:** branco, com borda inferior e sombra de fio. À esquerda, o bloco da marca (36 px, `primary`, ícone de microscópio branco) e o nome "Segmenta Studio" em bold de 16 px, com o selo "IHC Ki-67" e a linha mono "MÓDULO DE QUANTIFICAÇÃO NUCLEAR". À direita, o estado de conexão, a ajuda, o avatar e o sair em vermelho.
- **Troca de papel:** controle segmentado compacto; o papel ativo fica em `primary` com texto branco.
- **Abas do papel:** faixa de 40 px em `surface`, com ícone de 14 px e texto de 12 px. A aba ativa fica em `primary` semibold, com sublinhado de 2 px; as inativas em `ink-muted`.
- **No celular:** a marca vira só o bloco, os rótulos encolhem e as abas rolam de lado. Pelo PRODUCT.md (`adaptive`), o padrão nativo de navegação de cada sistema pode substituir esta faixa no Android e no iOS.

### Área de anotação
É o componente que define o produto.
- **Trilho de ferramentas:** coluna vertical de botões de ícone de 44 px (seleção, ponto, caixa, polígono, desfazer, refazer, zoom, fundo, grade), com o atalho do teclado em mono embaixo de cada um.
- **Canvas:** fundo `instrument-dark`, cursor em cruz na web e uma legenda flutuante escura com zoom, número de marcações e atalhos.
- **Marcações:** o ponto reagente é um disco `dab` com contorno branco e centro branco; o não reagente é um anel `hema` com miolo claro translúcido. Caixas e polígonos têm preenchimento de 15 a 20 % e contorno de 1,5 a 2 px. A pré-anotação acrescenta o contorno tracejado na cor `*-dashed`, e a seleção usa um anel externo em `selection`.
- **Lupa:** círculo com borda branca de 2 px e sombra flutuante, que mostra a área sob o dedo no celular.
- **Painel de quantificação:** cartões empilhados com o estado de salvamento no topo ("Salvo · v12", em verde), o seletor de classe (dois cartões com a cor do corante, a contagem em display e o atalho `[1]` ou `[2]` em mono), o botão suave de pré-marcação, o total, a observação e o botão primário "Finalizar análise" fixo no rodapé.
- **Faixa de cegamento:** barra fina em `surface-alt` acima do canvas, com "Modo cego ativo" e os metadados da amostra em mono.

### Rodapé regulatório
Faixa branca com borda superior em todas as telas públicas: "Aviso regulatório obrigatório:" em semibold `ink`, seguido do texto em `ink-subtle`, e a versão do estudo em mono à direita.

## Do's and Don'ts

### Do:
- **Do** usar `primary` (#00236f) como única cor de ação e de marca, com hover em `primary-dark`.
- **Do** reservar `dab` e `hema` para as classes de núcleo e para os controles que as representam (seletor de classe, contagens, pré-marcação).
- **Do** diferenciar cada classe por símbolo além da cor, e a pré-anotação por contorno tracejado.
- **Do** escrever códigos, versões, horários, hashes e contagens em JetBrains Mono.
- **Do** manter cantos de 2 px e bordas de 1 px em `line` em todo elemento retangular.
- **Do** garantir alvos de toque de 44 px em botões de ícone e linhas selecionáveis.
- **Do** manter o canvas sobre `instrument-dark` e usar `selection` (#fbbf24) como única cor de interação dentro dele.
- **Do** mostrar o estado de salvamento e de conexão sempre à vista durante a anotação.

### Don't:
- **Don't** usar marrom ou azul-claro como decoração de interface; eles significam reagente e não reagente.
- **Don't** colocar sombra em cartões além do fio (`0 1px 2px 0 rgb(0 0 0 / 0.05)`); sombra maior é só para diálogo, folha, lupa e aviso.
- **Don't** arredondar cartões, botões ou campos além de 2 px; círculos completos são só para avatar, ícone de estado, radio, marcações e lupa.
- **Don't** usar texto menor que 10 px fora do canvas.
- **Don't** usar `ink-subtle` (#757682) para texto essencial sobre `surface`; ali ele fica abaixo de 4,5:1 (cerca de 4,3:1) e serve só para dicas e metadados.
- **Don't** mostrar nomes, contagens ou marcações de outro avaliador em nenhuma tela do avaliador; a comparação identifica as análises por letras (A, B, C).
- **Don't** omitir o aviso regulatório das telas públicas.
