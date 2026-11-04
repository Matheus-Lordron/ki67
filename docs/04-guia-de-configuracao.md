# 04 · Guia de configuração (Supabase + Cloudflare R2 + app)

Passo a passo para sair do modo demonstração e usar dados reais. Sem o `.env` preenchido, o app continua funcionando no **modo demonstração** (dados em memória).

## 1. Supabase: banco

1. Crie um projeto em <https://supabase.com> (região **São Paulo**). Anote a senha do banco.
2. Aplique as migrações de `supabase/migrations/`, em ordem. Escolha um caminho:
   - **Supabase CLI (recomendado):** `npx supabase link --project-ref <ref-do-projeto>` e depois `npx supabase db push`. O CLI guarda quais migrações já rodaram e só aplica as novas.
   - **SQL Editor:** abra **SQL Editor > New query**, cole cada arquivo de `supabase/migrations/` em ordem de nome, uma vez cada, e clique em **Run**.
   - **Já tem o banco criado pelo antigo `schema.sql` (com os patches)?** Ele é igual à migração base. Antes do primeiro `db push`, marque a base como aplicada, sem rodá-la: `npx supabase migration repair --status applied 20261026120000`. Depois disso, o `db push` só aplica as migrações novas.
   - **Para testar localmente (Docker):** `npx supabase db start` e `npx supabase db reset --local` criam o banco do zero com as migrações; `npx supabase test db` roda os testes pgTAP.
3. Em **Authentication > Sign In / Providers**, desligue **Allow new users to sign up** (não há autocadastro, RF-04).
4. Em **Authentication > URL Configuration**, preencha:
   - **Site URL:** `http://localhost:8081`
   - **Redirect URLs:** `http://localhost:8081/redefinir-senha`
5. Em **Authentication > Emails > SMTP Settings**, configure um SMTP próprio. O SMTP embutido envia poucos e-mails por hora. O Resend serve aqui também.
6. Crie o primeiro admin: **Authentication > Users > Add user**, com e-mail, senha e **Auto Confirm**. Depois rode `supabase/bootstrap_admin.sql`, trocando o e-mail pelo seu.

## 2. Cloudflare R2: imagens

1. Cloudflare > **R2 > Create bucket** com o nome `ki67-imagens`. Mantenha o bucket privado, sem domínio público.
2. No bucket, abra **Settings > CORS policy** e cole:
   ```json
   [{ "AllowedOrigins": ["http://localhost:8081"], "AllowedMethods": ["GET", "PUT", "HEAD"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
   ```
3. Em **R2 > Manage API tokens > Create API token**, dê a permissão **Object Read & Write** só nesse bucket. Anote o **Access Key ID** e o **Secret Access Key**. O **Account ID** aparece na página inicial do R2.

## 3. E-mail do código 2FA (Resend)

Crie uma conta em <https://resend.com> e gere uma **API Key**. Sem domínio verificado, o Resend só envia para o e-mail da sua própria conta, o que basta para testar.

## 4. Edge Functions

No terminal do VS Code, na pasta `ki67`:

```bash
npx supabase login
```

```bash
npx supabase link --project-ref SEU_PROJECT_REF
```

Copie `supabase/functions/.env.example` para `supabase/functions/.env`, preencha as chaves do R2 e do Resend e rode:

```bash
npx supabase secrets set --env-file supabase/functions/.env
```

```bash
npx supabase functions deploy
```

As funções implantadas são `auth-login`, `auth-resend-2fa`, `admin-create-user`, `r2-upload-url` e `r2-download-url`.

## 5. App

1. Copie `apps/mobile/.env.example` para `apps/mobile/.env` e preencha `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (em **Project Settings > API Keys**). **Nunca** use a chave secret/service_role aqui.
2. Na pasta `ki67`, rode:

```bash
npm install
```

```bash
npm run dev:web
```

3. Abra <http://localhost:8081/diagnostico> para conferir a conexão: a tela diz se o `.env` foi lido e se as migrações do banco já foram aplicadas.
4. Abra <http://localhost:8081> e entre com o admin. O código 2FA chega por e-mail.
5. Para o Android, rode `npm run dev:android` com o emulador aberto, ou escaneie o QR code com o Expo Go.

## O que fica para depois

- A pré-anotação por limiar de cor é calculada no upload feito pela **web**. Uploads pelo celular entram sem pré-anotação.
- O link de redefinir senha foi pensado para abrir no navegador.
- A cópia reduzida de imagens acima de 4.096 px ainda não é gerada: o app abre o original.
- A lista completa de limitações está no fim de [02 · Arquitetura](02-arquitetura.md#limitações-conhecidas).
