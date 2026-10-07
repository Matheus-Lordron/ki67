# 02 · Arquitetura

> **Documento vivo.** Versão 0.3, de 07/10/2026. Ele responde a uma pergunta: **onde eu mexo para alterar isto?** Os requisitos citados (RF, RNF) estão em [01 · Visão e requisitos](01-visao-e-requisitos.md).

**Neste documento:** [1. Visão geral](#1-visão-geral) · [2. Camadas do app](#2-camadas-do-app) · [3. Camadas da API](#3-camadas-da-api) · [4. Pastas](#4-estrutura-de-pastas) · [5. Navegação](#5-mapa-de-navegação) · [6. Sequências](#6-fluxos-com-a-api) · [7. Ciclos de vida](#7-ciclos-de-vida) · [8. Dados](#8-modelo-de-dados) · [9. API REST](#9-api-rest) · [10. Segurança](#10-segurança-e-cegamento) · [11. Bibliotecas](#11-bibliotecas-e-o-papel-de-cada-uma) · [12. Decisões](#12-decisões-de-arquitetura)

---

## 1. Visão geral

Um único app Expo roda na web, no Android e no iOS e fala com uma API REST própria. Administrador, gestor, avaliador e validador usam o mesmo app: o que muda entre eles são as telas e o que a API deixa cada um ver. A API é a única que acessa o banco, as imagens e o e-mail, e é nela que ficam as regras de cegamento, versionamento e log. O banco é um PostgreSQL gerenciado pelo **Supabase** ([D9](#12-decisões-de-arquitetura)) e as imagens ficam num bucket privado do **Cloudflare R2** ([D7](#12-decisões-de-arquitetura)). O app não recebe chave de nenhum dos dois.

```mermaid
flowchart LR
    subgraph App["App Ki67 · uma base de código Expo"]
        WEB["Web<br/>navegador"]
        AND["Android"]
        IOS["iOS"]
    end

    API["API REST<br/>NestJS · container"]

    subgraph Supabase["Supabase · região São Paulo"]
        DB[("PostgreSQL 17<br/>dados, versões e log")]
    end

    subgraph Cloudflare["Cloudflare"]
        ARQ[("R2 · bucket privado<br/>imagens das lâminas")]
    end

    SMTP["E-mail SMTP<br/>código 2FA e<br/>recuperação de senha"]

    WEB & AND & IOS -->|"HTTPS + JSON"| API
    API -->|"Prisma"| DB
    API -->|"API S3"| ARQ
    API --> SMTP
    App -.->|"imagem por URL<br/>assinada de 5 min"| ARQ
```

Em desenvolvimento, `npx supabase start` sobe na própria máquina o mesmo stack do Supabase (PostgreSQL, o painel Studio e o Mailpit, que captura os e-mails) em containers Docker, e as imagens ficam numa pasta privada da API. Em produção, a API usa o projeto Supabase na nuvem e o bucket no R2.

## 2. Camadas do app

Cada camada fala só com a vizinha. **A tela nunca chama a API diretamente**: ela usa o estado, que usa os serviços.

```mermaid
flowchart TB
    T["Telas e componentes<br/>apps/mobile/app · src/components · src/features"]
    N["Navegação<br/>Expo Router: pilhas, abas e guarda de sessão"]
    E["Estado<br/>Zustand: sessão e editor · TanStack Query: dados da API"]
    S["Serviços<br/>src/services: cliente HTTP tipado"]
    L[("Armazenamento local<br/>SecureStore · AsyncStorage")]
    B["API REST<br/>NestJS"]

    T --> N --> E --> S
    S --> L
    S -->|"HTTPS + JSON"| B
```

| Camada | Onde fica | Responsabilidade | Regra |
| --- | --- | --- | --- |
| Telas e componentes | `app/`, `src/components/`, `src/features/` | Desenhar a interface e capturar toques, cliques e gestos | Não conhece URL nem formato HTTP |
| Navegação | `app/_layout.tsx` e grupos `(auth)`, `(avaliador)`, `(validador)`, `(gestor)`, `(admin)` | Rotas, abas e redirecionamento de quem está sem sessão ou sem papel | A guarda de rota é conveniência; quem bloqueia de verdade é a API (RF-28) |
| Estado | `src/state/` (Zustand) e `src/queries/` (TanStack Query) | Sessão, editor (marcações, ferramenta e label ativas, desfazer e refazer) e cache dos dados da API | Fonte única da verdade para as telas |
| Serviços | `src/services/` | Chamadas HTTP validadas com os schemas de `packages/shared`, renovação do token e tratamento de erro | Única camada que fala com a API |
| Armazenamento local | `src/storage/` | Sessão (SecureStore ou cookie) e rascunho da análise aberta | Nunca guarda imagem nem dado de outro usuário |

## 3. Camadas da API

```mermaid
flowchart LR
    REQ(["Requisição HTTPS"]) --> G["Guards<br/>JWT, papel e<br/>limite de tentativas"]
    G --> C["Controllers<br/>rotas e validação<br/>com Zod"]
    C --> SV["Services<br/>regras de negócio,<br/>cegamento e versões"]
    SV --> RP["Repositórios<br/>Prisma"]
    RP --> DB[("Supabase<br/>PostgreSQL")]
    SV --> ST["StorageService<br/>disco local ou R2"]
    SV --> AU["AuditoriaService<br/>log somente-inclusão"]
    AU --> DB
    SV --> MAIL["MailService<br/>Nodemailer"]
```

A API é dividida em módulos NestJS, um por área do domínio:

| Módulo | Responsabilidade | Requisitos |
| --- | --- | --- |
| `auth` | Login, código 2FA, sessão, recuperação de senha | RF-01 a RF-05 |
| `usuarios` | Cadastro, papéis e desativação | RF-06, RF-07 |
| `projetos` | Projetos, gestor designado, lotes e o N de avaliadores de cada lote | RF-09, RF-29 |
| `imagens` | Upload, hash, cópia reduzida e URL assinada | RF-08, RF-11, RF-36 |
| `preanotacao` | Núcleos azul-claros por limiar de cor, calculados uma vez por imagem | RF-17, RF-18 |
| `analises` | Atribuição, abas, marcações, índice, versões, finalização, histórico e restauração | RF-10, RF-12 a RF-16, RF-19 a RF-24, RF-26 a RF-28, RF-33 a RF-35 |
| `labels` | Labels e papel de cada uma no índice | RF-12, RF-41 |
| `validacao` | Fila, comparação das N análises, concordância e resultado | RF-30 a RF-32 |
| `auditoria` | Gravação e consulta do log | RF-37 a RF-39 |
| `exportacao` | JSON no formato do Labelme e CSV | RF-40 |
| `painel` | Progresso por avaliador e por lote | RF-25 |

## 4. Estrutura de pastas

O repositório é um monorepo com *npm workspaces*. O código entra a partir da Sprint 0 ([03 · Planejamento](03-planejamento.md)); esta é a estrutura planejada.

```text
ki67/
├── apps/
│   ├── mobile/                     # app Expo: web, Android e iOS
│   │   ├── app/                    # rotas do Expo Router (cada arquivo é uma tela)
│   │   │   ├── _layout.tsx         # provedores e guarda de sessão
│   │   │   ├── (auth)/             # login, código 2FA, recuperar senha
│   │   │   ├── (avaliador)/        # abas Pendentes e Avaliadas
│   │   │   ├── (validador)/        # fila e comparação das análises
│   │   │   ├── (gestor)/           # painel, lotes, atribuição, análises, exportação
│   │   │   ├── (admin)/            # usuários, projetos e gestores, logs
│   │   │   └── analise/[id].tsx    # tela de anotação
│   │   └── src/
│   │       ├── components/         # botões, cards, listas, campos
│   │       ├── features/anotacao/  # canvas Skia, gestos, ferramentas, desfazer/refazer
│   │       ├── state/              # stores Zustand
│   │       ├── queries/            # hooks do TanStack Query
│   │       ├── services/           # cliente HTTP: a única porta para a API
│   │       ├── storage/            # SecureStore e rascunho local
│   │       └── theme/              # cores, espaçamentos, tamanhos de toque
│   └── api/                        # API REST NestJS
│       ├── src/
│       │   ├── auth/  usuarios/  projetos/  imagens/  preanotacao/  analises/
│       │   ├── labels/  validacao/  auditoria/  exportacao/  painel/
│       │   └── common/             # guards, interceptors, filtros de erro
│       ├── prisma/                 # schema.prisma, migrações e seed
│       └── test/                   # testes e2e, incluindo a bateria de cegamento
├── packages/
│   └── shared/                     # tipos, schemas Zod, índice, concordância, formato Labelme
├── supabase/
│   └── config.toml                 # Supabase local: versão do Postgres, portas e SMTP do Mailpit
├── docs/                           # esta documentação
├── .env.example                    # variáveis de ambiente, sem segredos
└── package.json                    # workspaces e scripts da raiz
```

### Onde eu mexo para alterar isto?

| Quero alterar... | Mexo em... |
| --- | --- |
| Uma tela ou a navegação | `apps/mobile/app/` (cada arquivo é uma rota) |
| Um componente visual reutilizável | `apps/mobile/src/components/` |
| O desenho, os gestos ou as ferramentas do canvas (ponto, caixa, polígono) | `apps/mobile/src/features/anotacao/` |
| Uma chamada à API | `apps/mobile/src/services/` (a tela nunca usa `fetch` direto) |
| O que fica salvo no aparelho | `apps/mobile/src/storage/` |
| Cores, fontes e tamanho mínimo de toque | `apps/mobile/src/theme/` |
| Uma regra de negócio (quem pode ver ou fazer o quê) | `apps/api/src/<módulo>/<módulo>.service.ts` e os guards em `apps/api/src/common/` |
| O limiar de cor da pré-anotação | `apps/api/src/preanotacao/` |
| Uma tabela ou coluna do banco | `apps/api/prisma/schema.prisma`, gerando uma migração nova. As migrações do Prisma são a única fonte do esquema: não crie tabelas pelo painel do Supabase |
| O formato das marcações, o índice ou a concordância | `packages/shared/` (usado pelo app e pela API) |
| Versão do PostgreSQL, portas ou e-mail do ambiente local | `supabase/config.toml` (o `major_version` precisa ser igual ao do projeto na nuvem) |
| Uma variável de ambiente | `.env.example`, com comentário explicando o valor |

## 5. Mapa de navegação

As telas se agrupam como no Expo Router: uma pilha de autenticação e um grupo por papel. A seta pontilhada é a saída por logout ou sessão expirada, que vale para qualquer tela logada; telas com borda tracejada entram na fase 2.

```mermaid
flowchart TB
    Abrir(["Abrir o app"]) --> Sessao{"Sessão<br/>válida?"}
    Sessao -- não --> Auth
    Sessao -- sim --> Papel{"Papel do<br/>usuário"}
    Qualquer(["Qualquer tela<br/>com sessão"]) -.->|"logout ou<br/>sessão expirada"| Auth

    subgraph Auth["Autenticação"]
        direction LR
        Login["Login<br/>e-mail e senha"] --> Codigo["Código 2FA<br/>por e-mail"]
        Login --> Esqueci["Esqueci<br/>a senha"] --> Redefinir["Redefinir<br/>senha"]
    end
    Auth ==>|"código ok"| Papel

    Papel -->|avaliador| Aval
    Papel -->|validador| Val
    Papel -->|gestor| Gest
    Papel -->|admin| Adm

    subgraph Aval["Avaliador"]
        direction TB
        Pendentes["Aba Pendentes"] --> Anotacao["Anotação<br/>da imagem"]
        Andamento["Aba Em andamento"] --> Anotacao
        Avaliadas["Aba Avaliadas"] --> Historico["Histórico<br/>de versões"]
    end

    subgraph Val["Validador"]
        direction TB
        Fila["Fila de validação"] --> Comparar["Comparação<br/>das N análises"] --> Resultado["Registrar<br/>resultado"]
    end

    subgraph Gest["Gestor do projeto"]
        direction TB
        Painel["Painel de progresso"]
        Lotes["Lotes e imagens"] --> Atribuir["Atribuir a<br/>N avaliadores"]
        Analises["Análises do projeto"]
        Exportar["Exportação"]
        Labels["Labels"]
    end

    subgraph Adm["Administrador"]
        direction TB
        Usuarios["Usuários e papéis"]
        Projetos["Projetos e gestores"]
        Logs["Logs"]
    end

    classDef fase2 stroke-dasharray: 5 5
    class Andamento,Labels fase2
```

Quem tem mais de um papel troca de perfil pelo menu da conta, sem novo login.

## 6. Fluxos com a API

O fluxograma mostra por onde se passa; os diagramas de sequência mostram quem fala com quem e em que ordem, **incluindo os caminhos de erro**.

### 6.1 Login com segundo fator por e-mail (RF-01, RF-02, RF-37)

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuário
    participant App
    participant API as API NestJS
    participant DB as Banco Supabase
    participant Mail as E-mail SMTP

    U->>App: Informa e-mail e senha
    App->>+API: POST /auth/login
    API->>DB: Busca usuário ativo pelo e-mail
    DB-->>API: Usuário e hash da senha
    alt Senha correta
        API->>DB: Grava hash do código 2FA, válido por 10 min
        API->>Mail: Envia código de 6 dígitos
        API->>DB: Log LOGIN_SENHA_OK
        API-->>App: 200 + desafioId
        App-->>U: Pede o código recebido por e-mail
    else Senha errada ou usuário desativado
        API->>DB: Log LOGIN_FALHA
        API-->>App: 401 com mensagem genérica
        App-->>U: E-mail ou senha inválidos
    end
    deactivate API

    U->>App: Digita o código
    App->>+API: POST /auth/2fa/verificar
    API->>DB: Confere hash, validade e tentativas
    alt Código válido
        API->>DB: Cria a sessão e registra LOGIN_OK
        API-->>App: 200 + access token de 15 min + refresh token
        App->>App: Guarda a sessão (SecureStore no celular, cookie httpOnly na web)
        App-->>U: Abre a tela inicial do papel
    else Código errado, expirado ou 5ª tentativa
        API->>DB: Log 2FA_FALHA
        API-->>App: 401
        App-->>U: Código inválido, com opção de reenviar
    end
    deactivate API
```

### 6.2 Upload de imagens pelo gestor, com pré-anotação (RF-08, RF-11, RF-17, RF-18)

A pré-anotação é calculada uma única vez por versão da imagem e guardada, para que todos os avaliadores recebam exatamente a mesma sugestão ([D10](#12-decisões-de-arquitetura)).

```mermaid
sequenceDiagram
    autonumber
    actor G as Gestor
    participant App
    participant API as API NestJS
    participant ARQ as Cloudflare R2
    participant DB as Banco Supabase

    G->>App: Escolhe o lote e seleciona os arquivos
    loop Para cada arquivo
        App->>+API: POST /lotes/:id/imagens com o arquivo
        API->>API: Confere se o lote é de um projeto do gestor
        API->>API: Valida tipo e tamanho e calcula o SHA-256
        alt Hash ainda não cadastrado
            API->>ARQ: Grava o original, sem permissão de sobrescrita
            API->>ARQ: Grava cópia reduzida se passar de 4.096 px
            API->>DB: INSERT da imagem e da versão 1 com o hash
            API->>DB: Log UPLOAD
            API-->>App: 201
            API->>API: Calcula a pré-anotação por limiar de cor, em segundo plano
            API->>DB: Guarda a pré-anotação na versão da imagem
        else Mesmo hash já existe
            API-->>App: 409 duplicada, com o código da imagem existente
        end
        deactivate API
    end
    App-->>G: Resumo com enviadas, duplicadas e recusadas
```

### 6.3 Abrir uma imagem atribuída: cegamento, pré-anotação e URL assinada (RF-18, RF-27, RF-28, RNF-06)

É aqui que o cegamento é garantido: a busca já nasce filtrada pelo dono, e a imagem só é entregue por uma URL que expira.

```mermaid
sequenceDiagram
    autonumber
    actor A as Avaliador
    participant App
    participant API as API NestJS
    participant DB as Banco Supabase
    participant ARQ as Cloudflare R2

    A->>App: Toca numa imagem da aba Pendentes
    App->>+API: GET /analises/:id com o token
    API->>API: Guard valida o token e o papel AVALIADOR
    API->>DB: Busca análise com id = :id E avaliador_id = usuário do token
    alt A análise é do usuário
        DB-->>API: Análise e última versão das próprias marcações
        opt Análise ainda PENDENTE, sem nenhuma versão
            API->>DB: Lê a pré-anotação guardada na versão da imagem
        end
        API->>ARQ: Gera URL assinada da imagem, válida por 5 min
        API->>DB: Log ANALISE_ABERTA
        API-->>App: 200 + marcações (ou pré-anotação) + URL assinada
        App->>ARQ: GET da imagem pela URL assinada
        ARQ-->>App: Imagem com Cache-Control no-store
        App-->>A: Canvas com a imagem e as marcações
    else Análise de outro usuário ou inexistente
        DB-->>API: Nenhuma linha
        API->>DB: Log ACESSO_NEGADO
        API-->>App: 404, sem revelar se a análise existe
        App-->>A: Imagem não encontrada
    end
    deactivate API
```

No driver local de desenvolvimento, a própria API serve o arquivo depois de conferir a assinatura da URL; no R2, a URL é pré-assinada pela API S3 do Cloudflare.

### 6.4 Salvar e finalizar a análise: versionamento sem perda (RF-21, RF-33, RNF-05)

```mermaid
sequenceDiagram
    autonumber
    actor A as Avaliador
    participant App
    participant Local as Rascunho local
    participant API as API NestJS
    participant DB as Banco Supabase

    A->>App: Marca, corrige ou remove pontos, caixas e polígonos
    App->>Local: Grava o rascunho a cada alteração
    Note over App,Local: Autosave dispara 5 s depois da última alteração
    break Sem conexão com a API
        App-->>A: Indicador Não salvo e nova tentativa em 30 s
    end
    App->>+API: POST /analises/:id/versoes com marcações e versão base
    API->>DB: Confere dono, status e versão base, numa transação
    alt Versão base é a mais recente
        API->>DB: INSERT da nova versão com autor, data/hora e dispositivo
        API->>DB: INSERT no log ANALISE_SALVA
        API-->>App: 201 + número da versão
        App->>Local: Descarta o rascunho já salvo
        App-->>A: Indicador Salvo · v12
    else Outro aparelho salvou antes
        API-->>App: 409 + versão atual
        App-->>A: Mostra as duas versões e pergunta qual seguir
    end
    deactivate API

    A->>App: Toca em Finalizar análise e confirma
    App->>+API: POST /analises/:id/finalizar
    API->>DB: Versão FINALIZACAO, status FINALIZADA e log
    API-->>App: 200
    deactivate API
    App-->>A: A imagem sai de Pendentes e vai para Avaliadas
```

### 6.5 Comparação das análises e resultado (RF-30, RF-31, RF-32, RN-05, RN-08)

```mermaid
sequenceDiagram
    autonumber
    actor V as Validador
    participant App
    participant API as API NestJS
    participant DB as Banco Supabase

    V->>App: Abre uma imagem da fila de validação
    App->>+API: GET /validacao/imagens/:id
    API->>DB: Conta as análises finalizadas e lê o N do lote
    alt As N análises estão finalizadas e o validador não anotou a imagem
        DB-->>API: Versões finais das N análises
        API->>API: Troca os nomes por A, B, C e calcula índices e concordância
        API->>DB: Log COMPARACAO_ABERTA
        API-->>App: 200 + análises anônimas + métricas
        App-->>V: Análises lado a lado ou sobrepostas, com as métricas
    else Ainda falta análise, ou o validador também anotou
        API->>DB: Log ACESSO_NEGADO
        API-->>App: 403 com o motivo
        App-->>V: Imagem indisponível para validação
    end
    deactivate API

    V->>App: Escolhe uma análise ou monta o consenso, com justificativa
    App->>+API: POST /validacao/imagens/:id/resultado
    API->>DB: INSERT do resultado imutável, imagem VALIDADA e log
    API-->>App: 201
    deactivate API
    App-->>V: Imagem sai da fila
```

## 7. Ciclos de vida

Uma **análise** (o trabalho de um avaliador sobre uma imagem) passa por três estados:

```mermaid
stateDiagram-v2
    state "Pendente" as PENDENTE
    state "Em andamento" as EM_ANDAMENTO
    state "Finalizada" as FINALIZADA

    [*] --> PENDENTE: gestor atribui a imagem
    PENDENTE --> EM_ANDAMENTO: primeiro salvamento
    EM_ANDAMENTO --> FINALIZADA: avaliador finaliza
    FINALIZADA --> EM_ANDAMENTO: gestor reabre com justificativa (fase 2)
    FINALIZADA --> [*]

    note right of EM_ANDAMENTO
        Cada salvamento gera uma
        versão nova, sem mudar o estado
    end note
```

Uma **imagem** de um lote com N igual a 2 ou mais só vai para comparação quando as N análises estiverem finalizadas (RN-05). Com N igual a 1, ela termina quando a única análise é finalizada.

```mermaid
stateDiagram-v2
    state "Aguardando análises" as AGUARDANDO
    state "Pronta para comparação" as PRONTA
    state "Validada" as VALIDADA

    [*] --> AGUARDANDO: atribuída a N avaliadores
    AGUARDANDO --> AGUARDANDO: análise finalizada, faltam outras
    AGUARDANDO --> PRONTA: última das N análises finalizada
    PRONTA --> VALIDADA: validador registra o resultado
    VALIDADA --> [*]
```

## 8. Modelo de dados

O modelo está dividido em dois desenhos para continuar legível. No primeiro, o domínio da anotação. As colunas `*_por` e `autor_id` também apontam para `USUARIO`, mas essas ligações ficaram fora do desenho. As marcações referenciam a `LABEL` pelo id, dentro do JSON.

```mermaid
erDiagram
    USUARIO ||--o{ PROJETO : "gerencia"
    PROJETO ||--o{ LOTE : "contém"
    PROJETO ||--o{ LABEL : "define"
    LOTE ||--o{ IMAGEM : "agrupa"
    IMAGEM ||--|{ IMAGEM_VERSAO : "tem"
    IMAGEM ||--o{ ANALISE : "recebe N"
    USUARIO ||--o{ ANALISE : "anota"
    ANALISE ||--o{ ANALISE_VERSAO : "acumula"
    IMAGEM_VERSAO ||--o{ ANALISE_VERSAO : "é anotada em"
    IMAGEM ||--o| VALIDACAO : "termina em"
    USUARIO ||--o{ VALIDACAO : "registra"

    USUARIO {
        uuid id PK
        string nome
        string email UK
        string senha_hash "argon2id"
        string papeis "ADMIN, GESTOR, AVALIADOR, VALIDADOR"
        boolean ativo "desativa, nunca exclui"
        timestamp criado_em
    }
    PROJETO {
        uuid id PK
        string nome
        text descricao
        uuid gestor_id FK
        uuid criado_por FK
        timestamp criado_em
    }
    LOTE {
        uuid id PK
        uuid projeto_id FK
        string nome
        int avaliadores_por_imagem "N, padrão 3"
        timestamp criado_em
    }
    IMAGEM {
        uuid id PK
        uuid lote_id FK
        string codigo UK "anonimizado, ex. LT01-0042"
        string status "AGUARDANDO, PRONTA, VALIDADA"
        timestamp criado_em
    }
    IMAGEM_VERSAO {
        uuid id PK
        uuid imagem_id FK
        int numero
        string sha256 UK
        string chave_arquivo "objeto no bucket do R2"
        int largura_px
        int altura_px
        jsonb pre_anotacao "núcleos azul-claros sugeridos"
        uuid enviada_por FK
        timestamp enviada_em
    }
    ANALISE {
        uuid id PK
        uuid imagem_id FK
        uuid avaliador_id FK
        string status "PENDENTE, EM_ANDAMENTO, FINALIZADA"
        uuid atribuida_por FK
        timestamp atribuida_em
        timestamp finalizada_em
    }
    ANALISE_VERSAO {
        uuid id PK
        uuid analise_id FK
        int numero
        uuid imagem_versao_id FK
        uuid autor_id FK
        string tipo "AUTOSAVE, FINALIZACAO, REABERTURA, RESTAURACAO"
        jsonb marcacoes "snapshot completo"
        text observacao
        int total_reagentes
        int total_nao_reagentes
        string dispositivo "plataforma e versão do app"
        timestamp criada_em
    }
    LABEL {
        uuid id PK
        uuid projeto_id FK
        string nome
        string cor "hexadecimal"
        string simbolo "círculo, anel, quadrado"
        string papel_no_indice "POSITIVO, NEGATIVO, IGNORAR"
        boolean ativa
    }
    VALIDACAO {
        uuid id PK
        uuid imagem_id FK
        uuid validador_id FK
        string tipo "ESCOLHA, CONSENSO"
        uuid versao_escolhida_id FK
        jsonb marcacoes_consenso
        decimal indice_final
        jsonb metricas_concordancia
        text justificativa
        timestamp registrada_em
    }
```

No segundo, sessão, códigos de verificação e o log de auditoria:

```mermaid
erDiagram
    USUARIO ||--o{ SESSAO : "abre"
    USUARIO ||--o{ CODIGO_VERIFICACAO : "recebe"
    USUARIO ||--o{ LOG_AUDITORIA : "gera"

    USUARIO {
        uuid id PK
        string email UK
    }
    LOG_AUDITORIA {
        bigint id PK
        timestamp ocorrido_em
        uuid usuario_id FK
        uuid projeto_id FK "filtro do log do gestor"
        string acao "LOGIN_OK, UPLOAD, ANALISE_SALVA, ..."
        string entidade
        uuid entidade_id
        jsonb detalhes
        string ip
        string dispositivo
        string hash_encadeado "SHA-256 do registro anterior + atual"
    }
    SESSAO {
        uuid id PK
        uuid usuario_id FK
        string refresh_hash
        string dispositivo
        timestamp ultima_atividade_em
        timestamp expira_em
        timestamp revogada_em
    }
    CODIGO_VERIFICACAO {
        uuid id PK
        uuid usuario_id FK
        string finalidade "LOGIN_2FA, RECUPERAR_SENHA"
        string codigo_hash
        int tentativas
        timestamp expira_em
        timestamp usado_em
    }
```

As marcações de cada versão (e a pré-anotação de cada imagem) ficam num JSONB com este formato, definido uma vez em `packages/shared` e usado pelo app e pela API. As coordenadas são **pixels da imagem original**, nunca da tela ([D5](#12-decisões-de-arquitetura)):

```ts
type Origem = 'manual' | 'pre_anotacao' | 'pre_anotacao_editada'; // premissa da Q2

type Marcacao =
  | { id: string; tipo: 'ponto'; labelId: string; origem: Origem; x: number; y: number }
  | { id: string; tipo: 'retangulo'; labelId: string; origem: Origem; x: number; y: number; largura: number; altura: number }
  | { id: string; tipo: 'poligono'; labelId: string; origem: Origem; pontos: Array<[number, number]> };
```

Garantias que o próprio banco impõe, além da aplicação:

| Garantia | Como | Requisito |
| --- | --- | --- |
| Uma análise por par (imagem, avaliador) | `UNIQUE (imagem_id, avaliador_id)` em `ANALISE` | RF-26 |
| Cada imagem recebe exatamente N avaliadores | Verificação no service e trigger que compara a contagem com `LOTE.avaliadores_por_imagem` | RF-29 |
| Gestor não avalia no próprio projeto | Verificação no service na atribuição e trigger que compara `avaliador_id` com `PROJETO.gestor_id` | RN-07 |
| Versões numeradas e imutáveis | `UNIQUE (analise_id, numero)`; o usuário de banco da API não tem `UPDATE` nem `DELETE` em `ANALISE_VERSAO` | RF-33 |
| Log que ninguém altera | Trigger que rejeita `UPDATE` e `DELETE`, permissão só de `INSERT` e `SELECT` e hash encadeado entre registros | RF-38 |
| Original imutável | `sha256` único e objeto gravado uma única vez no R2, sem rota de sobrescrita | RF-11 |
| Só a API chega aos dados | RLS ligado em todas as tabelas, sem nenhuma política, e Data API do Supabase desativada: o PostgREST não lê nem grava nada | RF-28 |

## 9. API REST

Todas as rotas ficam sob o prefixo `/api/v1` (omitido abaixo), recebem e devolvem JSON e usam datas ISO 8601 em UTC. Erros seguem o formato `{ "codigo": "...", "mensagem": "..." }`. "Gestor" sempre significa o gestor **do projeto** daquele recurso.

| Método | Rota | Quem pode | Requisitos |
| --- | --- | --- | --- |
| `POST` | `/auth/login` | Público | RF-01 |
| `POST` | `/auth/2fa/verificar` | Público, com o `desafioId` do login | RF-02 |
| `POST` | `/auth/refresh`, `/auth/logout` | Sessão ativa | RF-05 |
| `POST` | `/auth/senha/esqueci`, `/auth/senha/redefinir` | Público | RF-03 |
| `GET` `POST` `PATCH` | `/usuarios`, `/usuarios/:id` | Admin | RF-04, RF-06, RF-07 |
| `GET` `POST` `PATCH` | `/projetos`, `/projetos/:id` | Criar e designar gestor: admin · ler: admin e gestor | RF-09 |
| `GET` `POST` | `/projetos/:id/lotes` | Gestor | RF-09, RF-29 |
| `POST` | `/lotes/:id/imagens` | Gestor | RF-08, RF-11, RF-17 |
| `POST` | `/atribuicoes` | Gestor | RF-10, RF-29 |
| `GET` | `/me/analises?status=` | Avaliador | RF-22 a RF-24 |
| `GET` | `/analises/:id` | Dono da análise | RF-18, RF-27, RF-28 |
| `POST` | `/analises/:id/versoes` | Dono da análise | RF-21, RF-33 |
| `POST` | `/analises/:id/finalizar` | Dono da análise | RF-21 |
| `GET` | `/analises/:id/versoes`, `/analises/:id/versoes/:n` | Dono, validador e gestor | RF-34 |
| `POST` | `/analises/:id/versoes/:n/restaurar` | Dono da análise | RF-34 |
| `POST` | `/analises/:id/reabrir` | Gestor (fase 2) | RF-42 |
| `GET` | `/projetos/:id/progresso` | Gestor | RF-25 |
| `GET` `POST` `PATCH` | `/projetos/:id/labels` | Leitura: todos do projeto · escrita: gestor (fase 2) | RF-12, RF-41 |
| `GET` | `/validacao/fila` | Validador | RF-30 |
| `GET` | `/validacao/imagens/:id` | Validador e gestor | RF-30, RF-31 |
| `POST` | `/validacao/imagens/:id/resultado` | Validador | RF-32 |
| `GET` | `/auditoria?usuario=&imagem=&de=&ate=` | Admin (tudo) e gestor (só o próprio projeto) | RF-39 |
| `GET` | `/exportacao/lotes/:id?formato=` (`labelme` ou `csv`) | Gestor | RF-40 |

Nenhuma rota de `DELETE` existe para usuários, projetos, análises, versões ou logs (RN-06).

## 10. Segurança e cegamento

O cegamento (RF-26 a RF-28) é garantido em quatro níveis, do mais externo ao mais interno:

1. **Quem é você.** Token de acesso JWT de 15 min e refresh token rotativo, guardado só como hash na tabela `SESSAO`. A sessão expira depois de 30 min sem atividade (RF-05) e pode ser revogada.
2. **O que você pode fazer.** Um guard de papel protege toda rota; rota sem papel declarado é negada por padrão.
3. **O que você pode ver.** Todo repositório que busca análises recebe o id do usuário e filtra por ele; toda consulta do gestor é filtrada pelos projetos que ele gerencia. As respostas para o avaliador usam DTOs que nem têm campos de outros usuários, e a comparação entrega as análises como A, B, C, sem nomes. Pedir a análise de outra pessoa devolve **404, e não 403**, para não confirmar que ela existe.
4. **Como provamos.** A bateria e2e de cegamento ([cenários críticos](01-visao-e-requisitos.md#6-cenários-críticos)) roda no CI a cada pull request.

### O Supabase e o R2 não são portas de entrada

Todo projeto Supabase publica as tabelas do esquema `public` numa API REST automática (Data API, via PostgREST). Se isso ficasse aberto, alguém poderia ler as análises sem passar pelas regras da nossa API e furar o cegamento. Por isso:

- a **Data API fica desativada** no projeto, e o **RLS fica ligado em todas as tabelas, sem nenhuma política**, como segunda barreira caso ela seja reativada por engano;
- o **app não recebe nenhuma chave do Supabase** (nem `anon`, nem `service_role`) **nem do R2**; só a API tem a string de conexão e as credenciais do bucket, no `.env` do servidor;
- o bucket do R2 é **privado**, sem domínio público: uma imagem só é lida por URL pré-assinada de 5 min, gerada pela API depois de conferir o acesso;
- a API se conecta com o usuário de banco `ki67_api`, que não tem `UPDATE` nem `DELETE` no log e nas versões; o usuário `postgres` só roda migrações;
- o Supabase Auth não é usado: login, 2FA por e-mail e sessão ficam na API ([D3](#12-decisões-de-arquitetura)).

Também valem: senhas com argon2id; no máximo 5 tentativas de login ou de código a cada 15 min; mensagens de erro genéricas; HTTPS obrigatório fora do ambiente local; CORS só para a origem do app web; cabeçalhos de segurança com `helmet`; respostas de imagem com `Cache-Control: no-store`; e log com trigger, permissões e hash encadeado.

### Sessão em cada plataforma

| | Android e iOS | Web |
| --- | --- | --- |
| Token de acesso (15 min) | Memória | Memória |
| Refresh token | SecureStore (Keychain no iOS, Keystore no Android) | Cookie `httpOnly`, `Secure`, `SameSite=Strict`, definido pela API |
| Rascunho da análise aberta | AsyncStorage | AsyncStorage (localStorage do navegador) |
| No logout | Apaga a sessão e o rascunho | A API invalida o cookie e o app apaga o rascunho |

## 11. Bibliotecas e o papel de cada uma

Versões fixadas pelo Expo SDK 57 (`npx expo install` escolhe as compatíveis) e as estáveis mais recentes para a API.

| Biblioteca | Versão | Onde | Papel no Ki67 |
| --- | --- | --- | --- |
| Expo SDK | 57 | app | Toolchain, módulos nativos e build para web, Android e iOS a partir do mesmo código |
| React Native + React Native Web | 0.86 / 0.21 | app | Componentes nativos no celular e HTML na web |
| Expo Router | 57 | app | Rotas por arquivo, sobre o React Navigation; URLs reais na web e grupos de telas por papel |
| @shopify/react-native-skia | 2.6 | app | Desenha a imagem e milhares de pontos, caixas e polígonos na GPU; na web usa CanvasKit (WebAssembly) |
| Gesture Handler + Reanimated | 2.32 / 4.5 | app | Pinça, pan, arrasto de caixas e toque longo processados fora da thread de JavaScript, sem engasgos |
| Zustand | 5.0 | app | Estado do editor (marcações, ferramenta e label ativas, pilha de desfazer e refazer) e da sessão |
| TanStack Query | 5 | app | Cache, nova tentativa e invalidação dos dados vindos da API |
| expo-secure-store | 57 | app | Refresh token no Keychain e no Keystore |
| AsyncStorage | 2.2 | app | Rascunho da análise aberta |
| expo-document-picker | 57 | app | Seletor de arquivos do sistema para o upload, sem pedir permissão |
| Zod | 4 | shared | Schemas das marcações e das requisições, validados com o mesmo código no app e na API |
| NestJS | 12 | api | Módulos, guards de papel, interceptors de auditoria e injeção de dependência |
| Prisma ORM | 7.10 | api | Schema do banco, migrações versionadas e consultas tipadas |
| Supabase (PostgreSQL gerenciado) | PostgreSQL 17 | banco | Banco na nuvem com backups, painel e região em São Paulo |
| Supabase CLI | 2 | dev | Sobe o mesmo stack local com `npx supabase start`: PostgreSQL, Studio e Mailpit |
| Cloudflare R2 | — | imagens | Bucket privado das imagens, compatível com a API S3 e sem cobrança de tráfego de saída |
| AWS SDK v3 (`client-s3`) | 3 | api | Cliente S3 que fala com o R2: grava os originais e gera as URLs pré-assinadas |
| argon2 | 0.45 | api | Hash das senhas |
| sharp | 0.35 | api | Lê dimensões, metadados e pixels: gera a cópia reduzida e alimenta a pré-anotação por limiar de cor |
| Nodemailer | 10 | api | Envio do código 2FA e do link de recuperação por SMTP |
| Jest, jest-expo, Testing Library, Supertest | 30 / 57 / 14 / 7 | todos | Testes de unidade, de componentes e e2e da API |

## 12. Decisões de arquitetura

| # | Decisão | Por quê | Alternativas descartadas |
| --- | --- | --- | --- |
| D1 | Expo + React Native, com React Native Web no navegador | Uma base para três plataformas (RNF-01), e é a stack da disciplina | Flutter (bom canvas, mas fora da stack da disciplina); PWA pura (gestos e armazenamento seguro limitados no iOS) |
| D2 | Canvas com Skia | Milhares de marcações na GPU e o mesmo código na web (RNF-03) | `react-native-svg` (um elemento por marcação pesa acima de algumas centenas); WebView com canvas HTML (duas bases de código de anotação) |
| D3 | Regras de negócio numa API própria em NestJS; o Supabase entra só como banco | 2FA por e-mail, cegamento, versões e log num lugar só e testável (RF-02, RF-28) | App falando direto com o Supabase (Auth + RLS): o 2FA por e-mail não é nativo no Supabase Auth e as regras de cegamento ficariam espalhadas em políticas de banco; Firebase (mesmos motivos, e banco NoSQL) |
| D4 | Cada versão é um snapshot imutável das marcações (JSONB) | Histórico, restauração e diff simples; nada é sobrescrito (RF-33 a RF-35) | Tabela de marcações com `UPDATE` (perde histórico); event sourcing (complexo demais para o prazo) |
| D5 | Coordenadas em pixels da imagem original | Não dependem de tela nem de zoom, o que garante a paridade (RNF-02) e a exportação direta para o formato do Labelme | Coordenadas relativas à tela |
| D6 | Log no próprio PostgreSQL, com trigger, permissões e hash encadeado | O somente-inclusão é garantido pelo banco, não só pela aplicação (RF-38) | Arquivo de log no servidor (fácil de editar); serviço externo (custo e dependência) |
| D7 | Imagens no Cloudflare R2, atrás de uma interface de armazenamento (disco local em desenvolvimento) | Bucket privado com URL pré-assinada pela API S3, sem cobrança de tráfego de saída, o que importa para imagens grandes abertas várias vezes; o desenvolvimento roda sem conta em nuvem | Supabase Storage (concentraria banco e arquivos num só plano gratuito); disco do servidor da API (backup e escala por conta do grupo) |
| D8 | Monorepo com npm workspaces e pacote `shared` | Tipos, schemas, índice e concordância iguais no app e na API | Repositórios separados (tipos duplicados e versões descasadas) |
| D9 | Banco PostgreSQL gerenciado no Supabase | PostgreSQL completo, então triggers, permissões e JSONB (D4, D6) continuam valendo; backups, painel e região em São Paulo prontos; plano gratuito para o semestre; o Supabase CLI sobe o mesmo banco em qualquer máquina | PostgreSQL em container próprio (instalação, backup e atualização por conta do grupo); Firebase (NoSQL, sem joins nem triggers) |
| D10 | Pré-anotação calculada uma vez por versão da imagem, no upload, e guardada | Todos os avaliadores recebem exatamente a mesma sugestão, o que permite medir o viés dela (Q2), e abrir a imagem não espera processamento | Calcular no aparelho a cada abertura (resultados diferentes por plataforma e lento no celular) |
| D11 | Papel de gestor do projeto separado do administrador | Quem conduz o estudo (patologista líder ou pesquisador principal) organiza o próprio projeto, e o administrador do sistema não precisa ver nenhuma anotação | Administrador fazendo tudo (concentra acesso e não escala para vários estudos) |

---

| Versão | Data | Mudança |
| --- | --- | --- |
| 0.1 | 07/10/2026 | Arquitetura inicial: camadas, navegação, sequências, ciclos de vida, dados, API e decisões. |
| 0.2 | 07/10/2026 | Banco passa a ser o Supabase (D9): visão geral, pastas, segurança da Data API e RLS, bibliotecas e D3/D7 revistas. |
| 0.3 | 07/10/2026 | Retorno do professor: papéis de avaliador e gestor (D11), projetos e N avaliadores por lote, pré-anotação no upload (D10), sequência de comparação, imagens no Cloudflare R2 (D7) e COCO removido. |
