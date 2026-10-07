# 02 · Arquitetura

> **Documento vivo.** Versão 0.1, de 07/10/2026. Ele responde a uma pergunta: **onde eu mexo para alterar isto?** Os requisitos citados (RF, RNF) estão em [01 · Visão e requisitos](01-visao-e-requisitos.md).

**Neste documento:** [1. Visão geral](#1-visão-geral) · [2. Camadas do app](#2-camadas-do-app) · [3. Camadas da API](#3-camadas-da-api) · [4. Pastas](#4-estrutura-de-pastas) · [5. Navegação](#5-mapa-de-navegação) · [6. Sequências](#6-fluxos-com-a-api) · [7. Ciclos de vida](#7-ciclos-de-vida) · [8. Dados](#8-modelo-de-dados) · [9. API REST](#9-api-rest) · [10. Segurança](#10-segurança-e-cegamento) · [11. Bibliotecas](#11-bibliotecas-e-o-papel-de-cada-uma) · [12. Decisões](#12-decisões-de-arquitetura)

---

## 1. Visão geral

Um único app Expo roda na web, no Android e no iOS e fala com uma API REST própria. Administrador, patologista e validador usam o mesmo app: o que muda entre eles são as telas e o que a API deixa cada um ver. A API é a única que acessa o banco, os arquivos de imagem e o e-mail, e é nela que ficam as regras de cegamento, versionamento e log.

```mermaid
flowchart LR
    subgraph App["App Ki67 · uma base de código Expo"]
        WEB["Web<br/>navegador"]
        AND["Android"]
        IOS["iOS"]
    end

    subgraph Servidor["Servidor · containers"]
        API["API REST<br/>NestJS"]
        DB[("PostgreSQL<br/>dados, versões e log")]
        ARQ[("Imagens<br/>armazenamento privado")]
    end

    SMTP["E-mail SMTP<br/>código 2FA e<br/>recuperação de senha"]

    WEB & AND & IOS -->|"HTTPS + JSON"| API
    API --> DB
    API --> ARQ
    API --> SMTP
    App -.->|"imagem por URL<br/>assinada de 5 min"| ARQ
```

Em desenvolvimento, PostgreSQL e Mailpit (que captura os e-mails) sobem com `docker compose`, e as imagens ficam numa pasta privada da API. Em produção, o mesmo código usa qualquer armazenamento compatível com S3 ([D7](#12-decisões-de-arquitetura)).

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
| Navegação | `app/_layout.tsx` e grupos `(auth)`, `(patologista)`, `(validador)`, `(admin)` | Rotas, abas e redirecionamento de quem está sem sessão ou sem papel | A guarda de rota é conveniência; quem bloqueia de verdade é a API (RF-28) |
| Estado | `src/state/` (Zustand) e `src/queries/` (TanStack Query) | Sessão, editor (marcações, label ativa, desfazer e refazer) e cache dos dados da API | Fonte única da verdade para as telas |
| Serviços | `src/services/` | Chamadas HTTP validadas com os schemas de `packages/shared`, renovação do token e tratamento de erro | Única camada que fala com a API |
| Armazenamento local | `src/storage/` | Sessão (SecureStore ou cookie) e rascunho da análise aberta | Nunca guarda imagem nem dado de outro usuário |

## 3. Camadas da API

```mermaid
flowchart LR
    REQ(["Requisição HTTPS"]) --> G["Guards<br/>JWT, papel e<br/>limite de tentativas"]
    G --> C["Controllers<br/>rotas e validação<br/>com Zod"]
    C --> SV["Services<br/>regras de negócio,<br/>cegamento e versões"]
    SV --> RP["Repositórios<br/>Prisma"]
    RP --> DB[("PostgreSQL")]
    SV --> ST["StorageService<br/>disco local ou S3"]
    SV --> AU["AuditoriaService<br/>log somente-inclusão"]
    AU --> DB
    SV --> MAIL["MailService<br/>Nodemailer"]
```

A API é dividida em módulos NestJS, um por área do domínio:

| Módulo | Responsabilidade | Requisitos |
| --- | --- | --- |
| `auth` | Login, código 2FA, sessão, recuperação de senha | RF-01 a RF-05 |
| `usuarios` | Cadastro, papéis e desativação | RF-06, RF-07 |
| `imagens` | Lotes, upload, hash, cópia reduzida e URL assinada | RF-08, RF-09, RF-11, RF-36 |
| `analises` | Atribuição, abas, versões, finalização, histórico e restauração | RF-10, RF-12 a RF-24, RF-26 a RF-28, RF-33 a RF-35 |
| `labels` | Labels e papel de cada uma no índice | RF-12, RF-41 |
| `validacao` | Comparação das 3 análises, concordância e resultado | RF-29 a RF-32 |
| `auditoria` | Gravação e consulta do log | RF-37 a RF-39 |
| `exportacao` | Labelme, COCO e CSV | RF-40 |
| `painel` | Progresso por usuário e por lote | RF-25 |

## 4. Estrutura de pastas

O repositório é um monorepo com *npm workspaces*. O código entra a partir da Sprint 0 ([03 · Planejamento](03-planejamento.md)); esta é a estrutura planejada.

```text
ki67/
├── apps/
│   ├── mobile/                     # app Expo: web, Android e iOS
│   │   ├── app/                    # rotas do Expo Router (cada arquivo é uma tela)
│   │   │   ├── _layout.tsx         # provedores e guarda de sessão
│   │   │   ├── (auth)/             # login, código 2FA, recuperar senha
│   │   │   ├── (patologista)/      # abas Pendentes e Avaliadas
│   │   │   ├── (validador)/        # fila e comparação (fase 2)
│   │   │   ├── (admin)/            # painel, usuários, lotes, logs, exportação
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
│       │   ├── auth/  usuarios/  imagens/  analises/  labels/
│       │   ├── validacao/  auditoria/  exportacao/  painel/
│       │   └── common/             # guards, interceptors, filtros de erro
│       ├── prisma/                 # schema.prisma, migrações e seed
│       └── test/                   # testes e2e, incluindo a bateria de cegamento
├── packages/
│   └── shared/                     # tipos, schemas Zod, cálculo do índice, formatos de exportação
├── docs/                           # esta documentação
├── docker-compose.yml              # PostgreSQL e Mailpit para desenvolvimento
├── .env.example                    # variáveis de ambiente, sem segredos
└── package.json                    # workspaces e scripts da raiz
```

### Onde eu mexo para alterar isto?

| Quero alterar... | Mexo em... |
| --- | --- |
| Uma tela ou a navegação | `apps/mobile/app/` (cada arquivo é uma rota) |
| Um componente visual reutilizável | `apps/mobile/src/components/` |
| O desenho, os gestos ou as ferramentas do canvas | `apps/mobile/src/features/anotacao/` |
| Uma chamada à API | `apps/mobile/src/services/` (a tela nunca usa `fetch` direto) |
| O que fica salvo no aparelho | `apps/mobile/src/storage/` |
| Cores, fontes e tamanho mínimo de toque | `apps/mobile/src/theme/` |
| Uma regra de negócio (quem pode ver ou fazer o quê) | `apps/api/src/<módulo>/<módulo>.service.ts` e os guards em `apps/api/src/common/` |
| Uma tabela ou coluna do banco | `apps/api/prisma/schema.prisma`, gerando uma migração nova |
| O formato das marcações ou o cálculo do índice | `packages/shared/` (usado pelo app e pela API) |
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

    Papel -->|patologista| Pat
    Papel -->|validador| Val
    Papel -->|admin| Adm

    subgraph Pat["Patologista"]
        direction TB
        Pendentes["Aba Pendentes"] --> Anotacao["Anotação<br/>da imagem"]
        Andamento["Aba Em andamento"] --> Anotacao
        Avaliadas["Aba Avaliadas"] --> Historico["Histórico<br/>de versões"]
    end

    subgraph Val["Validador"]
        direction TB
        Fila["Fila de validação"] --> Comparar["Comparação<br/>das 3 análises"] --> Resultado["Registrar<br/>resultado"]
    end

    subgraph Adm["Administrador"]
        direction TB
        Painel["Painel de progresso"]
        Usuarios["Usuários e papéis"]
        Lotes["Lotes e imagens"] --> Atribuir["Atribuir a<br/>patologistas"]
        Logs["Logs"]
        Exportar["Exportação"]
    end

    classDef fase2 stroke-dasharray: 5 5
    class Andamento,Fila,Comparar,Resultado fase2
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
    participant DB as PostgreSQL
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

### 6.2 Abrir uma imagem atribuída: cegamento e URL assinada (RF-27, RF-28, RNF-06)

É aqui que o cegamento é garantido: a busca já nasce filtrada pelo dono, e a imagem só é entregue por uma URL que expira.

```mermaid
sequenceDiagram
    autonumber
    actor P as Patologista
    participant App
    participant API as API NestJS
    participant DB as PostgreSQL
    participant ARQ as Armazenamento

    P->>App: Toca numa imagem da aba Pendentes
    App->>+API: GET /analises/:id com o token
    API->>API: Guard valida o token e o papel PATOLOGISTA
    API->>DB: Busca análise com id = :id E patologista_id = usuário do token
    alt A análise é do usuário
        DB-->>API: Análise e última versão das próprias marcações
        API->>ARQ: Gera URL assinada da imagem, válida por 5 min
        API->>DB: Log ANALISE_ABERTA
        API-->>App: 200 + marcações + URL assinada
        App->>ARQ: GET da imagem pela URL assinada
        ARQ-->>App: Imagem com Cache-Control no-store
        App-->>P: Canvas com a imagem e as marcações
    else Análise de outro usuário ou inexistente
        DB-->>API: Nenhuma linha
        API->>DB: Log ACESSO_NEGADO
        API-->>App: 404, sem revelar se a análise existe
        App-->>P: Imagem não encontrada
    end
    deactivate API
```

No driver local, a própria API serve o arquivo depois de conferir a assinatura da URL; no S3, a URL é pré-assinada pelo provedor.

### 6.3 Salvar e finalizar a análise: versionamento sem perda (RF-21, RF-33, RNF-05)

```mermaid
sequenceDiagram
    autonumber
    actor P as Patologista
    participant App
    participant Local as Rascunho local
    participant API as API NestJS
    participant DB as PostgreSQL

    P->>App: Marca, corrige ou remove núcleos
    App->>Local: Grava o rascunho a cada alteração
    Note over App,Local: Autosave dispara 5 s depois da última alteração
    break Sem conexão com a API
        App-->>P: Indicador Não salvo e nova tentativa em 30 s
    end
    App->>+API: POST /analises/:id/versoes com marcações e versão base
    API->>DB: Confere dono, status e versão base, numa transação
    alt Versão base é a mais recente
        API->>DB: INSERT da nova versão com autor, data/hora e dispositivo
        API->>DB: INSERT no log ANALISE_SALVA
        API-->>App: 201 + número da versão
        App->>Local: Descarta o rascunho já salvo
        App-->>P: Indicador Salvo · v12
    else Outro aparelho salvou antes
        API-->>App: 409 + versão atual
        App-->>P: Mostra as duas versões e pergunta qual seguir
    end
    deactivate API

    P->>App: Toca em Finalizar análise e confirma
    App->>+API: POST /analises/:id/finalizar
    API->>DB: Versão FINALIZACAO, status FINALIZADA e log
    API-->>App: 200
    deactivate API
    App-->>P: A imagem sai de Pendentes e vai para Avaliadas
```

### 6.4 Upload de imagens pelo admin (RF-08, RF-11)

```mermaid
sequenceDiagram
    autonumber
    actor A as Admin
    participant App
    participant API as API NestJS
    participant ARQ as Armazenamento
    participant DB as PostgreSQL

    A->>App: Escolhe o lote e seleciona os arquivos
    loop Para cada arquivo
        App->>+API: POST /lotes/:id/imagens com o arquivo
        API->>API: Valida tipo e tamanho e calcula o SHA-256
        alt Hash ainda não cadastrado
            API->>ARQ: Grava o original, sem permissão de sobrescrita
            API->>ARQ: Grava cópia reduzida se passar de 4.096 px
            API->>DB: INSERT da imagem e da versão 1 com o hash
            API->>DB: Log UPLOAD
            API-->>App: 201
        else Mesmo hash já existe
            API-->>App: 409 duplicada, com o código da imagem existente
        end
        deactivate API
    end
    App-->>A: Resumo com enviadas, duplicadas e recusadas
```

## 7. Ciclos de vida

Uma **análise** (o trabalho de um patologista sobre uma imagem) passa por três estados:

```mermaid
stateDiagram-v2
    state "Pendente" as PENDENTE
    state "Em andamento" as EM_ANDAMENTO
    state "Finalizada" as FINALIZADA

    [*] --> PENDENTE: admin atribui a imagem
    PENDENTE --> EM_ANDAMENTO: primeiro salvamento
    EM_ANDAMENTO --> FINALIZADA: patologista finaliza
    FINALIZADA --> EM_ANDAMENTO: admin reabre com justificativa (fase 2)
    FINALIZADA --> [*]

    note right of EM_ANDAMENTO
        Cada salvamento gera uma
        versão nova, sem mudar o estado
    end note
```

Uma **imagem de validação** só vai para comparação quando as três análises estiverem finalizadas (RN-05):

```mermaid
stateDiagram-v2
    state "Aguardando análises" as AGUARDANDO
    state "Pronta para comparação" as PRONTA
    state "Validada" as VALIDADA

    [*] --> AGUARDANDO: atribuída a 3 patologistas
    AGUARDANDO --> AGUARDANDO: análise finalizada, faltam outras
    AGUARDANDO --> PRONTA: 3ª análise finalizada
    PRONTA --> VALIDADA: validador registra o resultado
    VALIDADA --> [*]
```

## 8. Modelo de dados

O modelo está dividido em dois desenhos para continuar legível. No primeiro, o domínio da anotação; as colunas `*_por` e `autor_id` também apontam para `USUARIO`, mas essas ligações ficaram fora do desenho. `LABEL` não tem ligação desenhada porque é referenciada por id dentro do JSON das marcações.

```mermaid
erDiagram
    LOTE ||--o{ IMAGEM : "agrupa"
    IMAGEM ||--|{ IMAGEM_VERSAO : "tem"
    IMAGEM ||--o{ ANALISE : "recebe"
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
        string papeis "ADMIN, PATOLOGISTA, VALIDADOR"
        boolean ativo "desativa, nunca exclui"
        timestamp criado_em
    }
    LOTE {
        uuid id PK
        string nome
        boolean exige_validacao "3 patologistas por imagem"
        uuid criado_por FK
        timestamp criado_em
    }
    IMAGEM {
        uuid id PK
        uuid lote_id FK
        string codigo UK "anonimizado, ex. LT01-0042"
        timestamp criado_em
    }
    IMAGEM_VERSAO {
        uuid id PK
        uuid imagem_id FK
        int numero
        string sha256 UK
        string chave_arquivo "caminho no armazenamento"
        int largura_px
        int altura_px
        uuid enviada_por FK
        timestamp enviada_em
    }
    ANALISE {
        uuid id PK
        uuid imagem_id FK
        uuid patologista_id FK
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
        string nome UK
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

As marcações de cada versão ficam num JSONB com este formato, definido uma vez em `packages/shared` e usado pelo app e pela API. As coordenadas são **pixels da imagem original**, nunca da tela ([D5](#12-decisões-de-arquitetura)):

```ts
type Origem = 'manual' | 'pre_anotacao' | 'pre_anotacao_editada'; // premissa da Q2

type Marcacao =
  | { id: string; tipo: 'ponto'; labelId: string; origem: Origem; x: number; y: number }
  // fase 2:
  | { id: string; tipo: 'retangulo'; labelId: string; origem: Origem; x: number; y: number; largura: number; altura: number }
  | { id: string; tipo: 'poligono'; labelId: string; origem: Origem; pontos: Array<[number, number]> };
```

Garantias que o próprio banco impõe, além da aplicação:

| Garantia | Como | Requisito |
| --- | --- | --- |
| Uma análise por par (imagem, patologista) | `UNIQUE (imagem_id, patologista_id)` em `ANALISE` | RF-26 |
| Versões numeradas e imutáveis | `UNIQUE (analise_id, numero)`; o usuário de banco da API não tem `UPDATE` nem `DELETE` em `ANALISE_VERSAO` | RF-33 |
| Log que ninguém altera | Trigger que rejeita `UPDATE` e `DELETE`, permissão só de `INSERT` e `SELECT` e hash encadeado entre registros | RF-38 |
| Original imutável | `sha256` único e arquivo gravado uma única vez, sem rota de sobrescrita | RF-11 |
| No máximo 3 análises por imagem de validação | Verificação no service e trigger de contagem | RF-29 |

## 9. API REST

Todas as rotas ficam sob o prefixo `/api/v1` (omitido abaixo), recebem e devolvem JSON e usam datas ISO 8601 em UTC. Erros seguem o formato `{ "codigo": "...", "mensagem": "..." }`.

| Método | Rota | Quem pode | Requisitos |
| --- | --- | --- | --- |
| `POST` | `/auth/login` | Público | RF-01 |
| `POST` | `/auth/2fa/verificar` | Público, com o `desafioId` do login | RF-02 |
| `POST` | `/auth/refresh`, `/auth/logout` | Sessão ativa | RF-05 |
| `POST` | `/auth/senha/esqueci`, `/auth/senha/redefinir` | Público | RF-03 |
| `GET` `POST` `PATCH` | `/usuarios`, `/usuarios/:id` | Admin | RF-04, RF-06, RF-07 |
| `GET` `POST` | `/lotes`, `/lotes/:id/imagens` | Admin | RF-08, RF-09, RF-11 |
| `POST` | `/atribuicoes` | Admin | RF-10 |
| `GET` | `/me/analises?status=` | Patologista | RF-22 a RF-24 |
| `GET` | `/analises/:id` | Dono da análise | RF-27, RF-28 |
| `POST` | `/analises/:id/versoes` | Dono da análise | RF-21, RF-33 |
| `POST` | `/analises/:id/finalizar` | Dono da análise | RF-21 |
| `GET` | `/analises/:id/versoes`, `/analises/:id/versoes/:n` | Dono, validador e admin | RF-34 |
| `POST` | `/analises/:id/versoes/:n/restaurar` | Dono da análise | RF-34 |
| `POST` | `/analises/:id/reabrir` | Admin (fase 2) | RF-42 |
| `GET` | `/painel/progresso` | Admin | RF-25 |
| `GET` `POST` `PATCH` | `/labels` | Leitura: todos · escrita: admin | RF-12, RF-41 |
| `GET` | `/validacao/imagens/:id` | Validador e admin (fase 2) | RF-30, RF-31 |
| `POST` | `/validacao/imagens/:id/resultado` | Validador (fase 2) | RF-32 |
| `GET` | `/auditoria?usuario=&imagem=&de=&ate=` | Admin | RF-39 |
| `GET` | `/exportacao/lotes/:id?formato=` (`labelme`, `coco` ou `csv`) | Admin | RF-40 |

Nenhuma rota de `DELETE` existe para usuários, análises, versões ou logs (RN-06).

## 10. Segurança e cegamento

O cegamento (RF-26 a RF-28) é garantido em quatro níveis, do mais externo ao mais interno:

1. **Quem é você.** Token de acesso JWT de 15 min e refresh token rotativo, guardado só como hash na tabela `SESSAO`. A sessão expira depois de 30 min sem atividade (RF-05) e pode ser revogada.
2. **O que você pode fazer.** Um guard de papel protege toda rota; rota sem papel declarado é negada por padrão.
3. **O que você pode ver.** Todo repositório que busca análises recebe o id do usuário e filtra por ele. As respostas para o patologista usam DTOs que nem têm campos de outros usuários. Pedir a análise de outra pessoa devolve **404, e não 403**, para não confirmar que ela existe.
4. **Como provamos.** A bateria e2e de cegamento ([cenários críticos](01-visao-e-requisitos.md#6-cenários-críticos)) roda no CI a cada pull request.

Também valem: senhas com argon2id; no máximo 5 tentativas de login ou de código a cada 15 min; mensagens de erro genéricas; HTTPS obrigatório fora do ambiente local; CORS só para a origem do app web; cabeçalhos de segurança com `helmet`; imagens privadas servidas por URL assinada de 5 min com `Cache-Control: no-store`; e log com trigger, permissões e hash encadeado.

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
| @shopify/react-native-skia | 2.6 | app | Desenha a imagem e milhares de marcações na GPU; na web usa CanvasKit (WebAssembly) |
| Gesture Handler + Reanimated | 2.32 / 4.5 | app | Pinça, pan e toque longo processados fora da thread de JavaScript, sem engasgos |
| Zustand | 5.0 | app | Estado do editor (marcações, label ativa, pilha de desfazer e refazer) e da sessão |
| TanStack Query | 5 | app | Cache, nova tentativa e invalidação dos dados vindos da API |
| expo-secure-store | 57 | app | Refresh token no Keychain e no Keystore |
| AsyncStorage | 2.2 | app | Rascunho da análise aberta |
| expo-document-picker | 57 | app | Seletor de arquivos do sistema para o upload, sem pedir permissão |
| Zod | 4 | shared | Schemas das marcações e das requisições, validados com o mesmo código no app e na API |
| NestJS | 12 | api | Módulos, guards de papel, interceptors de auditoria e injeção de dependência |
| Prisma ORM | 7.10 | api | Schema do banco, migrações versionadas e consultas tipadas |
| argon2 | 0.45 | api | Hash das senhas |
| sharp | 0.35 | api | Lê dimensões e metadados e gera a cópia reduzida das imagens grandes |
| Nodemailer | 10 | api | Envio do código 2FA e do link de recuperação por SMTP |
| AWS SDK v3 (`client-s3`) | 3 | api | Driver S3 do armazenamento e URLs pré-assinadas em produção |
| Jest, jest-expo, Testing Library, Supertest | 30 / 57 / 14 / 7 | todos | Testes de unidade, de componentes e e2e da API |

## 12. Decisões de arquitetura

| # | Decisão | Por quê | Alternativas descartadas |
| --- | --- | --- | --- |
| D1 | Expo + React Native, com React Native Web no navegador | Uma base para três plataformas (RNF-01), e é a stack da disciplina | Flutter (bom canvas, mas fora da stack da disciplina); PWA pura (gestos e armazenamento seguro limitados no iOS) |
| D2 | Canvas com Skia | Milhares de marcações na GPU e o mesmo código na web (RNF-03) | `react-native-svg` (um elemento por ponto pesa acima de algumas centenas); WebView com canvas HTML (duas bases de código de anotação) |
| D3 | API própria em NestJS, em vez de BaaS | 2FA por e-mail, cegamento, versões e log num lugar só e testável (RF-02, RF-28) | Firebase e Supabase: 2FA por e-mail não é nativo e as regras ficariam espalhadas em políticas do provedor |
| D4 | Cada versão é um snapshot imutável das marcações (JSONB) | Histórico, restauração e diff simples; nada é sobrescrito (RF-33 a RF-35) | Tabela de marcações com `UPDATE` (perde histórico); event sourcing (complexo demais para o prazo) |
| D5 | Coordenadas em pixels da imagem original | Não dependem de tela nem de zoom, o que garante a paridade (RNF-02) e a exportação direta para Labelme e COCO | Coordenadas relativas à tela |
| D6 | Log no próprio PostgreSQL, com trigger, permissões e hash encadeado | O somente-inclusão é garantido pelo banco, não só pela aplicação (RF-38) | Arquivo de log no servidor (fácil de editar); serviço externo (custo e dependência) |
| D7 | Armazenamento de imagens atrás de uma interface (disco local ou S3) | A hospedagem ainda está em aberto (Q9) e o desenvolvimento roda sem conta em nuvem | Fixar um provedor agora |
| D8 | Monorepo com npm workspaces e pacote `shared` | Tipos, schemas e cálculo do índice iguais no app e na API | Repositórios separados (tipos duplicados e versões descasadas) |

---

| Versão | Data | Mudança |
| --- | --- | --- |
| 0.1 | 07/10/2026 | Arquitetura inicial: camadas, navegação, sequências, ciclos de vida, dados, API e decisões. |
