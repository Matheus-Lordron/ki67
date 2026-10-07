# 01 · Visão e requisitos

> **Documento vivo.** Versão 0.3, de 07/10/2026. Nasceu do levantamento de requisitos de 23/09/2026 e das anotações de reunião do grupo, e incorpora o retorno do professor sobre a primeira versão. Toda mudança de comportamento do app atualiza este arquivo no mesmo pull request (veja a [Definition of Done](03-planejamento.md#6-definition-of-done)).

**Neste documento:** [1. Problema e público](#1-problema-e-público) · [2. Objetivos](#2-objetivos) · [3. Papéis](#3-papéis) · [4. Escopo por fase](#4-escopo-por-fase) · [5. Requisitos funcionais](#5-requisitos-funcionais) · [6. Cenários críticos](#6-cenários-críticos) · [7. Requisitos não funcionais](#7-requisitos-não-funcionais) · [8. Privacidade e LGPD](#8-privacidade-e-lgpd) · [9. Regras de negócio](#9-regras-de-negócio) · [10. Fora do escopo](#10-fora-do-escopo) · [11. Perguntas em aberto](#11-perguntas-em-aberto) · [12. Glossário](#12-glossário)

---

## 1. Problema e público

O **índice Ki-67** é o percentual de núcleos que expressam a proteína Ki-67, um marcador de proliferação celular que a imuno-histoquímica deixa visível: núcleos **reagentes** ficam marrons e os **não reagentes** ficam azul-claros. Para chegar ao índice, o patologista precisa contar centenas de núcleos por imagem. É um trabalho demorado e que varia de um observador para outro, por isso estudos de validação pedem que **vários avaliadores** analisem a mesma imagem **sem saber o que os outros marcaram**.

Ferramentas genéricas como o [Labelme](https://github.com/wkentaro/labelme) resolvem o desenho das marcações, mas rodam no computador de cada um, salvam arquivos soltos e não têm usuários, permissões, histórico nem forma de garantir que um avaliador não viu o trabalho do outro.

**O Ki67 resolve isso** com uma plataforma única para web, Android e iOS. O gestor de cada projeto distribui as imagens, cada avaliador anota de forma independente e cega, e as análises da mesma imagem são comparadas por um validador. O número de avaliadores por imagem é definido pelo gestor, não fixo. Cada salvamento vira uma versão e cada ação vai para um log que ninguém altera.

| Público | O que precisa do app |
| --- | --- |
| **Avaliadores**, em geral patologistas que participam de estudos com Ki-67 | Marcar núcleos com rapidez e precisão no computador, tablet ou celular, sem instalar nada além do app ou do navegador |
| **Gestores de projeto**, como o patologista líder ou o pesquisador principal | Montar o estudo, distribuir as imagens, decidir quantos avaliadores cada imagem recebe, acompanhar o progresso e exportar dados confiáveis |
| **Validadores** | Comparar as análises de uma imagem e registrar o resultado de referência |
| **Administrador do sistema** | Cadastrar as pessoas, criar projetos e acompanhar a segurança pelo log |

## 2. Objetivos

1. **Cegamento de verdade.** Nenhum avaliador acessa o trabalho de outro, nem pela interface nem forjando requisições à API.
2. **Nada se perde.** Todo salvamento gera uma versão, nenhuma anotação sobrescreve outra e toda ação entra no log.
3. **Uma base, três plataformas.** As mesmas funções de anotação na web, no Android e no iOS.
4. **Dados prontos para pesquisa.** Exportação em formatos que outras ferramentas já leem (Labelme e CSV).

## 3. Papéis

Quatro papéis cobrem o que foi pedido. A gestão de cada estudo fica com o **gestor do projeto**, e não com o administrador, que cuida só do sistema. Um usuário pode acumular papéis, com duas exceções que protegem o cegamento ([RN-07 e RN-08](#9-regras-de-negócio)).

| Papel | Pode fazer | Não pode fazer |
| --- | --- | --- |
| **Administrador do sistema** | Cadastrar usuários e papéis; criar projetos e designar o gestor de cada um; consultar o log de todo o sistema | Ver ou editar anotações; distribuir imagens; apagar logs |
| **Gestor do projeto** (por exemplo, o patologista líder ou o pesquisador principal) | No próprio projeto: criar lotes, subir e distribuir imagens, definir quantos avaliadores cada imagem recebe, ver o painel de progresso e todas as análises, exportar, consultar o log do projeto | Editar a análise de um avaliador; cadastrar usuários; ver projetos de outros gestores; ser avaliador no próprio projeto |
| **Avaliador** | Anotar as imagens que recebeu; ver o próprio histórico | Ver anotações, observações ou contagens de outros avaliadores |
| **Validador** | Comparar as análises de uma imagem e registrar o resultado final | Alterar a análise original de um avaliador; validar uma imagem que também anotou |

## 4. Escopo por fase

O MVP entrega a anotação cega completa (pontos, caixas e polígonos, pré-anotação e índice na tela) e a comparação das análises com métricas de concordância, sempre com segurança e rastreabilidade. A fase 2 traz histórico mais rico, funcionamento offline e configurações.

| Fase | Inclui | Requisitos |
| --- | --- | --- |
| **MVP** | Login com 2FA; usuários, projetos e gestores; upload e atribuição a N avaliadores; anotação por pontos, caixas e polígonos; pré-marcação e pré-anotação; índice Ki-67 na tela; abas Pendentes e Avaliadas; painel do gestor; cegamento; versionamento; comparação das análises e métricas de concordância; log; exportação; web e mobile na mesma base | RF-01 a RF-22, RF-24 a RF-34, RF-37 a RF-40 |
| **Fase 2** | Aba Em andamento; diff entre versões; versionamento de imagens; labels configuráveis; reabertura de análise; modo offline completo | RF-23, RF-35, RF-36, RF-41, RF-42, RNF-05 (fila completa) |

## 5. Requisitos funcionais

O núcleo do sistema é a **anotação cega e versionada**: cada par (imagem, avaliador) tem a própria análise, que nunca é sobrescrita. O critério de aceitação de cada linha é a condição objetiva que decide se o requisito está pronto, e vira caso de teste.

**Legenda:** **MVP** faz parte da primeira versão entregue · **F2** fase 2 · *Sugestão* = ainda não foi pedido pelo cliente e precisa de confirmação.

### 5.1 Autenticação e acesso

| ID | Requisito | Fase | Critério de aceitação |
| --- | --- | --- | --- |
| RF-01 | Login com e-mail e senha; nenhuma imagem acessível só por link | MVP | Credenciais válidas levam ao passo do código (RF-02); inválidas mostram uma mensagem genérica, sem dizer qual campo errou. Abrir a URL de uma imagem ou de uma rota interna sem sessão devolve 401 e o app redireciona para o login. |
| RF-02 | Segundo fator por código enviado ao e-mail | MVP | Depois da senha correta chega ao e-mail cadastrado um código de 6 dígitos válido por 10 min. Código certo cria a sessão; código errado, expirado ou na 5ª tentativa é recusado e exige novo envio. |
| RF-03 | Recuperação de senha por e-mail | MVP | "Esqueci a senha" envia um link de uso único válido por 30 min. A resposta na tela é a mesma para e-mail cadastrado ou não. Ao redefinir, todas as sessões abertas do usuário são encerradas. |
| RF-04 | Sem autocadastro: só o admin cria contas | MVP | Não existe tela nem rota pública de cadastro; `POST /usuarios` feito por quem não é admin retorna 403. |
| RF-05 | Sessão expira por inatividade | MVP | Após 30 min sem requisições a sessão é invalidada no servidor e o app volta ao login, preservando o rascunho local da análise que estava aberta. |

### 5.2 Usuários, projetos e imagens

| ID | Requisito | Fase | Critério de aceitação |
| --- | --- | --- | --- |
| RF-06 | Criar, editar e desativar usuários, sem exclusão, para preservar o histórico (admin) | MVP | Não há botão de excluir nem rota `DELETE`. Usuário desativado não consegue entrar, mas suas análises e logs continuam guardados. O usuário novo recebe e-mail para definir a própria senha; o admin nunca vê nem escolhe a senha. |
| RF-07 | Atribuir papéis (admin) | MVP | O admin marca um ou mais papéis: admin, gestor, avaliador e validador. A mudança vale na próxima requisição do usuário e gera registro no log. |
| RF-08 | Upload de imagens individual e em lote (gestor) | MVP | O gestor envia 1 arquivo ou vários de uma vez (JPG, PNG ou TIFF, até 50 MB cada) para um lote do próprio projeto. Ao final o app mostra quantos foram enviados, quantos eram duplicados e quantos foram recusados, com o motivo. |
| RF-09 | Organizar imagens em projetos (estudos) e lotes | MVP | O admin cria o projeto e designa o gestor; o gestor cria os lotes. Toda imagem pertence a exatamente um lote, todo lote a um projeto, e as listas filtram por projeto e lote. O gestor só enxerga os próprios projetos. |
| RF-10 | Atribuir imagens ou lotes a avaliadores (gestor) | MVP | Atribuir um lote cria uma análise `PENDENTE` para cada par (imagem, avaliador). Repetir a mesma atribuição não duplica análises, e o sistema recusa atribuir a imagem ao gestor do próprio projeto (RN-07). |
| RF-11 | Imagem original imutável, registrada com hash SHA-256 | MVP | O hash é calculado no upload e guardado. Não existe rota que sobrescreva o arquivo, e o hash recalculado de qualquer original confere com o guardado. Arquivo com hash já cadastrado é recusado como duplicado. |

### 5.3 Anotação (avaliador)

| ID | Requisito | Fase | Critério de aceitação |
| --- | --- | --- | --- |
| RF-12 | Marcação por ponto; cada ponto recebe uma label (ex.: reagente, não reagente) | MVP | Um toque ou clique cria um ponto com a label ativa. O ponto aparece com a cor **e o símbolo** da label e é salvo em coordenadas de pixel da imagem original. No MVP as labels "reagente" e "não reagente" vêm do seed. |
| RF-13 | Detecção por bounding box | MVP | Arrastar com a ferramenta caixa cria um retângulo com label, que pode ser movido, redimensionado e excluído e é exportado como `rectangle` no formato do Labelme. |
| RF-14 | Segmentação por polígono | MVP | Toques ou cliques sucessivos criam vértices, e o polígono só fecha com 3 vértices ou mais. É exportado como `polygon` no formato do Labelme. |
| RF-15 | Zoom, pan, desfazer/refazer, editar e excluir marcações; pinça e toque no mobile | MVP | Web: roda do mouse dá zoom e espaço + arrastar move. Celular: pinça dá zoom e dois dedos movem. Desfazer e refazer cobrem pelo menos as últimas 50 ações. Mover, trocar a label e excluir uma marcação funcionam nas três plataformas. |
| RF-16 | Marcar quais núcleos são reagentes | MVP | Atendido pelo RF-12 com a label "reagente". Trocar a label de uma marcação existente é uma ação que pode ser desfeita. |
| RF-17 | Botão "pré-marcar não reagentes" (núcleos azul-claros) para o avaliador revisar | MVP | O botão cria pontos "não reagente" com origem `pre_anotacao` sobre os núcleos azul-claros encontrados por limiar de cor. Nenhum ponto automático é salvo sem passar pela revisão, e cada ponto aceito, movido ou removido fica registrado. |
| RF-18 | Imagem abre já pré-anotada por padrão; avaliador aceita, corrige ou remove | MVP | Ao abrir uma análise `PENDENTE`, as marcações automáticas da imagem aparecem diferentes das manuais (contorno tracejado), e aceitar, corrigir ou remover cada uma é registrado (premissa da [Q2](#11-perguntas-em-aberto)). Todos os avaliadores da imagem recebem a mesma pré-anotação. |
| RF-19 | Contagem por label e cálculo automático do índice Ki-67 | MVP | O painel mostra a contagem por label e o índice (fórmula abaixo) com uma casa decimal, atualizado a cada marcação. Sem nenhum núcleo contado exibe "—" em vez de dividir por zero. |
| RF-20 | Campo de observação livre por imagem | MVP | Texto de até 2.000 caracteres, salvo junto com a versão da análise e visível só ao autor, aos validadores e ao gestor do projeto. |
| RF-21 | Salvamento automático e ação de "finalizar análise" | MVP | Toda alteração chega ao servidor em até 10 s sem ação do usuário, e o indicador mostra "Salvo" ou "Não salvo". "Finalizar" pede confirmação, muda o status para `FINALIZADA` e bloqueia novas edições. |

Índice usado no RF-19, na comparação (RF-31) e no CSV do RF-40:

```math
\text{Índice Ki-67 (\%)} = \frac{\text{núcleos reagentes}}{\text{núcleos reagentes} + \text{núcleos não reagentes}} \times 100
```

### 5.4 Abas do avaliador e painel do gestor

| ID | Requisito | Fase | Critério de aceitação |
| --- | --- | --- | --- |
| RF-22 | Aba Pendentes: imagens atribuídas ainda não iniciadas | MVP | Lista só as análises do usuário logado, com o código anonimizado da imagem e o lote. Enquanto não existir a aba Em andamento (RF-23), mostra também as análises iniciadas, com o selo "Em andamento". |
| RF-23 | *Sugestão:* aba Em andamento | F2 | Lista as análises `EM_ANDAMENTO` do usuário com a data do último salvamento, e elas saem da aba Pendentes. |
| RF-24 | Aba Avaliadas: análises finalizadas | MVP | Lista as análises `FINALIZADA` do usuário em modo somente leitura, com a data de finalização. |
| RF-25 | Painel do gestor com progresso por avaliador e por lote | MVP | Mostra, por lote e por avaliador do projeto, quantas análises estão pendentes, em andamento e finalizadas, e quantas imagens já podem ir para comparação. Os números batem com uma consulta direta ao banco. |

### 5.5 Cegamento e independência

| ID | Requisito | Fase | Critério de aceitação |
| --- | --- | --- | --- |
| RF-26 | Anotações de um usuário nunca sobrescrevem as de outro | MVP | Cada par (imagem, avaliador) tem uma análise própria, garantida por restrição única no banco. Um teste automatizado tenta salvar na análise de outro usuário, recebe 404 e nada muda. |
| RF-27 | Avaliador não vê anotações nem observações de outros | MVP | Nenhuma tela e nenhuma resposta da API destinada ao avaliador contém marcações, observações, contagens ou nomes de outros avaliadores da mesma imagem. |
| RF-28 | Bloqueio garantido no backend (API), não só escondido na tela | MVP | Uma requisição forjada para a análise de outro usuário (por exemplo, trocando o id na URL com `curl`) retorna 404 e gera `ACESSO_NEGADO` no log. A bateria de testes de acesso roda no CI a cada pull request. |

### 5.6 Comparação e validação

| ID | Requisito | Fase | Critério de aceitação |
| --- | --- | --- | --- |
| RF-29 | Cada imagem é anotada por N avaliadores independentes, com N definido pelo gestor em cada lote (não fixo em 3) | MVP | O gestor define N ao criar o lote (padrão 3, mínimo 1). Cada imagem só pode ser atribuída a exatamente N avaliadores distintos, e uma atribuição além de N é recusada. Lotes com N maior ou igual a 2 vão para comparação. |
| RF-30 | Visão comparativa (sobreposição ou lado a lado), só para validador e gestor | MVP | O validador vê as N análises finalizadas lado a lado ou sobrepostas, identificadas por letras (A, B, C...) sem o nome de quem anotou. Um avaliador que acessa a rota recebe 403. |
| RF-31 | Métricas de concordância (diferença de índice, concordância por ponto) | MVP | A tela mostra o índice de cada análise, a diferença entre o maior e o menor, em pontos percentuais, e o percentual de marcações que coincidem entre as análises dentro de uma tolerância em pixels. |
| RF-32 | Registro do resultado validado ou de consenso | MVP | O validador escolhe uma das análises ou registra um consenso com justificativa. O resultado fica imutável, com autor e data/hora, e a imagem passa para `VALIDADA`. |

### 5.7 Versionamento (estilo GitHub)

| ID | Requisito | Fase | Critério de aceitação |
| --- | --- | --- | --- |
| RF-33 | Cada salvamento gera nova versão com autor e data/hora; nada é apagado | MVP | Depois de N salvamentos existem N versões numeradas em sequência. Não há rota nem permissão no banco para alterar ou apagar uma versão. |
| RF-34 | Histórico por imagem e por usuário, com visualizar e restaurar versão | MVP | O histórico lista número, data/hora e totais de cada versão. Restaurar a versão *k* cria uma versão nova igual a *k*, e as versões posteriores continuam no histórico. |
| RF-35 | Diff entre versões: marcações adicionadas, removidas e alteradas | F2 | Comparar duas versões lista as marcações adicionadas, removidas e alteradas (label ou posição), casadas pelo id de cada marcação. |
| RF-36 | Versionamento também das imagens, se forem substituídas ou reprocessadas | F2 | Substituir uma imagem cria a versão 2 do arquivo com novo hash; as análises antigas continuam apontando para a versão em que foram feitas. |

### 5.8 Log e auditoria

| ID | Requisito | Fase | Critério de aceitação |
| --- | --- | --- | --- |
| RF-37 | Log de todas as ações: login, falhas de login, anotações, finalizações, uploads, atribuições, mudanças de usuário | MVP | Cada uma dessas ações, mais acesso negado, validação e exportação, gera um registro com usuário, ação, data/hora, IP e dispositivo. |
| RF-38 | Log somente-inclusão: ninguém edita nem apaga, nem o admin | MVP | Um `UPDATE` ou `DELETE` na tabela de log falha no próprio banco, inclusive com o usuário de banco da API. A verificação do hash encadeado não aponta nenhuma quebra. |
| RF-39 | Consulta de logs com filtros por usuário, imagem e período | MVP | O admin consulta o log de todo o sistema e o gestor, só o do próprio projeto, combinando os três filtros, com resultado paginado. Avaliador e validador recebem 403 na rota. |

### 5.9 Exportação

| ID | Requisito | Fase | Critério de aceitação |
| --- | --- | --- | --- |
| RF-40 | Exportar anotações em JSON no formato do Labelme e relatório CSV com contagens e índice por imagem (gestor) | MVP | A exportação de um lote gera um JSON por imagem e análise no formato do Labelme, com pontos, caixas e polígonos, que abre no Labelme sem erro, e um CSV com imagem, avaliador, contagem por label e índice. Toda exportação vai para o log. |

### 5.10 Requisitos derivados

Não estavam numerados no levantamento, mas decorrem dele.

| ID | Requisito | Origem | Fase | Critério de aceitação |
| --- | --- | --- | --- | --- |
| RF-41 | Configurar labels: nome, cor, símbolo e papel no índice (positivo, negativo ou fora da contagem) | Tabela de papéis ("configurar labels") e [Q4](#11-perguntas-em-aberto) | F2 | O gestor cria e edita as labels do projeto. Uma label já usada só pode ser desativada, e o índice passa a considerar o papel de cada label. |
| RF-42 | Reabrir análise finalizada | Regra de negócio RN-04 (*a confirmar*) | F2 | Só o gestor do projeto reabre, com justificativa obrigatória. A reabertura cria uma versão do tipo `REABERTURA`, volta o status para `EM_ANDAMENTO` e gera log. |

## 6. Cenários críticos

Os requisitos que sustentam a confiança nos dados ganham cenários completos, no formato *dado / quando / então*. Cada linha vira um teste ponta a ponta (e2e) da API, que roda no CI. Nos exemplos, A1 e A2 são dois avaliadores da mesma imagem.

**Cegamento entre avaliadores (RF-26, RF-27, RF-28)**

| Cenário | Dado | Quando | Então |
| --- | --- | --- | --- |
| A2 não enxerga o trabalho de A1 | A imagem IMG-0042 foi atribuída a A1 e A2, e A1 salvou 30 marcações e uma observação | A2 abre a IMG-0042 | A2 vê só as próprias marcações, e nenhuma resposta da API para A2 contém marcações, observação ou nome de A1 |
| Requisição forjada é barrada | O mesmo cenário acima | A2 envia `GET /analises/{id da análise de A1}` com o próprio token | A API responde 404, sem revelar que a análise existe, e o log registra `ACESSO_NEGADO` para A2 |
| Gestor não avalia no próprio projeto | G é gestor do projeto da IMG-0042 | Alguém tenta atribuir a IMG-0042 a G | A atribuição é recusada (RN-07) |

**Versionamento sem perda (RF-33, RF-34)**

| Cenário | Dado | Quando | Então |
| --- | --- | --- | --- |
| Restaurar não apaga o que veio depois | A análise de A1 tem as versões 1 a 5 | A1 restaura a versão 3 | Passa a existir a versão 6, com o mesmo conteúdo da 3, e as versões 4 e 5 continuam no histórico |

**Comparação só com tudo finalizado (RF-29, RF-30, RN-05)**

| Cenário | Dado | Quando | Então |
| --- | --- | --- | --- |
| Imagem incompleta não vai para comparação | O lote tem N = 3 e só 2 das 3 análises da IMG-0042 estão finalizadas | O validador abre a fila de validação | A IMG-0042 não aparece; ela entra na fila quando a 3ª análise for finalizada |

**Log somente-inclusão (RF-38)**

| Cenário | Dado | Quando | Então |
| --- | --- | --- | --- |
| Nem o administrador apaga o log | Existe o registro de log de id 100 | O admin, ou a própria conexão da API, tenta alterar ou apagar esse registro | O banco recusa a operação e o registro 100 continua igual |

## 7. Requisitos não funcionais

O app é cross-platform: uma base de código para web, Android e iOS, com o mesmo backend e as mesmas regras de acesso. Cada RNF tem uma métrica ou verificação objetiva.

| ID | Categoria | Requisito | Critério de aceitação |
| --- | --- | --- | --- |
| RNF-01 | Plataformas e versões mínimas | Web, Android e iOS a partir de uma base de código (Expo SDK 57). Android 7.0+ (API 24), iOS 16.4+ e navegadores Chrome, Edge, Firefox e Safari nas duas últimas versões. Retrato e paisagem; a anotação é pensada primeiro para tablet e desktop ([Q6](#11-perguntas-em-aberto)). | O mesmo commit gera o app web e roda no Expo Go em Android e iOS; o CI faz o build web a cada pull request. |
| RNF-02 | Paridade | Mesmas funções de anotação em todas as plataformas; muda só a interação (mouse e teclado × toque). | Os critérios de RF-12 a RF-15 e RF-21 passam na web e em pelo menos um celular a cada entrega. |
| RNF-03 | Desempenho | Centenas a milhares de marcações por imagem sem travar, inclusive em celulares intermediários. | Com 2.000 marcações, pan e zoom ficam a 30 fps ou mais num Android intermediário (4 GB de RAM) e a 50 fps ou mais no desktop; marcar responde em menos de 100 ms; a pré-anotação de uma imagem de 4.096 px fica pronta em até 10 s depois do upload. |
| RNF-04 | Imagens grandes | No MVP, campos capturados (JPG, PNG, TIFF) de até 50 MB. Imagens com mais de 4.096 px no maior lado são exibidas a partir de uma cópia reduzida gerada no upload, sem mudar o original nem o sistema de coordenadas. Lâminas inteiras (WSI) com tiles e zoom progressivo só depois do MVP, se a [Q5](#11-perguntas-em-aberto) confirmar. | Uma imagem de 8.000 × 6.000 px abre no celular em até 3 s numa rede Wi-Fi e as coordenadas exportadas correspondem ao arquivo original. |
| RNF-05 | Conectividade (funcionamento offline) | MVP: login, listas e abertura de imagens exigem rede; a análise já aberta continua editável sem conexão e o rascunho fica no aparelho até a rede voltar. *Sugestão* para a fase 2: fila completa de sincronização. | Derrubar a rede durante a anotação, fazer 20 marcações e reconectar: as 20 chegam ao servidor, sem duplicar nem perder nenhuma. |
| RNF-06 | Segurança | HTTPS; senhas com hash argon2id; imagens em bucket privado no Cloudflare R2, entregues por URL assinada de 5 min; nada sensível em cache aberto no aparelho. | URL assinada expirada é recusada; respostas de imagem trazem `Cache-Control: no-store`; o token fica no SecureStore (Android/iOS) ou em cookie `httpOnly` (web), nunca em AsyncStorage ou localStorage; login e código 2FA aceitam no máximo 5 tentativas a cada 15 min. |
| RNF-07 | LGPD | Imagens anonimizadas (sem nome do paciente em metadados ou no rótulo da lâmina), base legal definida e aprovação no CEP, por ser pesquisa. Detalhes na [seção 8](#8-privacidade-e-lgpd). | O upload alerta sobre metadados de texto (EXIF/TIFF) antes de aceitar o arquivo; não existe dado de paciente no banco, no repositório nem nos seeds. |
| RNF-08 | Rastreabilidade | Toda anotação vinculada a usuário, versão, data/hora e dispositivo. | Autor, data/hora (UTC), número sequencial e dispositivo (plataforma e versão do app) são campos obrigatórios de toda versão. |
| RNF-09 | Backup | Backup periódico de banco, imagens e logs. | Backup diário do banco no Supabase, com retenção de 30 dias: o backup automático do Supabase, que depende do plano contratado, ou um `pg_dump` agendado no CI enquanto o projeto estiver no plano gratuito. O bucket de imagens no R2 tem cópia diária para um segundo bucket, e uma restauração completa é testada antes de cada entrega. |
| RNF-10 | Usabilidade | Atalhos de teclado na web; pinça e toque longo no mobile; alvos de toque grandes o bastante para marcar núcleos. | Atalhos: `1` e `2` trocam a label, `P` ponto, `C` caixa, `G` polígono, `Z` desfaz, `Shift+Z` refaz, espaço + arrastar move. No celular, o toque longo abre o menu da marcação (trocar label, excluir) e uma lupa mostra a área sob o dedo durante a marcação. |
| RNF-11 | Permissões do dispositivo | O app não pede câmera, localização, contatos nem notificações. O upload usa o seletor de arquivos do sistema, que dispensa permissão. | Nenhuma janela de permissão aparece no primeiro uso. Se a fase 2 trouxer notificações (por exemplo, "nova imagem atribuída"), o pedido acontece só na hora do uso e explica o motivo. |
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
| Imagens das lâminas | Pacientes, de forma indireta | Bucket privado no Cloudflare R2 | Conforme o protocolo aprovado no CEP | Chegam anonimizadas: sem nome, prontuário ou rótulo da lâmina |
| Sessão | Usuário | SecureStore (Android/iOS) ou cookie `httpOnly` (web) | Até o logout ou a expiração | O logout apaga |
| Rascunho da análise aberta | Usuário | Armazenamento do app no aparelho | Até o servidor confirmar o salvamento, ou até o logout | Só coordenadas, labels e observação; nenhuma imagem é gravada no aparelho |

**Base legal.** Imagens corretamente anonimizadas deixam de ser dado pessoal (art. 12 da LGPD). Para o estudo em si e para os dados dos usuários, a base legal (por exemplo, realização de estudos por órgão de pesquisa, art. 7º, IV e art. 11, II, "c") será confirmada com a instituição e com o Comitê de Ética em Pesquisa antes do uso com imagens reais. Banco e imagens ficam em serviços de terceiros. O projeto Supabase é criado na região de São Paulo, para os dados permanecerem no Brasil. No Cloudflare R2, a região disponível para o bucket precisa ser conferida, porque um armazenamento fora do país conta como transferência internacional. Os termos de tratamento de dados dos dois provedores entram nessa avaliação. Até lá, o desenvolvimento usa apenas imagens sintéticas ou de bases públicas com licença compatível.

## 9. Regras de negócio

| ID | Regra | Garantida por |
| --- | --- | --- |
| RN-01 | Só o admin cadastra usuários, cria projetos e designa gestores; só o gestor do projeto sobe e distribui imagens. | RF-04, RF-08, RF-09 |
| RN-02 | Uma anotação pertence a exatamente um usuário, e ninguém mais pode editá-la. | RF-26, RF-28 |
| RN-03 | O avaliador só vê as imagens que recebeu e as próprias anotações. | RF-22, RF-27 |
| RN-04 | Uma análise finalizada só é reaberta pelo gestor do projeto, o que gera nova versão e registro no log. *(A confirmar.)* | RF-42 |
| RN-05 | Uma imagem só vai para comparação depois que as N análises forem finalizadas. | RF-29, RF-30 |
| RN-06 | Nenhum registro de log ou versão é apagado. | RF-33, RF-38 |
| RN-07 | Quem é gestor de um projeto não pode ser avaliador nele, porque vê todas as análises. | RF-10 |
| RN-08 | Ninguém valida uma imagem que também anotou. | RF-30, RF-32 |

## 10. Fora do escopo

O que o Ki67 **não** faz. A lista protege o cronograma e evita discutir na última hora uma função que nunca foi combinada.

1. **Diagnóstico ou laudo clínico.** O Ki67 é ferramenta de pesquisa e anotação; não substitui o laudo do patologista e não é dispositivo médico regulamentado.
2. **Dados identificáveis de pacientes** e integração com prontuário, LIS ou PACS.
3. **Labelme dentro do app.** Ele serve só de referência de funcionalidades e de formato de exportação.
4. **Treinar ou hospedar modelos de IA.** A pré-anotação é feita por limiar de cor ([Q3](#11-perguntas-em-aberto)).
5. **Autocadastro, login social** ou acesso por link público.
6. **Exclusão definitiva** de usuários, análises, versões ou logs.
7. **Edição da imagem original** (filtros, ajuste de cor, recorte).
8. **Lâminas inteiras (WSI)** no MVP.
9. **Chat ou comentários entre avaliadores**, que quebrariam o cegamento.
10. **Notificações push, modo offline completo e publicação nas lojas** no MVP: a distribuição é pela web e pelo Expo Go ou build interno.
11. **Outros idiomas** além do português.

## 11. Perguntas em aberto

Estas decisões mudam escopo ou arquitetura. Enquanto não forem fechadas com o cliente, o desenvolvimento segue a premissa da terceira coluna, escolhida para ser barata de mudar.

| ID | Pergunta | Premissa adotada até a decisão | Se mudar, afeta |
| --- | --- | --- | --- |
| Q1 | Validador e avaliador são papéis diferentes? Quem valida? | Papéis separados, assim como o gestor. Um usuário pode ter vários papéis, mas o sistema impede que alguém valide uma imagem que anotou (RN-08) ou avalie no projeto que gerencia (RN-07). | RF-07, RF-30, RF-32 |
| Q2 | Se todos recebem a mesma pré-anotação, ela enviesa a análise que o cegamento protege? Vale registrar o que veio da máquina e o que foi marcado à mão? | Sim: cada marcação guarda a origem (`manual`, `pre_anotacao`, `pre_anotacao_editada`), o que permite medir o efeito da pré-anotação na concordância. | Modelo de dados, RF-31 |
| Q3 | Já existe modelo de detecção ou segmentação, ou será treinado? | Pré-anotação por limiar de cor sobre os núcleos azul-claros, já no MVP; modelo treinado é trabalho futuro. | RF-17, RF-18 |
| Q4 | Só reagente e não reagente, ou também intensidade, artefato e "excluir da contagem"? | Duas labels no MVP. Labels são dados (tabela), não código: incluir outras não exige nova versão do app. | RF-12, RF-41, índice |
| Q5 | Campos capturados (JPG/PNG/TIFF) ou lâminas inteiras (WSI)? | Campos capturados de até 50 MB. | RNF-04, armazenamento, canvas |
| Q6 | O avaliador vai anotar no celular ou só no tablet e no desktop? | Funciona no celular, mas a experiência é desenhada primeiro para tablet e desktop. | RNF-10, layout |
| Q7 | Anota a imagem toda ou escolhe hotspots antes de contar? | Imagem toda: o campo capturado já é a região escolhida. | Modelo de dados, índice |
| Q8 | Quantas imagens e usuários são esperados? | Dezenas de usuários, alguns milhares de imagens e até cerca de 2.000 marcações por imagem. | RNF-03, custos |
| Q9 | Nuvem ou servidor da instituição? | **Decidido:** banco no Supabase (região São Paulo) e imagens no Cloudflare R2. Ainda em aberto: onde roda a API (nuvem ou servidor da instituição). | Implantação, backup, LGPD |
| Q10 | Flutter, React Native + web ou outra stack? | **Decidida:** React Native com Expo (web via React Native Web) e canvas Skia, revista depois da prova de conceito da Sprint 0. | Toda a [arquitetura](02-arquitetura.md) |

## 12. Glossário

| Termo | Significado |
| --- | --- |
| **Ki-67** | Proteína do núcleo presente em células em divisão e ausente nas células em repouso. |
| **Imuno-histoquímica (IHC)** | Técnica que usa anticorpos para corar uma proteína específica no tecido. |
| **Núcleo reagente** | Núcleo corado de marrom, ou seja, com Ki-67 (positivo). |
| **Núcleo não reagente** | Núcleo só com a contracoloração azul de hematoxilina, sem Ki-67 (negativo). |
| **Índice Ki-67** | Percentual de núcleos reagentes entre os núcleos contados. |
| **Avaliador** | Quem anota as imagens; em geral, um patologista. |
| **Gestor do projeto** | Responsável por um estudo no sistema, como o patologista líder ou o pesquisador principal. |
| **N** | Número de avaliadores que anotam cada imagem de um lote, definido pelo gestor. |
| **Cegamento** | Cada avaliador anota sem acesso ao trabalho dos outros, para que uma análise não influencie a outra. |
| **Pré-anotação** | Marcações sugeridas pelo sistema, que o avaliador aceita, corrige ou remove. |
| **Concordância** | O quanto as análises de avaliadores diferentes sobre a mesma imagem coincidem. |
| **Hotspot** | Região com maior concentração de núcleos reagentes, às vezes escolhida para a contagem. |
| **WSI** | *Whole slide image*: imagem digital da lâmina inteira, com bilhões de pixels (.svs, .ndpi). |
| **Bounding box / polígono** | Retângulo que delimita um objeto (detecção) / contorno ponto a ponto (segmentação). |
| **Labelme** | Ferramenta de anotação de imagens cujo formato JSON (pontos, retângulos e polígonos) o Ki67 usa na exportação. |
| **SHA-256** | Impressão digital de um arquivo: qualquer alteração no arquivo muda o hash. |
| **Log somente-inclusão** | Registro em que só se acrescentam linhas; nenhuma é alterada ou apagada. |
| **CEP** | Comitê de Ética em Pesquisa, que aprova estudos com dados de seres humanos. |
| **2FA** | Segundo fator de autenticação; aqui, um código enviado por e-mail. |

---

| Versão | Data | Mudança |
| --- | --- | --- |
| 0.1 | 07/10/2026 | Estrutura inicial a partir do levantamento de requisitos de 23/09/2026. |
| 0.2 | 07/10/2026 | Banco no Supabase: LGPD (onde ficam os dados), backup (RNF-09) e Q9 parcialmente decidida. |
| 0.3 | 07/10/2026 | Retorno do professor: papel "avaliador" no lugar de "patologista", novo papel de gestor do projeto, N avaliadores por imagem, pré-anotação, caixas, polígonos, índice e comparação no MVP, COCO removido, imagens no Cloudflare R2 e cenários críticos em tabela. |
