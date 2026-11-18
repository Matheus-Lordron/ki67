# Product

<!-- impeccable:product-schema 1 -->

<!-- Os títulos das seções ficam em inglês porque a skill Impeccable os lê; o conteúdo é em português. -->

## Platform

adaptive

Uma base de código Expo (React Native + React Native Web) para web, Android e iOS. A linguagem visual se adapta às convenções de cada sistema (Material no Android, HIG no iOS, convenções da web no navegador); as funções são as mesmas nas três (RNF-02), muda só a interação (mouse e teclado × toque).

## Users

Decisões de design otimizam primeiro para os usuários reais de um estudo de pesquisa, não para a apresentação no Laboratório de Avaliação.

- **Avaliador** (em geral, patologista): recebe imagens de um lote e marca, de forma independente e cega, os núcleos de cada classe. Conta de centenas a cerca de 2.000 marcações por imagem, em sessões longas. A anotação é pensada primeiro para tablet e desktop, mas precisa funcionar no celular (Q6).
- **Gestor do projeto** (patologista líder ou pesquisador principal): monta o estudo, cria lotes, sobe imagens, define quantos avaliadores (N) cada imagem recebe, cuida da equipe do projeto, acompanha o progresso, aprova pedidos de reavaliação e exporta os dados.
- **Validador**: compara as N análises finalizadas de uma imagem, sem saber quem fez cada uma, e registra o resultado de referência ou o consenso.
- **Administrador do sistema**: cadastra pessoas e papéis, cria projetos, define o gestor de cada um e acompanha a segurança pelo log. Não vê nem edita anotações.

## Product Purpose

O **Segmenta Studio** é uma plataforma de anotação cega e versionada de imagens de lâminas para estudos de pesquisa. O Ki-67 (imuno-histoquímica) é o primeiro estudo: núcleos reagentes (marrons) e não reagentes (azul-claros). Cada projeto passa a definir as próprias classes de marcação (RN-10).

Existe porque contar núcleos é demorado e varia entre observadores, e estudos de validação exigem vários avaliadores que não vejam o trabalho uns dos outros. Ferramentas genéricas como o Labelme rodam no computador de cada um, salvam arquivos soltos e não têm usuários, permissões, histórico nem garantia de cegamento.

Sucesso significa: dados de anotação confiáveis e prontos para pesquisa, com cegamento real, nenhuma perda de trabalho, rastreabilidade completa e marcação rápida e precisa em qualquer aparelho.

## Positioning

- **Cegamento garantido pelo banco**, não só escondido na tela: RLS no PostgreSQL recusa requisições forjadas como se a análise não existisse e registra `ACESSO_NEGADO`.
- **Nada se perde**: cada par (imagem, avaliador) tem análise própria, versões nunca são apagadas, restaurar cria uma versão nova e o log é somente-inclusão (nem o admin altera).
- **Comparação anônima**: o validador vê as análises identificadas por letras (A, B, C...), sem nomes.
- **Uma base, três plataformas**, com dados exportados em formatos que outras ferramentas já leem (JSON do Labelme e CSV).

## Operating Context

- Fluxo: o gestor sobe as imagens em lotes → atribui cada imagem a N avaliadores (padrão 3) → a imagem abre pré-anotada (limiar de cor) → cada avaliador anota às cegas e finaliza → com as N análises finalizadas, o validador compara → resultado validado. Cada passo vai para o log de auditoria.
- Anotação por pontos, caixas e polígonos, com zoom, pan, pinça, lupa sob o dedo, desfazer/refazer (50 ações) e atalhos de teclado na web (`1`/`2` trocam a classe, `P`, `C`, `G`, `Z`, `Shift+Z`, espaço + arrastar).
- Marcações automáticas aparecem diferentes das manuais (contorno tracejado) e cada aceite, correção ou remoção é registrado com a origem (`manual`, `pre_anotacao`, `pre_anotacao_editada`).
- Pesquisa com dado de saúde: aprovação no CEP, LGPD, imagens anonimizadas, dados no Brasil (Supabase em São Paulo; imagens no Cloudflare R2 por URL assinada).
- Rede necessária para login, listas e abertura de imagens; a análise já aberta continua editável offline e o rascunho fica no aparelho.
- Modo demonstração sem nenhuma conta em nuvem (dados em memória), usado em desenvolvimento e apresentações.
- Projeto da disciplina COM1045 (Ciência da Computação, UTFPR Medianeira, 2026/2). O MVP será avaliado no Laboratório de Avaliação do App (data prevista 04/12/2026, a confirmar).

## Capabilities and Constraints

