# 09 · Passagem da refatoração (até 18/11/2026)

Este documento é para quem vai continuar a refatoração. Ele diz o que está pronto, o que falta implantar, o que falta fazer e como trabalhar sem quebrar o que já existe. O plano completo continua em [05](05-plano-de-refatoracao.md) e [06](06-plano-de-execucao.md).

## 1. O que está pronto

| Tarefa | O que mudou | PR | Ambiente real |
|---|---|---|---|
| R-05 | Testes do banco com pgTAP no CI (RLS de cada papel, 2FA, imutabilidade, log) | mesclado | — |
| R-06 | Edge Functions separadas em `handler.ts` (regra) e `index.ts` (só `Deno.serve`), com testes que simulam Supabase e R2 | #14 | implantado |
| R-10 | CORS: sem `APP_ORIGINS` configurado, navegador é recusado | #15 | implantado |
| R-11 | A URL de envio assina tamanho, tipo e SHA-256; o R2 confere o arquivo | #16 | implantado (falta o teste manual, seção 3) |
| R-14 | Limite de login por IP e por e-mail + IP, com resposta e tempo iguais | #18 | implantado |
| R-18 | Falha de login grava o hash do e-mail com sal (em `private.secrets`), não o e-mail | #19 | implantado |
| R-12 parte 1 | Quarentena no bucket e conferência do arquivo no servidor (`r2-confirm-upload`) | #21 | **não implantado** |
| R-12 parte 2 | O app envia pela quarentena; o `register_image` fica fechado para o app | próximo PR | **não implantado** |

Também foi corrigido o clique duplo que criava projetos e lotes repetidos (chave `request_id`).

## 2. Como o envio de imagens funciona agora (R-12)

1. O app tira os metadados de texto (EXIF, XMP, IPTC, textos de PNG, tags de TIFF), calcula o SHA-256 e pede a URL à `r2-upload-url` com `quarantine: true`.
2. O arquivo vai para `quarantine/<projeto>/<lote>/<sha256>.<ext>`.
3. O app chama a `r2-confirm-upload`. O servidor baixa o arquivo e confere hash, tamanho (até 50 MB), formato pelos bytes, dimensões e metadados.
4. Se algo não confere, o arquivo é **recusado e apagado** da quarentena, e a recusa vai para o log (`UPLOAD_RECUSADO`). O servidor não tenta limpar o arquivo.
5. Se está tudo certo, ele grava em `projects/...` e registra a imagem pela RPC `register_verified_image`, que só o backend executa.

**Atenção a duas cópias do inspetor.** A leitura de metadados existe no app (`apps/mobile/src/utils/imageMetadata.ts`, que também higieniza) e no servidor (`supabase/functions/_shared/imageInspect.ts`, só leitura). As duas usam as mesmas 14 imagens de exemplo em `tests/fixtures/imagens/`. **Ao mudar uma regra, mude nas duas e regere as imagens:**

```bash
deno run --allow-read --allow-write tests/fixtures/imagens/gerar.ts
```

Se só uma das cópias mudar, os testes do app ou do Deno falham.

## 3. O que falta implantar (só com autorização do grupo)

O administrador faz o deploy depois do merge de #21 e do PR da parte 2. **A ordem importa**:

1. **Cloudflare R2:** no bucket `ki67-imagens`, crie a regra de ciclo de vida `limpa-quarentena`, com prefixo `quarantine/` e exclusão depois de 1 dia. **Nunca** crie regra para `projects/`.
2. **Banco:** `git pull` na `main`. O `npx supabase migration list` deve mostrar pendentes só a `20261113120000` e a `20261118120000`. Depois rode `npx supabase db push`. **Nunca rode `db reset` com o projeto ligado.**
3. **Funções:** `npx supabase functions deploy`, que deve publicar 6 funções, entre elas a `r2-confirm-upload`. Faça logo depois do passo 2: no intervalo, o envio de imagens fica parado.
4. **App:** use a `main` atualizada. Um app antigo recebe erro de permissão ao registrar imagem.

