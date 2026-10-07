# 01 · Visão e requisitos

> **Documento vivo.** Versão 0.2, de 07/10/2026. Nasceu do levantamento de requisitos de 23/09/2026 e das anotações de reunião do grupo. Toda mudança de comportamento do app atualiza este arquivo no mesmo pull request (veja a [Definition of Done](03-planejamento.md#6-definition-of-done)).

**Neste documento:** [1. Problema e público](#1-problema-e-público) · [2. Objetivos](#2-objetivos) · [3. Papéis](#3-papéis) · [4. Escopo por fase](#4-escopo-por-fase) · [5. Requisitos funcionais](#5-requisitos-funcionais) · [6. Cenários críticos](#6-cenários-críticos) · [7. Requisitos não funcionais](#7-requisitos-não-funcionais) · [8. Privacidade e LGPD](#8-privacidade-e-lgpd) · [9. Regras de negócio](#9-regras-de-negócio) · [10. Fora do escopo](#10-fora-do-escopo) · [11. Perguntas em aberto](#11-perguntas-em-aberto) · [12. Glossário](#12-glossário)

---

## 1. Problema e público

O **índice Ki-67** é o percentual de núcleos que expressam a proteína Ki-67, um marcador de proliferação celular que a imuno-histoquímica deixa visível: núcleos **reagentes** ficam marrons e os **não reagentes** ficam azul-claros. Para chegar ao índice, o patologista precisa contar centenas de núcleos por imagem. É um trabalho demorado e que varia de um observador para outro, por isso estudos de validação pedem que **três patologistas** avaliem a mesma imagem **sem saber o que os outros marcaram**.

Ferramentas genéricas como o [Labelme](https://github.com/wkentaro/labelme) resolvem o desenho das marcações, mas rodam no computador de cada um, salvam arquivos soltos e não têm usuários, permissões, histórico nem forma de garantir que um avaliador não viu o trabalho do outro.

**O Ki67 resolve isso** com uma plataforma única para web, Android e iOS em que o administrador distribui as imagens, cada patologista anota de forma independente e cega, e as três análises são comparadas por um validador. Cada salvamento vira uma versão e cada ação vai para um log que ninguém altera.

| Público | O que precisa do app |
| --- | --- |
| **Patologistas** que participam de estudos com Ki-67 | Marcar núcleos com rapidez e precisão no computador, tablet ou celular, sem instalar nada além do app ou do navegador |
| **Coordenação do estudo** (administrador) | Cadastrar a equipe, distribuir imagens, acompanhar o progresso e exportar dados confiáveis |
| **Validadores** | Comparar as três análises de uma imagem e registrar o resultado de referência |

## 2. Objetivos

1. **Cegamento de verdade.** Nenhum patologista acessa o trabalho de outro, nem pela interface nem forjando requisições à API.
2. **Nada se perde.** Todo salvamento gera uma versão, nenhuma anotação sobrescreve outra e toda ação entra no log.
3. **Uma base, três plataformas.** As mesmas funções de anotação na web, no Android e no iOS.
4. **Dados prontos para pesquisa.** Exportação em formatos que outras ferramentas já leem (Labelme, COCO e CSV).

## 3. Papéis

Três papéis cobrem o que foi pedido. Um usuário pode acumular papéis; se o validador será um quarto médico, o admin ou um dos três avaliadores ainda está em aberto ([Q1](#11-perguntas-em-aberto)).

| Papel | Pode fazer | Não pode fazer |
| --- | --- | --- |
| **Administrador geral** | Cadastrar usuários e papéis; subir e distribuir imagens; configurar labels; ver todas as anotações, o painel e os logs; exportar | Editar anotações de outros; apagar logs |
| **Patologista (avaliador)** | Anotar as imagens que recebeu; ver o próprio histórico | Ver anotações, observações ou contagens de outros patologistas |
| **Validador** | Comparar as 3 análises de uma imagem e registrar o resultado final | Alterar a análise original de um patologista; validar uma imagem que também anotou |

## 4. Escopo por fase

A primeira fase entrega a anotação cega por pontos com segurança e rastreabilidade. Automação e comparação ficam para a fase 2.

| Fase | Inclui | Requisitos |
| --- | --- | --- |
| **MVP** (este semestre) | Login com 2FA; cadastro de usuários; upload e atribuição; anotação por pontos (reagente e não reagente); abas Pendentes e Avaliadas; painel do admin; cegamento; versionamento básico; log; exportação; web e mobile na mesma base | RF-01 a RF-12, RF-15, RF-16, RF-20 a RF-22, RF-24 a RF-28, RF-33, RF-34, RF-37 a RF-40 |
| **Fase 2** | Pré-marcação e pré-anotação; caixa e polígono; índice na tela; aba Em andamento; comparação dos 3 médicos e concordância; diff de versões; versionamento de imagens; labels configuráveis; reabertura; modo offline completo | RF-13, RF-14, RF-17 a RF-19, RF-23, RF-29 a RF-32, RF-35, RF-36, RF-41, RF-42, RNF-05 (fila completa) |

## 5. Requisitos funcionais

O núcleo do sistema é a **anotação cega e versionada**: cada par (imagem, patologista) tem a própria análise, que nunca é sobrescrita. O critério de aceitação de cada linha é a condição objetiva que decide se o requisito está pronto, e vira caso de teste.

**Legenda:** **MVP** entra neste semestre · **F2** fase 2 · *Sugestão* = ainda não foi pedido pelo cliente e precisa de confirmação.

### 5.1 Autenticação e acesso

| ID | Requisito | Fase | Critério de aceitação |
| --- | --- | --- | --- |
| RF-01 | Login com e-mail e senha; nenhuma imagem acessível só por link | MVP | Credenciais válidas levam ao passo do código (RF-02); inválidas mostram uma mensagem genérica, sem dizer qual campo errou. Abrir a URL de uma imagem ou de uma rota interna sem sessão devolve 401 e o app redireciona para o login. |
| RF-02 | Segundo fator por código enviado ao e-mail | MVP | Depois da senha correta chega ao e-mail cadastrado um código de 6 dígitos válido por 10 min. Código certo cria a sessão; código errado, expirado ou na 5ª tentativa é recusado e exige novo envio. |
| RF-03 | Recuperação de senha por e-mail | MVP | "Esqueci a senha" envia um link de uso único válido por 30 min. A resposta na tela é a mesma para e-mail cadastrado ou não. Ao redefinir, todas as sessões abertas do usuário são encerradas. |
| RF-04 | Sem autocadastro: só o admin cria contas | MVP | Não existe tela nem rota pública de cadastro; `POST /usuarios` feito por quem não é admin retorna 403. |
| RF-05 | Sessão expira por inatividade | MVP | Após 30 min sem requisições a sessão é invalidada no servidor e o app volta ao login, preservando o rascunho local da análise que estava aberta. |

### 5.2 Usuários e imagens (admin)

| ID | Requisito | Fase | Critério de aceitação |
| --- | --- | --- | --- |
| RF-06 | Criar, editar e desativar usuários, sem exclusão, para preservar o histórico | MVP | Não há botão de excluir nem rota `DELETE`. Usuário desativado não consegue entrar, mas suas análises e logs continuam visíveis ao admin. O usuário novo recebe e-mail para definir a própria senha; o admin nunca vê nem escolhe a senha. |
| RF-07 | Atribuir papéis | MVP | O admin marca um ou mais papéis (admin, patologista, validador). A mudança vale na próxima requisição do usuário e gera registro no log. |
| RF-08 | Upload de imagens individual e em lote | MVP | Dá para enviar 1 arquivo ou vários de uma vez (JPG, PNG ou TIFF, até 50 MB cada). Ao final o app mostra quantos foram enviados, quantos eram duplicados e quantos foram recusados, com o motivo. |
| RF-09 | Organizar imagens em lotes ou estudos | MVP | Toda imagem pertence a exatamente um lote e a lista de imagens filtra por lote. |
| RF-10 | Atribuir imagens ou lotes a patologistas | MVP | Atribuir um lote cria uma análise `PENDENTE` para cada par (imagem, patologista). Repetir a mesma atribuição não duplica análises. |
| RF-11 | Imagem original imutável, registrada com hash SHA-256 | MVP | O hash é calculado no upload e guardado. Não existe rota que sobrescreva o arquivo, e o hash recalculado de qualquer original confere com o guardado. Arquivo com hash já cadastrado é recusado como duplicado. |

### 5.3 Anotação (patologista)

| ID | Requisito | Fase | Critério de aceitação |
| --- | --- | --- | --- |
| RF-12 | Marcação por ponto; cada ponto recebe uma label (ex.: reagente, não reagente) | MVP | Um toque ou clique cria um ponto com a label ativa. O ponto aparece com a cor **e o símbolo** da label e é salvo em coordenadas de pixel da imagem original. No MVP as labels "reagente" e "não reagente" vêm do seed. |
| RF-13 | Detecção por bounding box | F2 | Arrastar com a ferramenta retângulo cria uma caixa com label, que pode ser movida, redimensionada e excluída e é exportada como `bbox` no COCO. |
| RF-14 | Segmentação por polígono | F2 | Cliques sucessivos criam vértices e o polígono só fecha com 3 vértices ou mais. É exportado como `polygon` no Labelme e `segmentation` no COCO. |
| RF-15 | Zoom, pan, desfazer/refazer, editar e excluir marcações; pinça e toque no mobile | MVP | Web: roda do mouse dá zoom e espaço + arrastar move. Celular: pinça dá zoom e dois dedos movem. Desfazer e refazer cobrem pelo menos as últimas 50 ações. Mover, trocar a label e excluir um ponto funcionam nas três plataformas. |
| RF-16 | Marcar quais núcleos são reagentes | MVP | Atendido pelo RF-12 com a label "reagente". Trocar a label de um ponto existente é uma ação que pode ser desfeita. |
| RF-17 | Botão "pré-marcar não reagentes" (núcleos azul-claros) para o patologista revisar | F2 | O botão cria pontos "não reagente" com origem `pre_anotacao` sobre núcleos azul-claros. Nenhum ponto automático é salvo sem passar pela revisão, e cada ponto aceito, movido ou removido fica registrado. |
| RF-18 | Imagem abre já pré-anotada por padrão; patologista aceita, corrige ou remove | F2 | Ao abrir uma análise `PENDENTE`, as marcações automáticas aparecem diferentes das manuais, e aceitar, corrigir ou remover cada uma é registrado (premissa da [Q2](#11-perguntas-em-aberto)). |
| RF-19 | *Sugestão:* contagem por label e cálculo automático do índice Ki-67 | F2 | O painel mostra a contagem por label e o índice (fórmula abaixo) com uma casa decimal, atualizado a cada marcação. Sem nenhum núcleo contado exibe "—" em vez de dividir por zero. |
| RF-20 | Campo de observação livre por imagem | MVP | Texto de até 2.000 caracteres, salvo junto com a versão da análise e visível só ao autor, aos validadores e ao admin. |
| RF-21 | Salvamento automático e ação de "finalizar análise" | MVP | Toda alteração chega ao servidor em até 10 s sem ação do usuário, e o indicador mostra "Salvo" ou "Não salvo". "Finalizar" pede confirmação, muda o status para `FINALIZADA` e bloqueia novas edições. |

Índice proposto para o RF-19, também usado no CSV do RF-40:

```math
\text{Índice Ki-67 (\%)} = \frac{\text{núcleos reagentes}}{\text{núcleos reagentes} + \text{núcleos não reagentes}} \times 100
```

### 5.4 Abas do patologista e painel

| ID | Requisito | Fase | Critério de aceitação |
| --- | --- | --- | --- |
| RF-22 | Aba Pendentes: imagens atribuídas ainda não iniciadas | MVP | Lista só as análises do usuário logado, com o código anonimizado da imagem e o lote. Enquanto não existir a aba Em andamento (RF-23), mostra também as análises iniciadas, com o selo "Em andamento". |
| RF-23 | *Sugestão:* aba Em andamento | F2 | Lista as análises `EM_ANDAMENTO` do usuário com a data do último salvamento, e elas saem da aba Pendentes. |
| RF-24 | Aba Avaliadas: análises finalizadas | MVP | Lista as análises `FINALIZADA` do usuário em modo somente leitura, com a data de finalização. |
| RF-25 | Painel do admin com progresso por usuário e por lote | MVP | Mostra, por lote e por patologista, quantas análises estão pendentes, em andamento e finalizadas. Os números batem com uma consulta direta ao banco. |

### 5.5 Cegamento e independência

| ID | Requisito | Fase | Critério de aceitação |
| --- | --- | --- | --- |
| RF-26 | Anotações de um usuário nunca sobrescrevem as de outro | MVP | Cada par (imagem, patologista) tem uma análise própria, garantida por restrição única no banco. Um teste automatizado tenta salvar na análise de outro usuário, recebe 404 e nada muda. |
| RF-27 | Patologista não vê anotações nem observações de outros | MVP | Nenhuma tela e nenhuma resposta da API destinada ao patologista contém marcações, observações, contagens ou nomes de outros patologistas da mesma imagem. |
| RF-28 | Bloqueio garantido no backend (API), não só escondido na tela | MVP | Uma requisição forjada para a análise de outro usuário (por exemplo, trocando o id na URL com `curl`) retorna 404 e gera `ACESSO_NEGADO` no log. A bateria de testes de acesso roda no CI a cada pull request. |

### 5.6 Validação por 3 médicos

| ID | Requisito | Fase | Critério de aceitação |
| --- | --- | --- | --- |
| RF-29 | Cada imagem de validação é anotada por 3 patologistas independentes | F2 | Num lote de validação a imagem só pode ser atribuída a exatamente 3 patologistas distintos; uma 4ª atribuição é recusada. |
| RF-30 | Visão comparativa (sobreposição ou lado a lado), só para validador e admin | F2 | O validador vê as 3 análises finalizadas lado a lado ou sobrepostas, identificadas como A, B e C. Um patologista que acessa a rota recebe 403. |
| RF-31 | *Sugestão:* métricas de concordância (diferença de índice, concordância por ponto) | F2 | A tela mostra a diferença entre o maior e o menor índice, em pontos percentuais, e o percentual de pontos que coincidem entre as análises dentro de uma tolerância em pixels. |
| RF-32 | Registro do resultado validado ou de consenso | F2 | O validador escolhe uma das análises ou registra um consenso com justificativa. O resultado fica imutável, com autor e data/hora, e a imagem passa para `VALIDADA`. |

### 5.7 Versionamento (estilo GitHub)

| ID | Requisito | Fase | Critério de aceitação |
| --- | --- | --- | --- |
| RF-33 | Cada salvamento gera nova versão com autor e data/hora; nada é apagado | MVP | Depois de N salvamentos existem N versões numeradas em sequência. Não há rota nem permissão no banco para alterar ou apagar uma versão. |
| RF-34 | Histórico por imagem e por usuário, com visualizar e restaurar versão | MVP | O histórico lista número, data/hora e totais de cada versão. Restaurar a versão *k* cria uma versão nova igual a *k*, e as versões posteriores continuam no histórico. |
| RF-35 | Diff entre versões: pontos adicionados, removidos e alterados | F2 | Comparar duas versões lista as marcações adicionadas, removidas e alteradas (label ou posição), casadas pelo id de cada marcação. |
| RF-36 | Versionamento também das imagens, se forem substituídas ou reprocessadas | F2 | Substituir uma imagem cria a versão 2 do arquivo com novo hash; as análises antigas continuam apontando para a versão em que foram feitas. |

### 5.8 Log e auditoria

| ID | Requisito | Fase | Critério de aceitação |
| --- | --- | --- | --- |
| RF-37 | Log de todas as ações: login, falhas de login, anotações, finalizações, uploads, atribuições, mudanças de usuário | MVP | Cada uma dessas ações, mais acesso negado e exportação, gera um registro com usuário, ação, data/hora, IP e dispositivo. |
| RF-38 | Log somente-inclusão: ninguém edita nem apaga, nem o admin | MVP | Um `UPDATE` ou `DELETE` na tabela de log falha no próprio banco, inclusive com o usuário de banco da API. A verificação do hash encadeado não aponta nenhuma quebra. |
| RF-39 | Consulta de logs com filtros por usuário, imagem e período (admin) | MVP | O admin combina os três filtros e recebe o resultado paginado. Patologista e validador recebem 403 na rota. |

### 5.9 Exportação

| ID | Requisito | Fase | Critério de aceitação |
| --- | --- | --- | --- |
| RF-40 | Exportar anotações em JSON (estilo Labelme e/ou COCO) e relatório CSV com contagens e índice por imagem | MVP | A exportação de um lote gera um JSON por imagem e análise no formato Labelme, que abre no Labelme sem erro, e um CSV com imagem, patologista, contagem por label e índice. O formato COCO entra junto com caixas e polígonos (F2). Toda exportação vai para o log. |

### 5.10 Requisitos derivados

Não estavam numerados no levantamento, mas decorrem dele.

| ID | Requisito | Origem | Fase | Critério de aceitação |
| --- | --- | --- | --- | --- |
| RF-41 | Configurar labels: nome, cor, símbolo e papel no índice (positivo, negativo ou fora da contagem) | Tabela de papéis ("configurar labels") e [Q4](#11-perguntas-em-aberto) | F2 | O admin cria e edita labels. Uma label já usada só pode ser desativada, e o índice passa a considerar o papel de cada label. |
| RF-42 | Reabrir análise finalizada | Regra de negócio 4 (*a confirmar*) | F2 | Só o admin reabre, com justificativa obrigatória. A reabertura cria uma versão do tipo `REABERTURA`, volta o status para `EM_ANDAMENTO` e gera log. |

## 6. Cenários críticos

Os requisitos que sustentam a confiança nos dados ganham cenários completos. Eles viram testes ponta a ponta (e2e) da API e rodam no CI.

```gherkin
# language: pt
Funcionalidade: Cegamento entre patologistas (RF-26, RF-27, RF-28)

  Contexto:
    Dado que a imagem "IMG-0042" foi atribuída aos patologistas P1 e P2
    E que P1 salvou 30 marcações e uma observação na própria análise

  Cenário: P2 não enxerga o trabalho de P1
    Quando P2 abre a imagem "IMG-0042"
    Então P2 vê apenas as próprias marcações
    E nenhuma resposta da API para P2 contém marcações, observação ou nome de P1

  Cenário: requisição forjada é barrada na API
    Quando P2 envia "GET /analises/{id da análise de P1}" com o próprio token
    Então a API responde 404, sem revelar que a análise existe
    E o log registra "ACESSO_NEGADO" para P2

Funcionalidade: Versionamento sem perda (RF-33, RF-34)

  Cenário: restaurar uma versão antiga não apaga as posteriores
    Dado que a análise de P1 tem as versões 1 a 5
    Quando P1 restaura a versão 3
    Então passa a existir a versão 6, com o mesmo conteúdo da versão 3
    E as versões 4 e 5 continuam no histórico

Funcionalidade: Log somente-inclusão (RF-38)

  Cenário: nem o administrador apaga o log
    Dado um registro de log com id 100
    Quando o admin, ou a própria conexão da API, tenta alterar ou apagar esse registro
    Então o banco recusa a operação
    E o registro 100 continua igual
```

## 7. Requisitos não funcionais

O app é cross-platform: uma base de código para web, Android e iOS, com o mesmo backend e as mesmas regras de acesso. Cada RNF tem uma métrica ou verificação objetiva.

| ID | Categoria | Requisito | Critério de aceitação |
| --- | --- | --- | --- |
| RNF-01 | Plataformas e versões mínimas | Web, Android e iOS a partir de uma base de código (Expo SDK 57). Android 7.0+ (API 24), iOS 16.4+ e navegadores Chrome, Edge, Firefox e Safari nas duas últimas versões. Retrato e paisagem; a anotação é pensada primeiro para tablet e desktop ([Q6](#11-perguntas-em-aberto)). | O mesmo commit gera o app web e roda no Expo Go em Android e iOS; o CI faz o build web a cada pull request. |
| RNF-02 | Paridade | Mesmas funções de anotação em todas as plataformas; muda só a interação (mouse e teclado × toque). | Os critérios de RF-12, RF-15 e RF-21 passam na web e em pelo menos um celular a cada entrega. |
| RNF-03 | Desempenho | Centenas a milhares de pontos por imagem sem travar, inclusive em celulares intermediários. | Com 2.000 pontos, pan e zoom ficam a 30 fps ou mais num Android intermediário (4 GB de RAM) e a 50 fps ou mais no desktop; marcar um ponto responde em menos de 100 ms. |
| RNF-04 | Imagens grandes | No MVP, campos capturados (JPG, PNG, TIFF) de até 50 MB. Imagens com mais de 4.096 px no maior lado são exibidas a partir de uma cópia reduzida gerada no upload, sem mudar o original nem o sistema de coordenadas. Lâminas inteiras (WSI) com tiles e zoom progressivo só na fase 2, se a [Q5](#11-perguntas-em-aberto) confirmar. | Uma imagem de 8.000 × 6.000 px abre no celular em até 3 s numa rede Wi-Fi e as coordenadas exportadas correspondem ao arquivo original. |
| RNF-05 | Conectividade (funcionamento offline) | MVP: login, listas e abertura de imagens exigem rede; a análise já aberta continua editável sem conexão e o rascunho fica no aparelho até a rede voltar. *Sugestão* para a fase 2: fila completa de sincronização. | Derrubar a rede durante a anotação, fazer 20 marcações e reconectar: as 20 chegam ao servidor, sem duplicar nem perder nenhuma. |
| RNF-06 | Segurança | HTTPS; senhas com hash argon2id; imagens em armazenamento privado com URL assinada de 5 min; nada sensível em cache aberto no aparelho. | URL assinada expirada retorna 403; respostas de imagem trazem `Cache-Control: no-store`; o token fica no SecureStore (Android/iOS) ou em cookie `httpOnly` (web), nunca em AsyncStorage ou localStorage; login e código 2FA aceitam no máximo 5 tentativas a cada 15 min. |
| RNF-07 | LGPD | Imagens anonimizadas (sem nome do paciente em metadados ou no rótulo da lâmina), base legal definida e aprovação no CEP, por ser pesquisa. Detalhes na [seção 8](#8-privacidade-e-lgpd). | O upload alerta sobre metadados de texto (EXIF/TIFF) antes de aceitar o arquivo; não existe dado de paciente no banco, no repositório nem nos seeds. |
| RNF-08 | Rastreabilidade | Toda anotação vinculada a usuário, versão, data/hora e dispositivo. | Autor, data/hora (UTC), número sequencial e dispositivo (plataforma e versão do app) são campos obrigatórios de toda versão. |
| RNF-09 | Backup | Backup periódico de banco, imagens e logs. | Backup diário do banco no Supabase, com retenção de 30 dias: o backup automático do Supabase, que depende do plano contratado, ou um `pg_dump` agendado no CI enquanto o projeto estiver no plano gratuito. O armazenamento de imagens tem cópia diária própria, e uma restauração completa é testada antes de cada entrega. |
| RNF-10 | Usabilidade | Atalhos de teclado na web; pinça e toque longo no mobile; alvos de toque grandes o bastante para marcar núcleos. | Atalhos: `1` e `2` trocam a label, `Z` desfaz, `Shift+Z` refaz, espaço + arrastar move. No celular, o toque longo abre o menu do ponto (trocar label, excluir) e uma lupa mostra a área sob o dedo durante a marcação. |
| RNF-11 | Permissões do dispositivo | O MVP não pede câmera, localização, contatos nem notificações. O upload usa o seletor de arquivos do sistema, que dispensa permissão. | Nenhuma janela de permissão aparece no primeiro uso. Se a fase 2 trouxer notificações (por exemplo, "nova imagem atribuída"), o pedido acontece só na hora do uso e explica o motivo. |
| RNF-12 | Acessibilidade | Alvos de toque de pelo menos 44 × 44 pt (iOS) e 48 × 48 dp (Android); contraste mínimo de 4,5:1 (WCAG 2.1 AA); todo botão de ícone com `accessibilityLabel`; labels diferenciadas por símbolo além da cor; textos acompanham o tamanho de fonte do sistema. | Login e listas são percorridos de ponta a ponta com VoiceOver e TalkBack; a auditoria de acessibilidade do Lighthouse fica em 90 ou mais na web. O canvas é visual por natureza: o leitor de tela anuncia a label ativa e as contagens, não cada núcleo. |
| RNF-13 | Qualidade e manutenção | TypeScript em modo estrito no app, na API e no pacote compartilhado; lint, checagem de tipos e testes no CI. | Pull request com CI vermelho não pode ser mesclado, e as regras de acesso (RF-26 a RF-28) têm testes e2e. |

## 8. Privacidade e LGPD

Que dado pessoal o app guarda, onde guarda e por quanto tempo:

| Dado | De quem | Onde fica | Por quanto tempo | Observação |
| --- | --- | --- | --- | --- |
| Nome, e-mail e papéis | Usuários | Banco no Supabase (região São Paulo) | Enquanto durar o estudo; a conta é desativada, nunca excluída (RF-06) | Necessário para autoria e auditoria |
| Hash da senha (argon2id) | Usuários | Banco no Supabase | Enquanto a conta existir | A senha nunca é guardada em texto puro |
| Registros de log: ação, data/hora, IP e dispositivo | Usuários | Banco no Supabase, tabela somente-inclusão | Pelo prazo do estudo definido no protocolo; não são apagados (RF-38) | Rastreabilidade (RNF-08) |
| Códigos de 2FA e de recuperação de senha | Usuários | Banco no Supabase, apenas o hash | 10 min (2FA) e 30 min (recuperação); depois disso são inválidos | |
| Imagens das lâminas | Pacientes, de forma indireta | Armazenamento privado no servidor | Conforme o protocolo aprovado no CEP | Chegam anonimizadas: sem nome, prontuário ou rótulo da lâmina |
| Sessão | Usuário | SecureStore (Android/iOS) ou cookie `httpOnly` (web) | Até o logout ou a expiração | O logout apaga |
| Rascunho da análise aberta | Usuário | Armazenamento do app no aparelho | Até o servidor confirmar o salvamento, ou até o logout | Só coordenadas, labels e observação; nenhuma imagem é gravada no aparelho |

**Base legal.** Imagens corretamente anonimizadas deixam de ser dado pessoal (art. 12 da LGPD). Para o estudo em si e para os dados dos usuários, a base legal (por exemplo, realização de estudos por órgão de pesquisa, art. 7º, IV e art. 11, II, "c") será confirmada com a instituição e com o Comitê de Ética em Pesquisa antes do uso com imagens reais. O banco fica num serviço de terceiros (Supabase), então o projeto é criado na região de São Paulo, para os dados permanecerem no Brasil, e os termos de tratamento de dados do provedor entram nessa avaliação. Até lá, o desenvolvimento usa apenas imagens sintéticas ou de bases públicas com licença compatível.

## 9. Regras de negócio

| ID | Regra | Garantida por |
| --- | --- | --- |
| RN-01 | Só o admin cadastra usuários e sobe imagens. | RF-04, RF-08 |
| RN-02 | Uma anotação pertence a exatamente um usuário, e ninguém mais pode editá-la. | RF-26, RF-28 |
| RN-03 | O patologista só vê as imagens que recebeu e as próprias anotações. | RF-22, RF-27 |
| RN-04 | Uma análise finalizada só é reaberta pelo admin, o que gera nova versão e registro no log. *(A confirmar.)* | RF-42 |
| RN-05 | Uma imagem de validação só vai para comparação depois que as 3 análises forem finalizadas. | RF-29, RF-30 |
| RN-06 | Nenhum registro de log ou versão é apagado. | RF-33, RF-38 |

## 10. Fora do escopo

O que o Ki67 **não** faz. A lista protege o cronograma e evita discutir na última hora uma função que nunca foi combinada.

1. **Diagnóstico ou laudo clínico.** O Ki67 é ferramenta de pesquisa e anotação; não substitui o laudo do patologista e não é dispositivo médico regulamentado.
2. **Dados identificáveis de pacientes** e integração com prontuário, LIS ou PACS.
3. **Labelme dentro do app.** Ele serve só de referência de funcionalidades.
4. **Treinar ou hospedar modelos de IA.** A pré-anotação da fase 2 começa por limiar de cor ([Q3](#11-perguntas-em-aberto)).
5. **Autocadastro, login social** ou acesso por link público.
6. **Exclusão definitiva** de usuários, análises, versões ou logs.
7. **Edição da imagem original** (filtros, ajuste de cor, recorte).
8. **Lâminas inteiras (WSI)** no MVP.
9. **Chat ou comentários entre patologistas**, que quebrariam o cegamento.
10. **Notificações push, modo offline completo e publicação nas lojas** neste semestre: a distribuição é pela web e pelo Expo Go ou build interno.
11. **Outros idiomas** além do português.

## 11. Perguntas em aberto

Estas decisões mudam escopo ou arquitetura. Enquanto não forem fechadas com o cliente, o desenvolvimento segue a premissa da terceira coluna, escolhida para ser barata de mudar.

| ID | Pergunta | Premissa adotada até a decisão | Se mudar, afeta |
| --- | --- | --- | --- |
| Q1 | Validador e avaliador são papéis diferentes? O validador é um 4º médico, o admin ou um dos 3? | Papéis separados. Um usuário pode ter os dois, mas o sistema impede que alguém valide uma imagem que anotou. | RF-07, RF-30, RF-32 |
| Q2 | Se todos recebem a mesma pré-anotação, ela enviesa a análise que o cegamento protege? Vale registrar o que veio da máquina e o que foi marcado à mão? | Sim: cada marcação guarda a origem (`manual`, `pre_anotacao`, `pre_anotacao_editada`) desde o MVP. | Modelo de dados |
| Q3 | Já existe modelo de detecção ou segmentação, ou será treinado? | Fase 2 com limiar de cor sobre os núcleos azul-claros; modelo treinado é trabalho futuro. | RF-17, RF-18 |
| Q4 | Só reagente e não reagente, ou também intensidade, artefato e "excluir da contagem"? | Duas labels no MVP. Labels são dados (tabela), não código: incluir outras não exige nova versão do app. | RF-12, RF-41, índice |
| Q5 | Campos capturados (JPG/PNG/TIFF) ou lâminas inteiras (WSI)? | Campos capturados de até 50 MB. | RNF-04, armazenamento, canvas |
| Q6 | O patologista vai anotar no celular ou só no tablet e no desktop? | Funciona no celular, mas a experiência é desenhada primeiro para tablet e desktop. | RNF-10, layout |
| Q7 | Anota a imagem toda ou escolhe hotspots antes de contar? | Imagem toda: o campo capturado já é a região escolhida. | Modelo de dados, índice |
| Q8 | Quantas imagens e usuários são esperados? | Dezenas de usuários, alguns milhares de imagens e até cerca de 2.000 pontos por imagem. | RNF-03, hospedagem |
| Q9 | Nuvem ou servidor da instituição? | **Banco decidido:** Supabase na nuvem, região São Paulo. Ainda em aberto: onde roda a API (container, nuvem ou servidor da instituição) e onde ficam as imagens (Supabase Storage ou outro serviço compatível com S3). | Implantação, backup, LGPD |
| Q10 | Flutter, React Native + web ou outra stack? | **Decidida:** React Native com Expo (web via React Native Web) e canvas Skia, revista depois da prova de conceito da Sprint 0. | Toda a [arquitetura](02-arquitetura.md) |

## 12. Glossário

| Termo | Significado |
| --- | --- |
| **Ki-67** | Proteína do núcleo presente em células em divisão e ausente nas células em repouso. |
| **Imuno-histoquímica (IHC)** | Técnica que usa anticorpos para corar uma proteína específica no tecido. |
| **Núcleo reagente** | Núcleo corado de marrom, ou seja, com Ki-67 (positivo). |
| **Núcleo não reagente** | Núcleo só com a contracoloração azul de hematoxilina, sem Ki-67 (negativo). |
| **Índice Ki-67** | Percentual de núcleos reagentes entre os núcleos contados. |
| **Cegamento** | Cada patologista anota sem acesso ao trabalho dos outros, para que uma análise não influencie a outra. |
| **Pré-anotação** | Marcações sugeridas pelo sistema, que o patologista aceita, corrige ou remove. |
| **Hotspot** | Região com maior concentração de núcleos reagentes, às vezes escolhida para a contagem. |
| **WSI** | *Whole slide image*: imagem digital da lâmina inteira, com bilhões de pixels (.svs, .ndpi). |
| **Bounding box / polígono** | Retângulo que delimita um objeto (detecção) / contorno ponto a ponto (segmentação). |
| **Labelme / COCO** | Formatos JSON de anotação de imagens muito usados em visão computacional. |
| **SHA-256** | Impressão digital de um arquivo: qualquer alteração no arquivo muda o hash. |
| **Log somente-inclusão** | Registro em que só se acrescentam linhas; nenhuma é alterada ou apagada. |
| **CEP** | Comitê de Ética em Pesquisa, que aprova estudos com dados de seres humanos. |
| **2FA** | Segundo fator de autenticação; aqui, um código enviado por e-mail. |

---

| Versão | Data | Mudança |
| --- | --- | --- |
| 0.1 | 07/10/2026 | Estrutura inicial a partir do levantamento de requisitos de 23/09/2026. |
| 0.2 | 07/10/2026 | Banco no Supabase: LGPD (onde ficam os dados), backup (RNF-09) e Q9 parcialmente decidida. |