- Login com e-mail, senha e código de 6 dígitos por e-mail (2FA); sem autocadastro, login social ou link público; sessão expira após 30 min de inatividade.
- Papéis globais e fixos (Admin, Gestor, Avaliador, Validador), alterados só pelo admin. Um usuário pode acumular papéis, exceto: o gestor não avalia no próprio projeto (RN-07) e ninguém valida imagem que anotou (RN-08).
- Nenhuma exclusão definitiva de usuários, análises, versões ou logs; usuários são desativados.
- Imagem original imutável, com hash SHA-256 e remoção de metadados no upload (JPG, PNG, TIFF até 50 MB). Lâminas inteiras (WSI) fora do MVP.
- **Índice fora das telas nesta fase (RN-15):** as telas e o fechamento da validação usam só a contagem de cada classe. O índice pode voltar como opção do projeto.
- **Rascunho × versão (RN-14):** o salvamento automático guarda só um rascunho; uma versão nova nasce em **Salvar** ou **Finalizar**. O indicador distingue "rascunho guardado" de "salvo como versão N".
- **Reavaliação (RN-04):** o avaliador pede, com motivo; o gestor aprova ou recusa; a versão finalizada original fica guardada e o gestor compara as duas.
- **Equipe do projeto (RN-12, RN-13):** só quem está na equipe recebe ou valida imagens; retirar alguém não apaga as análises, que ficam marcadas como "avaliador removido do projeto".
- Classes diferenciadas por **símbolo além da cor**.
- O app não pede câmera, localização, contatos nem notificações.
- Só português.
- Terminologia do produto: avaliador, gestor do projeto, validador, administrador; projeto (estudo), lote, imagem, análise, classe (label), reagente / não reagente, pré-anotação, rascunho, versão, finalizar, reavaliação, consenso, concordância, equipe do projeto, log de auditoria. Estados: `PENDENTE`, `EM_ANDAMENTO`, `FINALIZADA`, `VALIDADA`.
- Em aberto: onde fica a versão web publicada (Q9); se a pré-anotação enviesa a análise (Q2, medido pela origem das marcações); outras classes além de reagente/não reagente no estudo Ki-67 (Q4); métrica de concordância definitiva (ICC no backend, R-22).

## Brand Commitments

- Nome do produto: **Segmenta Studio**. O estudo Ki-67 aparece como o primeiro estudo ("Segmenta Studio Ki-67" no `app.json`). O repositório continua `ki67` e o identificador do app é `br.edu.utfpr.ki67`.
- Aviso regulatório obrigatório e visível: ferramenta exclusivamente de pesquisa científica, que não substitui o laudo do patologista e não é dispositivo médico.
- Voz: português claro e objetivo, como nos documentos de `docs/`; mensagens de erro de login genéricas, sem dizer qual campo errou.
- Nada na interface pode quebrar o cegamento: nenhuma tela do avaliador mostra nomes, contagens, observações ou marcações de outros avaliadores, e não há chat nem comentários entre avaliadores.

## Evidence on Hand

- Requisitos, arquitetura, planejamento e planos de refatoração em `docs/01` a `docs/06`.
- Protótipos de baixa fidelidade: `docs/img/prototipo-anotacao-web.svg` e `docs/img/prototipo-mobile.svg`. Ainda não há capturas reais nem GIF da anotação.
- Dados do modo demonstração em `apps/mobile/src/data/mockData.ts`, com contas fictícias (`@oncocentro.org.br`), que não são clientes nem usuários reais.
- Ausências que nenhum trabalho futuro deve inventar: depoimentos, clientes, instituições parceiras, números de uso, métricas de concordância de estudos reais, certificações ou aprovação regulatória. Até a aprovação no CEP, só se usam imagens sintéticas ou de bases públicas com licença compatível.

## Product Principles

1. **O cegamento vem antes da conveniência.** Nenhuma tela, atalho ou resumo pode revelar o trabalho de outro avaliador, nem por indício.
2. **O trabalho do avaliador nunca se perde.** O estado de salvamento é sempre visível e claro, e nenhuma ação destrói versões ou marcações sem volta.
3. **Precisão e ritmo na marcação.** A tela de anotação serve a sessões longas de contagem: a imagem é a protagonista, a ferramenta ativa e a classe ativa são óbvias, e marcar responde em menos de 100 ms.
4. **Rastreável por padrão.** O que veio da máquina e o que foi marcado à mão, quem fez o quê e quando, sempre podem ser distinguidos.
5. **Nativo em cada plataforma, igual em função.** Cada sistema recebe as próprias convenções, sem perder nenhuma função de anotação.

## Accessibility & Inclusion

- WCAG 2.1 AA: contraste mínimo de 4,5:1.
- Alvos de toque de pelo menos 44 × 44 pt (iOS) e 48 × 48 dp (Android).
- Todo botão de ícone com `accessibilityLabel`; textos acompanham o tamanho de fonte do sistema.
- Classes distinguidas por símbolo, não só por cor.
- Login e listas percorridos de ponta a ponta com VoiceOver e TalkBack; Lighthouse de acessibilidade 90 ou mais na web. No canvas, o leitor de tela anuncia a classe ativa e as contagens, não cada núcleo.