Depois, confira:
- O envio de uma imagem normal funciona.
- Uma imagem com EXIF enviada **fora do app** é recusada.
- O `/diagnostico` está OK.

**Testes que só dá para fazer no ambiente real:**
- O R2 recusa um arquivo trocado depois de pedir a URL (R-11).
- CPU e memória da `r2-confirm-upload` com arquivos perto de 50 MB.
- Um cabeçalho `x-forwarded-for` forjado não deve driblar o limite de login (R-14).

## 4. O que falta fazer

Na ordem sugerida pelo [06](06-plano-de-execucao.md):

| Tarefa | Resumo | Observação |
|---|---|---|
| R-17 | Log pseudonimizado: o log guarda só um identificador opaco; dados pessoais numa tabela separada que pode ser anonimizada | Grande e sensível: mexe na cadeia de hash do log. As falhas de login gravadas **antes** do R-18 ainda têm o e-mail em texto, e o log é imutável. Decidir em grupo como tratar |
| R-13 | Modo demonstração só com `EXPO_PUBLIC_DEMO=true` | Pequena |
| R-15 | CSP e cabeçalhos de segurança da versão web | Depende de onde a web vai ser hospedada |
| R-16 | `docs/07-privacidade-lgpd.md` (registro das operações, RIPD, retenção, operadores) | Só documento; base para o R-19 |
| R-19 | Retenção automática com `pg_cron` | Usa os prazos do R-16 |
| R-20, R-21 | Aceite do aviso de privacidade; exportação dos próprios dados e anonimização | |
| R-24, R-25, R-27 a R-30 | Classes por projeto, admin edita projeto, equipe do projeto, rascunho, comparar versões, reavaliação | Funcionalidades de produto |
| R-08 | Tipos do banco gerados pelo `supabase gen types` e conferidos no CI | |
| R-09 | Fechamento da validação só com contagens | **Bloqueada**: ver o 06 |
| R-07 | Mover `apps/mobile` → `frontend/` e `supabase/` → `backend/supabase/` | Só no fim, num momento sem PRs abertos |

**Achados que ainda não viraram tarefa.** Os testes de caracterização do banco mostraram o comportamento atual, mas nada foi mudado:
- O gestor lê perfis de usuários de outros projetos.
- O admin não lê as análises.
- O próprio perfil é legível antes do 2FA.

Decidam em grupo se algum deles é problema.

## 5. Como trabalhar

- **Cada um na sua branch, um PR por tarefa para a `main`.** O administrador revisa e mescla. Ninguém faz commit direto na `main`.
- **TDD:** primeiro um commit `test(...)` que falha, depois o `fix(...)` ou `feat(...)` que o faz passar. O ID da tarefa vai na mensagem, por exemplo `fix(auth): ... (R-18)`.
- **Antes de enviar**, confira as mensagens dos commits:
  ```bash
  npx --yes @commitlint/cli@21.2.3 --config commitlint.config.mjs --from origin/main --to HEAD
  ```
- **Mudança de banco:** sempre uma migração nova em `supabase/migrations/`, nunca editar uma antiga, e um teste pgTAP em `supabase/tests/database/`.
- **Nunca mexer no Supabase ou no Cloudflare reais** sem autorização do grupo. Quem implanta é o administrador.
- **LGPD:** nada de dado de paciente em imagens de teste. Nenhum e-mail em texto no log.

**Rodar tudo localmente** (precisa do Docker Desktop aberto):

```bash
# Banco (pgTAP: 137 verificações)
npx supabase start
npx supabase db reset --local
npx supabase test db

# Edge Functions (Deno), dentro de supabase/functions
deno test --allow-env --allow-read=../../tests/fixtures --allow-net=none --node-modules-dir=none tests/

# App, dentro de apps/mobile
npm test
npx tsc --noEmit
npx expo lint
```

Se o Deno criar um `deno.lock` na raiz do repositório, apague-o.
