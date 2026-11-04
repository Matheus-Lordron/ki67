-- =============================================================================
-- Segmenta Studio · Ki-67 IHC — migração base do banco no Supabase (R-04)
--
-- É o antigo supabase/schema.sql, que já incluía patch_fase4.sql e
-- patch_idempotencia.sql. Daqui em diante, toda mudança no banco é uma
-- migração NOVA nesta pasta; esta não é editada depois de aplicada.
--
-- COMO USAR (detalhes em docs/04-guia-de-configuracao.md)
--   • Local (Docker): npx supabase db reset --local
--   • Projeto Supabase NOVO: npx supabase link e npx supabase db push,
--     ou cole as migrações no SQL Editor, em ordem, uma vez cada.
--   • Depois rode supabase/bootstrap_admin.sql para criar o primeiro admin.
--
-- DECISÃO DE ARQUITETURA (substitui a D3 de docs/02-arquitetura.md)
--   O app fala direto com o Supabase (Auth + PostgREST) e as regras de negócio
--   ficam aqui, no banco:
--   • RLS em todas as tabelas: cada papel só enxerga o que pode ver.
--   • Toda escrita sensível (salvar versão, finalizar, atribuir, validar,
--     registrar upload) passa por funções RPC SECURITY DEFINER. O app não tem
--     INSERT/UPDATE direto nessas tabelas.
--   • Triggers garantem as regras mesmo contra o painel (WORM, RN-07, RF-29).
--   • 2FA por e-mail: o Supabase Auth faz o login com senha; uma Edge Function
--     envia o código (issue_two_factor_code) e o app confirma com
--     verify_two_factor_code. Enquanto a sessão não confirmar o código, as
--     políticas RLS não liberam nenhum dado.
--
-- CONVENÇÕES
--   • Tabelas e colunas em inglês, espelhando src/types/index.ts do protótipo.
--     Valores de enum em português, como na documentação.
--   • Marcações (marks) ficam em JSONB, um snapshot completo por versão (D4):
--     [{ "id", "type": "point|box|polygon", "label": "<labels.key>", ... }]
--     Coordenadas em % da imagem (0 a 100), como no app (D5); a exportação
--     Labelme converte para pixels.
--   • Funções auxiliares ficam no schema "private", que o PostgREST não expõe.
--   • Erros: RPCs devolvem { ok:false, error } quando o acesso é negado (para o
--     log ACESSO_NEGADO não ser desfeito) e lançam exceção nos demais casos.
--     Códigos 'PTxxx' viram o status HTTP xxx no PostgREST (ex.: PT409).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0. Extensões e schema privado
-- -----------------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;  -- gen_random_bytes (código 2FA)

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role, supabase_auth_admin;


-- -----------------------------------------------------------------------------
-- 1. Tipos enumerados
-- -----------------------------------------------------------------------------
create type public.app_role         as enum ('admin', 'gestor', 'avaliador', 'validador');
create type public.project_status   as enum ('ativo', 'pausado', 'concluido');
-- Ciclo de vida da imagem (02-arquitetura.md §7). 'concluida' = lote com N = 1.
create type public.image_status     as enum ('nao_atribuida', 'aguardando_analises', 'pronta_para_validacao', 'validada', 'concluida');
create type public.analysis_status  as enum ('pendente', 'em_andamento', 'finalizada');
create type public.version_kind     as enum ('autosave', 'manual', 'finalizacao', 'restauracao', 'reabertura');
create type public.validation_kind  as enum ('escolha', 'consenso');
create type public.audit_category   as enum ('auth', 'annotation', 'validation', 'batch', 'user_management', 'security', 'export');
create type public.label_index_role as enum ('positivo', 'negativo', 'ignorar');
create type public.label_symbol     as enum ('circulo', 'anel', 'quadrado', 'triangulo', 'losango');


-- -----------------------------------------------------------------------------
-- 2. Configurações do sistema (linha única)
-- -----------------------------------------------------------------------------
create table private.app_settings (
  id                      boolean primary key default true check (id),
  require_two_factor      boolean  not null default true,   -- RF-02 (deixe true fora do desenvolvimento)
  two_factor_ttl          interval not null default interval '10 minutes',
  two_factor_max_attempts smallint not null default 5,
  two_factor_max_per_15m  smallint not null default 5,      -- RNF-06: códigos emitidos a cada 15 min
  max_upload_bytes        bigint   not null default 52428800, -- RF-08: 50 MB
  updated_at              timestamptz not null default now()
);
insert into private.app_settings default values;


-- -----------------------------------------------------------------------------
-- 3. Tabelas
-- -----------------------------------------------------------------------------

-- 3.1 Perfis: 1:1 com auth.users. Nunca excluídos, só desativados (RF-06).
create table public.profiles (
  id             uuid primary key references auth.users (id) on delete restrict,
  name           text not null check (char_length(btrim(name)) between 2 and 120),
  email          text not null unique check (email = lower(email)),
  roles          public.app_role[] not null default '{}',
  is_active      boolean not null default true,
  institution    text check (char_length(institution) <= 160),
  avatar_url     text check (char_length(avatar_url) <= 500),
  last_login_at  timestamptz,
  deactivated_at timestamptz,
  deactivated_by uuid references public.profiles (id),
  created_by     uuid references public.profiles (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index profiles_roles_idx on public.profiles using gin (roles);

-- 3.2 Projetos (estudos). Criados pelo admin, conduzidos por um gestor (RF-09).
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-Z0-9][A-Z0-9-]{1,31}$'),
  name        text not null check (char_length(btrim(name)) between 3 and 160),
  description text not null default '' check (char_length(description) <= 4000),
  manager_id  uuid not null references public.profiles (id),
  status      public.project_status not null default 'ativo',
  request_id  uuid unique,                       -- chave do formulário: reenviar não duplica
  created_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index projects_manager_idx on public.projects (manager_id);

-- 3.3 Labels por projeto. As marcações referenciam labels.key (ex.: 'reagente').
create table public.labels (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id),
  key         text not null check (key ~ '^[a-z][a-z0-9_]{1,39}$'),
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  color       text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  symbol      public.label_symbol not null,
  index_role  public.label_index_role not null,
  is_active   boolean not null default true,
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now(),
  unique (project_id, key)
);

-- 3.4 Lotes. N = avaliadores por imagem (RF-29), padrão 3. Máx. 26 (letras A–Z).
create table public.batches (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references public.projects (id),
  code                 text not null check (code ~ '^[A-Z0-9]{2,12}$'),
  name                 text not null check (char_length(btrim(name)) between 2 and 160),
  description          text not null default '' check (char_length(description) <= 4000),
  evaluators_per_image smallint not null default 3 check (evaluators_per_image between 1 and 26),
  request_id           uuid unique,              -- chave do formulário: reenviar não duplica
  created_by           uuid references public.profiles (id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (project_id, code)
);
create index batches_project_idx on public.batches (project_id);

-- 3.5 Imagens. Código anonimizado no formato <lote>-<sequência>, ex.: LT01-0042.
--     O nome original do arquivo NÃO é guardado (pode conter dado do paciente).
create table public.images (
  id                    uuid primary key default gen_random_uuid(),
  batch_id              uuid not null references public.batches (id),
  project_id            uuid not null references public.projects (id),  -- cópia de batches.project_id, para o RLS
  code                  text not null,
  sequence_number       integer not null check (sequence_number > 0),
  status                public.image_status not null default 'nao_atribuida',
  organ                 text check (char_length(organ) <= 160),
  optical_magnification text check (char_length(optical_magnification) <= 40),
  uploaded_by           uuid not null references public.profiles (id),
  created_at            timestamptz not null default now(),
  status_changed_at     timestamptz not null default now(),
  unique (project_id, code),
  unique (batch_id, sequence_number)
);
create index images_batch_idx  on public.images (batch_id);
create index images_status_idx on public.images (status);

-- 3.6 Versões do arquivo da imagem (RF-11; RF-36 na fase 2). O original é imutável.
create table public.image_versions (
  id                  uuid primary key default gen_random_uuid(),
  image_id            uuid not null references public.images (id),
  version_number      integer not null default 1 check (version_number >= 1),
  sha256              text not null unique check (sha256 ~ '^[0-9a-f]{64}$'),
  storage_key         text not null unique,      -- chave do objeto no bucket R2
  preview_storage_key text,                      -- cópia reduzida (> 4.096 px, RNF-04)
  mime_type           text not null check (mime_type in ('image/jpeg', 'image/png', 'image/tiff')),
  size_bytes          bigint not null check (size_bytes > 0),
  width_px            integer not null check (width_px > 0),
  height_px           integer not null check (height_px > 0),
  metadata_sanitized  boolean not null default false,  -- EXIF/TIFF removidos antes do upload (RNF-07)
  pre_annotation      jsonb check (pre_annotation is null or jsonb_typeof(pre_annotation) = 'array'),
  pre_annotation_at   timestamptz,
  uploaded_by         uuid not null references public.profiles (id),
  uploaded_at         timestamptz not null default now(),
  unique (image_id, version_number)
);

-- 3.7 Análises: uma por par (imagem, avaliador) (RF-26).
--     blind_code = letra A, B, C... mostrada ao validador no lugar do nome (RF-30).
create table public.analyses (
  id              uuid primary key default gen_random_uuid(),
  image_id        uuid not null references public.images (id),
  evaluator_id    uuid not null references public.profiles (id),
  blind_code      char(1) not null check (blind_code ~ '^[A-Z]$'),
  status          public.analysis_status not null default 'pendente',
  current_version integer not null default 0 check (current_version >= 0),
  assigned_by     uuid not null references public.profiles (id),
  assigned_at     timestamptz not null default now(),
  started_at      timestamptz,
  last_saved_at   timestamptz,
  finalized_at    timestamptz,
  unique (image_id, evaluator_id),
  unique (image_id, blind_code)
);
create index analyses_evaluator_idx on public.analyses (evaluator_id, status);

-- 3.8 Versões da análise: snapshot imutável a cada salvamento (RF-33, RNF-08).
create table public.analysis_versions (
  id                    uuid primary key default gen_random_uuid(),
  analysis_id           uuid not null references public.analyses (id),
  version_number        integer not null check (version_number >= 1),
  image_version_id      uuid not null references public.image_versions (id),
  author_id             uuid not null references public.profiles (id),
  kind                  public.version_kind not null,
  marks                 jsonb not null check (jsonb_typeof(marks) = 'array'),
  observation           text not null default '' check (char_length(observation) <= 2000),  -- RF-20
  reagents_count        integer not null check (reagents_count >= 0),
  non_reagents_count    integer not null check (non_reagents_count >= 0),
  ki67_index            numeric(4,1) check (ki67_index between 0 and 100),  -- null = "—" (RF-19)
  restored_from_version integer,
  device                text not null check (char_length(btrim(device)) between 1 and 300),
  content_sha256        text not null,
  created_at            timestamptz not null default now(),
  unique (analysis_id, version_number)
);

-- 3.9 Resultado validado / consenso: um por imagem, imutável (RF-32).
create table public.consensus_results (
  id                    uuid primary key default gen_random_uuid(),
  image_id              uuid not null unique references public.images (id),
  validator_id          uuid not null references public.profiles (id),
  kind                  public.validation_kind not null,
  adopted_analysis_id   uuid references public.analyses (id),
  adopted_version_id    uuid references public.analysis_versions (id),
  adopted_blind_code    char(1),
  consensus_marks       jsonb check (consensus_marks is null or jsonb_typeof(consensus_marks) = 'array'),
  reagents_count        integer check (reagents_count >= 0),
  non_reagents_count    integer check (non_reagents_count >= 0),
  consensus_ki67        numeric(4,1) not null check (consensus_ki67 between 0 and 100),
  icc_score             numeric(4,3) check (icc_score between -1 and 1),
  divergence_delta_pp   numeric(4,1) check (divergence_delta_pp >= 0),
  spatial_agreement_pct numeric(4,1) check (spatial_agreement_pct between 0 and 100),
  agreement_metrics     jsonb not null default '{}',
  justification         text not null check (char_length(btrim(justification)) between 10 and 4000),
  device                text not null,
  content_sha256        text not null,
  frozen_at             timestamptz not null default now(),
  check ((kind = 'escolha') = (adopted_analysis_id is not null))
);

-- 3.10 Log de auditoria: somente-inclusão, com hash SHA-256 encadeado (RF-37, RF-38).
create sequence public.audit_logs_id_seq as bigint;
create table public.audit_logs (
  id          bigint primary key,  -- numerado pelo trigger audit_logs_chain, na ordem da cadeia
  occurred_at timestamptz not null default now(),
  user_id     uuid references public.profiles (id),
  user_name   text,                               -- nome no momento da ação
  action      text not null check (action ~ '^[A-Z0-9_]{2,60}$'),
  category    public.audit_category not null,
  entity      text,
  entity_id   uuid,
  project_id  uuid references public.projects (id),
  batch_id    uuid references public.batches (id),
  image_id    uuid references public.images (id),
  details     jsonb not null default '{}',
  ip_address  text,
  device      text,
  prev_hash   text not null,
  hash        text not null unique
);
alter sequence public.audit_logs_id_seq owned by public.audit_logs.id;
create index audit_logs_time_idx    on public.audit_logs (occurred_at desc);
create index audit_logs_user_idx    on public.audit_logs (user_id, occurred_at desc);
create index audit_logs_project_idx on public.audit_logs (project_id, occurred_at desc);
create index audit_logs_image_idx   on public.audit_logs (image_id);

-- 3.11 Desafios de 2FA (RF-02). Só o hash do código é guardado.
create table private.two_factor_challenges (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id),
  session_id  uuid not null,   -- claim session_id do JWT do Supabase Auth
  code_hash   text not null,
  attempts    smallint not null default 0,
  expires_at  timestamptz not null,
  verified_at timestamptz,
  created_at  timestamptz not null default now()
);
create index two_factor_session_idx on private.two_factor_challenges (session_id);
create index two_factor_user_idx    on private.two_factor_challenges (user_id, created_at desc);


-- -----------------------------------------------------------------------------
-- 4. Funções auxiliares (schema private)
-- -----------------------------------------------------------------------------

create function private.sha256_hex(p text) returns text
language sql immutable as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex')
$$;

-- Chamada sem JWT de usuário: SQL Editor, migrações, service_role (Edge Functions)
-- ou o próprio Supabase Auth (triggers em auth.users).
create function private.is_backend() returns boolean
language sql stable as $$
  select auth.jwt() is null or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
$$;

create function private.session_id() returns uuid
language sql stable as $$
  select nullif(auth.jwt() ->> 'session_id', '')::uuid
$$;

create function private.request_headers() returns json
language sql stable as $$
  select nullif(current_setting('request.headers', true), '')::json
$$;

create function private.request_ip() returns text
language sql stable as $$
  select nullif(btrim(coalesce(
           nullif(split_part(h ->> 'x-forwarded-for', ',', 1), ''),
           h ->> 'cf-connecting-ip',
           h ->> 'x-real-ip')), '')
  from (select private.request_headers() as h) s
$$;

create function private.device_label(p_device text) returns text
language sql stable as $$
  select left(coalesce(nullif(btrim(p_device), ''),
                       nullif(btrim(private.request_headers() ->> 'user-agent'), ''),
                       'desconhecido'), 300)
$$;

create function private.two_factor_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select not (select s.require_two_factor from private.app_settings s)
      or exists (select 1 from private.two_factor_challenges c
                 where c.user_id = auth.uid()
                   and c.session_id = private.session_id()
                   and c.verified_at is not null)
$$;

create function private.is_active_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active)
     and private.two_factor_ok()
$$;

create function private.has_role(p_role public.app_role) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.is_active and p_role = any (p.roles))
     and private.two_factor_ok()
$$;

create function private.is_admin() returns boolean
language sql stable as $$ select private.has_role('admin') $$;

create function private.manages_project(p_project_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role('gestor')
     and exists (select 1 from public.projects p where p.id = p_project_id and p.manager_id = auth.uid())
$$;

create function private.manages_image(p_image_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.manages_project((select i.project_id from public.images i where i.id = p_image_id))
$$;

create function private.manages_analysis(p_analysis_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.manages_image((select a.image_id from public.analyses a where a.id = p_analysis_id))
$$;

create function private.owns_analysis(p_analysis_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role('avaliador')
     and exists (select 1 from public.analyses a where a.id = p_analysis_id and a.evaluator_id = auth.uid())
$$;

create function private.evaluates_image(p_image_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role('avaliador')
     and exists (select 1 from public.analyses a where a.image_id = p_image_id and a.evaluator_id = auth.uid())
$$;

create function private.evaluates_in_batch(p_batch_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role('avaliador')
     and exists (select 1 from public.analyses a join public.images i on i.id = a.image_id
                 where i.batch_id = p_batch_id and a.evaluator_id = auth.uid())
$$;

create function private.evaluates_in_project(p_project_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role('avaliador')
     and exists (select 1 from public.analyses a join public.images i on i.id = a.image_id
                 where i.project_id = p_project_id and a.evaluator_id = auth.uid())
$$;

-- RN-05 + RN-08: validador só vê imagens prontas/validadas que ele NÃO anotou.
create function private.can_validate_image(p_image_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role('validador')
     and exists (select 1 from public.images i
                 where i.id = p_image_id and i.status in ('pronta_para_validacao', 'validada'))
     and not exists (select 1 from public.analyses a
                     where a.image_id = p_image_id and a.evaluator_id = auth.uid())
$$;

create function private.can_see_project(p_project_id uuid) returns boolean
language sql stable as $$
  select private.is_admin() or private.manages_project(p_project_id) or private.evaluates_in_project(p_project_id)
$$;

create function private.can_see_image(p_image_id uuid) returns boolean
language sql stable as $$
  select private.manages_image(p_image_id) or private.evaluates_image(p_image_id) or private.can_validate_image(p_image_id)
$$;

-- O gestor enxerga o perfil de quem trabalha nos projetos dele.
create function private.works_in_my_projects(p_profile_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role('gestor') and (
    exists (select 1 from public.analyses a join public.images i on i.id = a.image_id
                                            join public.projects p on p.id = i.project_id
            where a.evaluator_id = p_profile_id and p.manager_id = auth.uid())
    or exists (select 1 from public.consensus_results c join public.images i on i.id = c.image_id
                                                       join public.projects p on p.id = i.project_id
               where c.validator_id = p_profile_id and p.manager_id = auth.uid()))
$$;

create function private.latest_image_version(p_image_id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select v.id from public.image_versions v where v.image_id = p_image_id
  order by v.version_number desc limit 1
$$;

create function private.ki67_index(p_reagents integer, p_non_reagents integer) returns numeric
language sql immutable as $$
  -- Mesma fórmula de calculateKi67Index (src/utils/ki67.ts): 1 casa decimal, null sem núcleos.
  select case when coalesce(p_reagents, 0) + coalesce(p_non_reagents, 0) <= 0 then null
              else round(p_reagents * 100.0 / (p_reagents + p_non_reagents), 1) end
$$;

-- Valida o array de marcações e conta núcleos pelo papel de cada label no índice.
-- O servidor recalcula as contagens: nunca confia nos totais enviados pelo app.
create function private.count_marks(p_project_id uuid, p_marks jsonb,
                                    out reagents integer, out non_reagents integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_bad text;
begin
  if p_marks is null or jsonb_typeof(p_marks) <> 'array' then
    raise exception 'As marcações devem ser um array JSON.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_marks) > 20000 then
    raise exception 'Limite de 20.000 marcações por versão excedido.' using errcode = '22023';
  end if;

  select coalesce(m ->> 'id', '(sem id)') into v_bad
  from jsonb_array_elements(p_marks) m
  where jsonb_typeof(m) <> 'object'
     or coalesce(m ->> 'id', '') = ''
     or coalesce(m ->> 'type', '') not in ('point', 'box', 'polygon')
     or not exists (select 1 from public.labels l
                    where l.project_id = p_project_id and l.key = m ->> 'label')
  limit 1;
  if found then
    raise exception 'Marcação inválida (id %): tipo ou label desconhecido.', v_bad using errcode = '22023';
  end if;

  select count(*) filter (where l.index_role = 'positivo'),
         count(*) filter (where l.index_role = 'negativo')
    into reagents, non_reagents
  from jsonb_array_elements(p_marks) m
  join public.labels l on l.project_id = p_project_id and l.key = m ->> 'label';
end $$;

create function private.forbid(p_message text) returns void
language plpgsql as $$
begin
  raise exception '%', p_message using errcode = '42501';
end $$;


-- -----------------------------------------------------------------------------
-- 5. Auditoria: gravação com hash encadeado e verificação
-- -----------------------------------------------------------------------------

-- Texto canônico de um registro, usado no hash e na verificação.
create function private.audit_payload(l public.audit_logs) returns text
language sql stable as $$
  select concat_ws('|',
    l.id::text,
    to_char(l.occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    coalesce(l.user_id::text, ''), coalesce(l.user_name, ''),
    l.action, l.category::text,
    coalesce(l.entity, ''), coalesce(l.entity_id::text, ''),
    coalesce(l.project_id::text, ''), coalesce(l.batch_id::text, ''), coalesce(l.image_id::text, ''),
    l.details::text, coalesce(l.ip_address, ''), coalesce(l.device, ''),
    l.prev_hash)
$$;

-- BEFORE INSERT: serializa as gravações, numera e encadeia o hash.
-- Qualquer valor de id, data ou hash enviado por quem insere é descartado.
create function private.audit_logs_chain() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_prev text;
begin
  perform pg_advisory_xact_lock(hashtextextended('public.audit_logs.chain', 0));
  new.id          := nextval('public.audit_logs_id_seq');
  new.occurred_at := clock_timestamp();
  new.details     := coalesce(new.details, '{}'::jsonb);
  select l.hash into v_prev from public.audit_logs l order by l.id desc limit 1;
  new.prev_hash   := coalesce(v_prev, repeat('0', 64));
  new.hash        := private.sha256_hex(private.audit_payload(new));
  return new;
end $$;

create function private.write_audit(
  p_action     text,
  p_category   public.audit_category,
  p_entity     text    default null,
  p_entity_id  uuid    default null,
  p_project_id uuid    default null,
  p_batch_id   uuid    default null,
  p_image_id   uuid    default null,
  p_details    jsonb   default '{}'::jsonb,
  p_device     text    default null,
  p_user_id    uuid    default null
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_user    uuid := coalesce(p_user_id, auth.uid());
  v_name    text;
  v_batch   uuid := p_batch_id;
  v_project uuid := p_project_id;
  v_id      bigint;
begin
  if v_user is not null then
    select p.name into v_name from public.profiles p where p.id = v_user;
    if not found then v_user := null; end if;
  end if;
  if p_image_id is not null and (v_batch is null or v_project is null) then
    select coalesce(v_batch, i.batch_id), coalesce(v_project, i.project_id)
      into v_batch, v_project from public.images i where i.id = p_image_id;
  end if;
  if v_batch is not null and v_project is null then
    select b.project_id into v_project from public.batches b where b.id = v_batch;
  end if;

  insert into public.audit_logs
    (user_id, user_name, action, category, entity, entity_id, project_id, batch_id, image_id,
     details, ip_address, device, prev_hash, hash)
  values
    (v_user, coalesce(v_name, 'Sistema'), p_action, p_category, p_entity, p_entity_id, v_project, v_batch, p_image_id,
     coalesce(p_details, '{}'::jsonb), private.request_ip(), private.device_label(p_device), '', '')
  returning id into v_id;
  return v_id;
end $$;


-- -----------------------------------------------------------------------------
-- 6. Triggers de integridade
-- -----------------------------------------------------------------------------

create function private.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- WORM / sem exclusão. TG_ARGV[0] = mensagem.
create function private.reject_mutation() returns trigger
language plpgsql as $$
begin
  raise exception '% (operação % em %)', coalesce(tg_argv[0], 'Operação não permitida'), tg_op, tg_table_name
    using errcode = '42501';
end $$;

-- 6.1 Perfis -------------------------------------------------------------------

-- Cria o perfil quando o Supabase Auth cria o usuário. Papéis e autor vêm do
-- app_metadata, que só o service_role (Edge Function do admin) consegue definir.
create function private.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_roles   public.app_role[] := '{}';
  v_creator uuid;
begin
  begin
    select coalesce(array_agg(distinct r::public.app_role), '{}') into v_roles
    from jsonb_array_elements_text(coalesce(new.raw_app_meta_data -> 'roles', '[]'::jsonb)) r;
  exception when others then
    v_roles := '{}';
  end;
  begin
    v_creator := nullif(new.raw_app_meta_data ->> 'created_by', '')::uuid;
    if not exists (select 1 from public.profiles p where p.id = v_creator) then v_creator := null; end if;
  exception when others then
    v_creator := null;
  end;

  insert into public.profiles (id, name, email, roles, institution, created_by)
  values (new.id,
          coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), lower(new.email)),
          lower(new.email),
          v_roles,
          nullif(btrim(new.raw_user_meta_data ->> 'institution'), ''),
          v_creator);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

create function private.handle_auth_email_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = lower(new.email) where id = new.id;
  return new;
end $$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function private.handle_auth_email_change();

-- Excluir pelo painel (Authentication > Users > Delete) também é bloqueado.
create trigger prevent_auth_user_delete
  before delete on auth.users
  for each row execute function private.reject_mutation('Usuários não são excluídos: desative o perfil (RF-06)');

create function private.guard_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.id <> old.id or new.created_at <> old.created_at or new.created_by is distinct from old.created_by then
    perform private.forbid('Campos de identificação do perfil são imutáveis.');
  end if;

  if (new.roles is distinct from old.roles
      or new.is_active is distinct from old.is_active
      or new.email is distinct from old.email)
     and not (private.is_admin() or private.is_backend()) then
    perform private.forbid('Somente o administrador altera papéis, e-mail ou status de usuários.');
  end if;

  -- Evita que o admin se tranque fora do sistema.
  if not private.is_backend() and new.id = auth.uid() and 'admin' = any (old.roles)
     and (not new.is_active or not ('admin' = any (new.roles))) then
    perform private.forbid('Você não pode desativar a própria conta nem remover o próprio papel de administrador.');
  end if;

  if new.is_active is distinct from old.is_active then
    if new.is_active then
      new.deactivated_at := null;
      new.deactivated_by := null;
    else
      new.deactivated_at := now();
      new.deactivated_by := auth.uid();
    end if;
  end if;
  return new;
end $$;

-- Papéis sem repetição e em ordem fixa, para comparar antes/depois no log.
create function private.normalize_profile() returns trigger
language plpgsql as $$
begin
  new.roles := array(select distinct r from unnest(new.roles) r order by r);
  new.email := lower(new.email);
  return new;
end $$;

create trigger profiles_a_normalize before insert or update on public.profiles for each row execute function private.normalize_profile();
create trigger profiles_guard      before update on public.profiles for each row execute function private.guard_profile();
create trigger profiles_updated_at before update on public.profiles for each row execute function private.set_updated_at();
create trigger profiles_no_delete  before delete on public.profiles for each row
  execute function private.reject_mutation('Usuários não são excluídos: desative o perfil (RF-06)');

create function private.audit_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.write_audit('USUARIO_CRIADO', 'user_management', 'profile', new.id,
      p_details => jsonb_build_object('email', new.email, 'roles', to_jsonb(new.roles)),
      p_user_id => coalesce(auth.uid(), new.created_by));
    return new;
  end if;

  if new.roles is distinct from old.roles then
    perform private.write_audit('PAPEIS_ALTERADOS', 'user_management', 'profile', new.id,
      p_details => jsonb_build_object('alvo', new.email, 'antes', to_jsonb(old.roles), 'depois', to_jsonb(new.roles)));
  end if;
  if new.is_active is distinct from old.is_active then
    perform private.write_audit(case when new.is_active then 'USUARIO_REATIVADO' else 'USUARIO_DESATIVADO' end,
      'user_management', 'profile', new.id, p_details => jsonb_build_object('alvo', new.email));
  end if;
  if new.name is distinct from old.name or new.institution is distinct from old.institution
     or new.email is distinct from old.email or new.avatar_url is distinct from old.avatar_url then
    perform private.write_audit('USUARIO_ATUALIZADO', 'user_management', 'profile', new.id,
      p_details => jsonb_build_object('alvo', new.email));
  end if;
  return new;
end $$;

create trigger profiles_audit after insert or update on public.profiles
  for each row execute function private.audit_profile();

-- 6.2 Projetos -----------------------------------------------------------------

create function private.guard_project() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.code       := upper(new.code);
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.created_at := now();
  elsif new.code <> old.code or new.created_by is distinct from old.created_by or new.created_at <> old.created_at then
    perform private.forbid('Código, autor e data de criação do projeto são imutáveis.');
  end if;

  if tg_op = 'INSERT' or new.manager_id <> old.manager_id then
    if not exists (select 1 from public.profiles p
                   where p.id = new.manager_id and p.is_active and 'gestor' = any (p.roles)) then
      raise exception 'O gestor designado precisa estar ativo e ter o papel Gestor.' using errcode = '23514';
    end if;
    if tg_op = 'UPDATE' and exists (select 1 from public.analyses a join public.images i on i.id = a.image_id
                                    where i.project_id = new.id and a.evaluator_id = new.manager_id) then
      raise exception 'RN-07: este usuário já é avaliador no projeto e não pode ser o gestor dele.' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

create trigger projects_guard      before insert or update on public.projects for each row execute function private.guard_project();
create trigger projects_updated_at before update on public.projects for each row execute function private.set_updated_at();
create trigger projects_no_delete  before delete on public.projects for each row
  execute function private.reject_mutation('Projetos não são excluídos: mude o status para concluído');

-- Labels padrão do MVP (RF-12): reagente (DAB, marrom) e não reagente (hematoxilina, azul).
create function private.seed_project_labels() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.labels (project_id, key, name, color, symbol, index_role, sort_order) values
    (new.id, 'reagente',     'Reagente (DAB)',              '#8e4d2d', 'circulo', 'positivo', 1),
    (new.id, 'nao_reagente', 'Não reagente (Hematoxilina)', '#0284c7', 'anel',    'negativo', 2);
  return new;
end $$;

create trigger projects_seed_labels after insert on public.projects
  for each row execute function private.seed_project_labels();

create function private.audit_project() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.write_audit('PROJETO_CRIADO', 'batch', 'project', new.id, p_project_id => new.id,
      p_details => jsonb_build_object('code', new.code, 'name', new.name, 'manager_id', new.manager_id));
  else
    perform private.write_audit(
      case when new.manager_id <> old.manager_id then 'GESTOR_DESIGNADO' else 'PROJETO_ATUALIZADO' end,
      'batch', 'project', new.id, p_project_id => new.id,
      p_details => jsonb_build_object('status', new.status, 'manager_id', new.manager_id,
                                      'gestor_anterior', old.manager_id));
  end if;
  return new;
end $$;

create trigger projects_audit after insert or update on public.projects
  for each row execute function private.audit_project();

-- 6.3 Labels -------------------------------------------------------------------

create function private.guard_label() returns trigger
language plpgsql as $$
begin
  if new.project_id <> old.project_id or new.key <> old.key or new.index_role <> old.index_role then
    perform private.forbid('Projeto, chave e papel no índice de uma label são imutáveis (desative e crie outra).');
  end if;
  return new;
end $$;

create trigger labels_guard     before update on public.labels for each row execute function private.guard_label();
create trigger labels_no_delete before delete on public.labels for each row
  execute function private.reject_mutation('Labels não são excluídas: desative a label');

-- 6.4 Lotes --------------------------------------------------------------------

create function private.guard_batch() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_max integer;
begin
  if tg_op = 'INSERT' then
    new.code       := upper(new.code);
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.created_at := now();
    if not exists (select 1 from public.projects p where p.id = new.project_id and p.status = 'ativo') then
      raise exception 'Só é possível criar lotes em projetos ativos.' using errcode = '23514';
    end if;
    return new;
  end if;

  if new.project_id <> old.project_id or new.code <> old.code
     or new.created_by is distinct from old.created_by or new.created_at <> old.created_at then
    perform private.forbid('Projeto, código, autor e data do lote são imutáveis.');
  end if;
  if new.evaluators_per_image < old.evaluators_per_image then
    select coalesce(max(c), 0) into v_max
    from (select count(*) c from public.analyses a join public.images i on i.id = a.image_id
          where i.batch_id = new.id group by a.image_id) s;
    if new.evaluators_per_image < v_max then
      raise exception 'RF-29: já existem imagens com % avaliadores neste lote; N não pode ficar menor que isso.', v_max
        using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

create trigger batches_guard      before insert or update on public.batches for each row execute function private.guard_batch();
create trigger batches_updated_at before update on public.batches for each row execute function private.set_updated_at();
create trigger batches_no_delete  before delete on public.batches for each row
  execute function private.reject_mutation('Lotes não são excluídos');

create function private.audit_batch() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.write_audit(case when tg_op = 'INSERT' then 'LOTE_CRIADO' else 'LOTE_ATUALIZADO' end,
    'batch', 'batch', new.id, p_project_id => new.project_id, p_batch_id => new.id,
    p_details => jsonb_build_object('code', new.code, 'name', new.name, 'n', new.evaluators_per_image));
  return new;
end $$;

create trigger batches_audit after insert or update on public.batches
  for each row execute function private.audit_batch();

-- 6.5 Imagens e arquivos -------------------------------------------------------

create function private.guard_image() returns trigger
language plpgsql as $$
begin
  if new.batch_id <> old.batch_id or new.project_id <> old.project_id or new.code <> old.code
     or new.sequence_number <> old.sequence_number or new.uploaded_by <> old.uploaded_by
     or new.created_at <> old.created_at then
    perform private.forbid('Lote, projeto, código e autor da imagem são imutáveis.');
  end if;
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end $$;

create trigger images_guard     before update on public.images for each row execute function private.guard_image();
create trigger images_no_delete before delete on public.images for each row
  execute function private.reject_mutation('Imagens não são excluídas (RF-11)');

-- O original é imutável (RF-11). Só a pré-anotação e a cópia reduzida podem ser
-- preenchidas, uma única vez, depois do upload.
create function private.guard_image_version() returns trigger
language plpgsql as $$
begin
  if new.image_id <> old.image_id or new.version_number <> old.version_number or new.sha256 <> old.sha256
     or new.storage_key <> old.storage_key or new.mime_type <> old.mime_type or new.size_bytes <> old.size_bytes
     or new.width_px <> old.width_px or new.height_px <> old.height_px
     or new.metadata_sanitized <> old.metadata_sanitized
     or new.uploaded_by <> old.uploaded_by or new.uploaded_at <> old.uploaded_at then
    perform private.forbid('O arquivo original e seus metadados são imutáveis (RF-11).');
  end if;
  if old.pre_annotation is not null and new.pre_annotation is distinct from old.pre_annotation then
    perform private.forbid('A pré-anotação já foi gerada e não pode mudar (D10).');
  end if;
  if old.preview_storage_key is not null and new.preview_storage_key is distinct from old.preview_storage_key then
    perform private.forbid('A cópia reduzida já foi registrada.');
  end if;
  return new;
end $$;

create trigger image_versions_guard     before update on public.image_versions for each row execute function private.guard_image_version();
create trigger image_versions_no_delete before delete on public.image_versions for each row
  execute function private.reject_mutation('Arquivos de imagem não são excluídos (RF-11)');

-- 6.6 Análises -----------------------------------------------------------------

-- Regras da atribuição: RN-07 (gestor não avalia), RF-29 (no máximo N por imagem),
-- avaliador ativo com o papel certo. Também define a letra cega.
create function private.guard_analysis_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_image  record;
  v_count  integer;
begin
  select i.id, i.status, i.project_id, b.evaluators_per_image as n, p.manager_id, p.status as project_status
    into v_image
  from public.images i
  join public.batches b  on b.id = i.batch_id
  join public.projects p on p.id = i.project_id
  where i.id = new.image_id
  for update of i;

  if not found then
    raise exception 'Imagem não encontrada.' using errcode = 'PT404';
  end if;
  if v_image.project_status <> 'ativo' then
    raise exception 'O projeto não está ativo.' using errcode = '23514';
  end if;
  if v_image.status in ('pronta_para_validacao', 'validada', 'concluida') then
    raise exception 'A imagem já concluiu a etapa de análise.' using errcode = '23514';
  end if;
  if new.evaluator_id = v_image.manager_id then
    raise exception 'RN-07: o gestor do projeto não pode ser avaliador nele (protocolo duplo-cego).' using errcode = '23514';
  end if;
  if not exists (select 1 from public.profiles pr
                 where pr.id = new.evaluator_id and pr.is_active and 'avaliador' = any (pr.roles)) then
    raise exception 'O usuário atribuído precisa estar ativo e ter o papel Avaliador.' using errcode = '23514';
  end if;

  select count(*) into v_count from public.analyses a where a.image_id = new.image_id;
  if v_count >= v_image.n then
    raise exception 'RF-29: a imagem já tem os % avaliadores definidos para o lote.', v_image.n using errcode = '23514';
  end if;

  new.blind_code      := chr(65 + v_count);  -- A, B, C... na ordem de atribuição
  new.status          := 'pendente';
  new.current_version := 0;
  new.assigned_by     := coalesce(auth.uid(), new.assigned_by);
  new.assigned_at     := now();
  new.started_at      := null;
  new.last_saved_at   := null;
  new.finalized_at    := null;
  return new;
end $$;

create function private.after_analysis_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.images set status = 'aguardando_analises'
  where id = new.image_id and status = 'nao_atribuida';
  return new;
end $$;

create function private.guard_analysis_update() returns trigger
language plpgsql as $$
begin
  if new.image_id <> old.image_id or new.evaluator_id <> old.evaluator_id or new.blind_code <> old.blind_code
     or new.assigned_by <> old.assigned_by or new.assigned_at <> old.assigned_at then
    perform private.forbid('Imagem, avaliador, letra cega e atribuição de uma análise são imutáveis (RN-02).');
  end if;
  if new.current_version < old.current_version then
    perform private.forbid('O número da versão atual nunca diminui (RF-33).');
  end if;
  if old.status = 'finalizada' and new.status <> 'finalizada'
     and coalesce(current_setting('ki67.allow_reopen', true), '') <> 'on' then
    perform private.forbid('Análise finalizada não pode ser reaberta (RN-04, fase 2).');
  end if;
  if old.status <> 'pendente' and new.status = 'pendente' then
    perform private.forbid('Uma análise iniciada não volta para pendente.');
  end if;
  return new;
end $$;

create trigger analyses_guard_insert before insert on public.analyses for each row execute function private.guard_analysis_insert();
create trigger analyses_after_insert after insert on public.analyses for each row execute function private.after_analysis_insert();
create trigger analyses_guard_update before update on public.analyses for each row execute function private.guard_analysis_update();
create trigger analyses_no_delete    before delete on public.analyses for each row
  execute function private.reject_mutation('Análises não são excluídas (RN-06)');

-- 6.7 Versões da análise e resultado de validação: WORM + hash do conteúdo ------

create function private.seal_analysis_version() returns trigger
language plpgsql as $$
begin
  new.created_at     := clock_timestamp();
  new.content_sha256 := private.sha256_hex(concat_ws('|',
    new.analysis_id, new.version_number, new.image_version_id, new.author_id, new.kind,
    new.marks::text, new.observation, new.reagents_count, new.non_reagents_count,
    coalesce(new.ki67_index::text, ''), coalesce(new.restored_from_version::text, ''), new.device,
    to_char(new.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')));
  return new;
end $$;

create trigger analysis_versions_seal before insert on public.analysis_versions
  for each row execute function private.seal_analysis_version();
create trigger analysis_versions_worm before update or delete on public.analysis_versions
  for each row execute function private.reject_mutation('Versões de análise são imutáveis (RF-33)');
create trigger analysis_versions_no_truncate before truncate on public.analysis_versions
  for each statement execute function private.reject_mutation('Versões de análise são imutáveis (RF-33)');

create function private.seal_consensus() returns trigger
language plpgsql as $$
begin
  new.frozen_at      := clock_timestamp();
  new.content_sha256 := private.sha256_hex(concat_ws('|',
    new.image_id, new.validator_id, new.kind, coalesce(new.adopted_analysis_id::text, ''),
    coalesce(new.adopted_version_id::text, ''), coalesce(new.consensus_marks::text, ''),
    coalesce(new.reagents_count::text, ''), coalesce(new.non_reagents_count::text, ''),
    new.consensus_ki67, coalesce(new.icc_score::text, ''), coalesce(new.divergence_delta_pp::text, ''),
    coalesce(new.spatial_agreement_pct::text, ''), new.agreement_metrics::text, new.justification,
    to_char(new.frozen_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')));
  return new;
end $$;

create trigger consensus_seal before insert on public.consensus_results
  for each row execute function private.seal_consensus();
create trigger consensus_worm before update or delete on public.consensus_results
  for each row execute function private.reject_mutation('O resultado validado é imutável (RF-32)');
create trigger consensus_no_truncate before truncate on public.consensus_results
  for each statement execute function private.reject_mutation('O resultado validado é imutável (RF-32)');

-- 6.8 Log de auditoria: WORM ---------------------------------------------------

create trigger audit_logs_chain before insert on public.audit_logs
  for each row execute function private.audit_logs_chain();
create trigger audit_logs_worm before update or delete on public.audit_logs
  for each row execute function private.reject_mutation('O log de auditoria é somente-inclusão (RF-38)');
create trigger audit_logs_no_truncate before truncate on public.audit_logs
  for each statement execute function private.reject_mutation('O log de auditoria é somente-inclusão (RF-38)');

-- Nenhuma tabela principal pode ser esvaziada com TRUNCATE.
create trigger profiles_no_truncate       before truncate on public.profiles       for each statement execute function private.reject_mutation('TRUNCATE bloqueado');
create trigger projects_no_truncate       before truncate on public.projects       for each statement execute function private.reject_mutation('TRUNCATE bloqueado');
create trigger labels_no_truncate         before truncate on public.labels         for each statement execute function private.reject_mutation('TRUNCATE bloqueado');
create trigger batches_no_truncate        before truncate on public.batches        for each statement execute function private.reject_mutation('TRUNCATE bloqueado');
create trigger images_no_truncate         before truncate on public.images         for each statement execute function private.reject_mutation('TRUNCATE bloqueado');
create trigger image_versions_no_truncate before truncate on public.image_versions for each statement execute function private.reject_mutation('TRUNCATE bloqueado');
create trigger analyses_no_truncate       before truncate on public.analyses       for each statement execute function private.reject_mutation('TRUNCATE bloqueado');


-- -----------------------------------------------------------------------------
-- 7. RPCs: sessão e 2FA (RF-01, RF-02, RF-05)
-- -----------------------------------------------------------------------------

-- Estado da sessão atual. Funciona antes do 2FA, para o app decidir a rota.
create function public.my_session() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_profile public.profiles;
begin
  if auth.uid() is null then
    return jsonb_build_object('authenticated', false);
  end if;
  select * into v_profile from public.profiles p where p.id = auth.uid();
  if not found then
    return jsonb_build_object('authenticated', true, 'has_profile', false);
  end if;
  return jsonb_build_object(
    'authenticated',       true,
    'has_profile',         true,
    'user_id',             v_profile.id,
    'name',                v_profile.name,
    'email',               v_profile.email,
    'roles',               to_jsonb(v_profile.roles),
    'is_active',           v_profile.is_active,
    'institution',         v_profile.institution,
    'avatar_url',          v_profile.avatar_url,
    'last_login_at',       v_profile.last_login_at,
    'two_factor_required', (select s.require_two_factor from private.app_settings s),
    'two_factor_verified', private.two_factor_ok());
end $$;

-- SOMENTE service_role (Edge Function "send-2fa-code"): gera o código de 6
-- dígitos, guarda só o hash e devolve o código para a função enviar por e-mail.
create function public.issue_two_factor_code(p_user_id uuid, p_session_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_settings private.app_settings;
  v_recent   integer;
  v_bytes    bytea;
  v_code     text;
  v_id       uuid := gen_random_uuid();
begin
  if not private.is_backend() then
    perform private.forbid('Somente o backend emite códigos 2FA.');
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id and p.is_active) then
    raise exception 'Usuário inexistente ou desativado.' using errcode = 'PT401';
  end if;
  select * into v_settings from private.app_settings;

  select count(*) into v_recent from private.two_factor_challenges c
  where c.user_id = p_user_id and c.created_at > now() - interval '15 minutes';
  if v_recent >= v_settings.two_factor_max_per_15m then
    raise exception 'Muitos códigos solicitados. Aguarde 15 minutos.' using errcode = 'PT429';
  end if;

  -- invalida códigos anteriores desta sessão
  update private.two_factor_challenges set expires_at = now()
  where session_id = p_session_id and verified_at is null and expires_at > now();

  v_bytes := extensions.gen_random_bytes(4);
  v_code  := lpad(((get_byte(v_bytes, 0)::bigint * 16777216 + get_byte(v_bytes, 1) * 65536
                    + get_byte(v_bytes, 2) * 256 + get_byte(v_bytes, 3)) % 1000000)::text, 6, '0');

  insert into private.two_factor_challenges (id, user_id, session_id, code_hash, expires_at)
  values (v_id, p_user_id, p_session_id, private.sha256_hex(v_id::text || ':' || v_code),
          now() + v_settings.two_factor_ttl);

  perform private.write_audit('LOGIN_SENHA_OK', 'auth', 'profile', p_user_id, p_user_id => p_user_id);
  return v_code;
end $$;

-- Confere o código digitado. Sucesso libera a sessão atual (claim session_id).
create function public.verify_two_factor_code(p_code text, p_device text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid       uuid := auth.uid();
  v_sid       uuid := private.session_id();
  v_settings  private.app_settings;
  v_challenge private.two_factor_challenges;
begin
  if v_uid is null or v_sid is null then
    perform private.forbid('Sessão obrigatória.');
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid and p.is_active) then
    return jsonb_build_object('ok', false, 'error', 'INACTIVE');
  end if;
  select * into v_settings from private.app_settings;

  select * into v_challenge from private.two_factor_challenges c
  where c.user_id = v_uid and c.session_id = v_sid and c.verified_at is null
  order by c.created_at desc limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'NO_CHALLENGE');
  end if;
  if v_challenge.expires_at <= now() or v_challenge.attempts >= v_settings.two_factor_max_attempts then
    perform private.write_audit('2FA_FALHA', 'auth', 'profile', v_uid,
      p_details => jsonb_build_object('motivo', 'expirado_ou_tentativas'), p_device => p_device);
    return jsonb_build_object('ok', false, 'error',
      case when v_challenge.expires_at <= now() then 'EXPIRED' else 'TOO_MANY_ATTEMPTS' end);
  end if;

  update private.two_factor_challenges set attempts = attempts + 1 where id = v_challenge.id;

  if v_challenge.code_hash = private.sha256_hex(v_challenge.id::text || ':' || btrim(coalesce(p_code, ''))) then
    update private.two_factor_challenges set verified_at = now() where id = v_challenge.id;
    update public.profiles set last_login_at = now() where id = v_uid;
    perform private.write_audit('LOGIN_OK', 'auth', 'profile', v_uid, p_device => p_device);
    return jsonb_build_object('ok', true);
  end if;

  perform private.write_audit('2FA_FALHA', 'auth', 'profile', v_uid,
    p_details => jsonb_build_object('motivo', 'codigo_incorreto'), p_device => p_device);
  return jsonb_build_object('ok', false, 'error', 'INVALID_CODE',
    'attempts_left', greatest(v_settings.two_factor_max_attempts - v_challenge.attempts - 1, 0));
end $$;

-- Só para desenvolvimento com require_two_factor = false: registra o login.
create function public.register_login(p_device text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if (select s.require_two_factor from private.app_settings s) then
    perform private.forbid('Com 2FA ligado, o login é registrado por verify_two_factor_code.');
  end if;
  if not private.is_active_user() then
    perform private.forbid('Usuário desativado.');
  end if;
  update public.profiles set last_login_at = now() where id = auth.uid();
  perform private.write_audit('LOGIN_OK', 'auth', 'profile', auth.uid(), p_device => p_device);
  return jsonb_build_object('ok', true);
end $$;

-- SOMENTE service_role (Edge Function de login): registra LOGIN_FALHA.
create function public.log_auth_failure(p_email text, p_reason text default 'credenciais_invalidas',
                                        p_device text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid;
begin
  if not private.is_backend() then
    perform private.forbid('Somente o backend registra falhas de login.');
  end if;
  select p.id into v_uid from public.profiles p where p.email = lower(btrim(p_email));
  perform private.write_audit('LOGIN_FALHA', 'auth', 'profile', v_uid,
    p_details => jsonb_build_object('email', lower(btrim(p_email)), 'motivo', p_reason),
    p_device => p_device, p_user_id => v_uid);
end $$;


-- -----------------------------------------------------------------------------
-- 8. RPCs: log de eventos do app (RF-37)
-- -----------------------------------------------------------------------------

-- Ações que o próprio app pode registrar. As ações críticas (salvar, finalizar,
-- atribuir, validar, upload...) são registradas automaticamente pelas RPCs.
create function public.log_event(
  p_action     text,
  p_category   public.audit_category default 'security',
  p_details    jsonb default '{}'::jsonb,
  p_image_id   uuid  default null,
  p_batch_id   uuid  default null,
  p_project_id uuid  default null,
  p_device     text  default null
) returns bigint
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    perform private.forbid('Sessão obrigatória.');
  end if;
  if p_action not in ('LOGOUT', 'SESSAO_EXPIRADA', 'EXPORTACAO', 'UPLOAD_RECUSADO', 'IMAGEM_VISUALIZADA',
                      'PRE_MARCACAO_EXECUTADA', 'RASCUNHO_SINCRONIZADO', 'HISTORICO_ABERTO',
                      'VERSAO_VISUALIZADA', 'PERFIL_TROCADO', 'AUDITORIA_CONSULTADA') then
    raise exception 'A ação % não pode ser registrada pelo app.', p_action using errcode = '22023';
  end if;
  if p_action not in ('LOGOUT', 'SESSAO_EXPIRADA') and not private.is_active_user() then
    perform private.forbid('Sessão sem 2FA ou usuário desativado.');
  end if;
  if p_action = 'EXPORTACAO' and not private.manages_project(coalesce(
       p_project_id,
       (select b.project_id from public.batches b where b.id = p_batch_id))) then
    perform private.forbid('Somente o gestor do projeto exporta dados (RF-40).');
  end if;
  if (p_image_id is not null and not private.can_see_image(p_image_id))
     or (p_batch_id is not null and not private.can_see_project((select b.project_id from public.batches b where b.id = p_batch_id)))
     or (p_project_id is not null and not private.can_see_project(p_project_id)) then
    perform private.forbid('Referência a um recurso que você não acessa.');
  end if;

  return private.write_audit(p_action, p_category, null, null, p_project_id, p_batch_id, p_image_id,
                             coalesce(p_details, '{}'::jsonb), p_device);
end $$;

-- Recalcula a cadeia de hashes do log. Admin ou backend.
create function public.verify_audit_chain() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  r       public.audit_logs;
  v_prev  text := repeat('0', 64);
  v_count bigint := 0;
begin
  if not (private.is_admin() or private.is_backend()) then
    perform private.forbid('Somente o administrador verifica a cadeia do log.');
  end if;
  for r in select * from public.audit_logs order by id loop
    v_count := v_count + 1;
    if r.prev_hash <> v_prev or r.hash <> private.sha256_hex(private.audit_payload(r)) then
      return jsonb_build_object('ok', false, 'checked', v_count, 'first_broken_id', r.id);
    end if;
    v_prev := r.hash;
  end loop;
  return jsonb_build_object('ok', true, 'checked', v_count, 'first_broken_id', null);
end $$;


-- -----------------------------------------------------------------------------
-- 9. RPCs: administrador (RF-06, RF-07)
-- -----------------------------------------------------------------------------

-- Editar nome, papéis e status. Criar usuários exige a Edge Function
-- "admin-create-user" (auth.admin.inviteUserByEmail com o service_role):
-- o admin nunca vê nem escolhe a senha (RF-06).
create function public.admin_update_user(
  p_user_id     uuid,
  p_name        text               default null,
  p_institution text               default null,
  p_roles       public.app_role[]  default null,
  p_is_active   boolean            default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    perform private.forbid('Somente o administrador edita usuários (RF-04).');
  end if;
  update public.profiles set
    name        = coalesce(nullif(btrim(p_name), ''), name),
    institution = case when p_institution is null then institution else nullif(btrim(p_institution), '') end,
    roles       = coalesce(p_roles, roles),
    is_active   = coalesce(p_is_active, is_active)
  where id = p_user_id;
  if not found then
    raise exception 'Usuário não encontrado.' using errcode = 'PT404';
  end if;
  return jsonb_build_object('ok', true);
end $$;


-- -----------------------------------------------------------------------------
-- 10. RPCs: gestor — upload, pré-anotação e atribuição (RF-08, RF-10, RF-11, RF-17)
-- -----------------------------------------------------------------------------

-- Registra um arquivo já enviado ao R2 pela URL pré-assinada.
-- Convenção da chave: projects/<project_id>/batches/<batch_id>/<sha256>.<ext>
-- Devolve status 'uploaded' | 'duplicate' | 'rejected' para o resumo do RF-08.
create function public.register_image(
  p_batch_id              uuid,
  p_sha256                text,
  p_storage_key           text,
  p_mime_type             text,
  p_size_bytes            bigint,
  p_width_px              integer,
  p_height_px             integer,
  p_metadata_sanitized    boolean default false,
  p_organ                 text    default null,
  p_optical_magnification text    default null,
  p_preview_storage_key   text    default null,
  p_device                text    default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_batch    record;
  v_sha      text := lower(btrim(coalesce(p_sha256, '')));
  v_reason   text;
  v_existing record;
  v_seq      integer;
  v_code     text;
  v_image_id uuid;
  v_ver_id   uuid;
begin
  if auth.uid() is null then
    perform private.forbid('Sessão obrigatória.');
  end if;

  select b.id, b.code, b.project_id, p.status as project_status into v_batch
  from public.batches b join public.projects p on p.id = b.project_id
  where b.id = p_batch_id
  for update of b;  -- serializa a numeração das imagens do lote

  if not found or not private.manages_project(v_batch.project_id) then
    perform private.write_audit('ACESSO_NEGADO', 'security', 'batch', p_batch_id,
      p_details => jsonb_build_object('rpc', 'register_image'), p_device => p_device);
    return jsonb_build_object('ok', false, 'status', 'rejected', 'reason', 'NOT_FOUND');
  end if;

  v_reason := case
    when v_batch.project_status <> 'ativo'                               then 'O projeto não está ativo.'
    when v_sha !~ '^[0-9a-f]{64}$'                                       then 'Hash SHA-256 inválido.'
    when p_mime_type not in ('image/jpeg', 'image/png', 'image/tiff')    then 'Formato não aceito (use JPG, PNG ou TIFF).'
    when coalesce(p_size_bytes, 0) <= 0                                  then 'Arquivo vazio.'
    when p_size_bytes > (select s.max_upload_bytes from private.app_settings s) then 'Arquivo acima de 50 MB.'
    when coalesce(p_width_px, 0) <= 0 or coalesce(p_height_px, 0) <= 0  then 'Dimensões da imagem inválidas.'
    when p_storage_key is null
      or p_storage_key not like 'projects/' || v_batch.project_id || '/batches/' || v_batch.id || '/%'
                                                                         then 'Chave de armazenamento fora do padrão do lote.'
  end;
  if v_reason is not null then
    perform private.write_audit('UPLOAD_RECUSADO', 'batch', 'batch', v_batch.id, p_batch_id => v_batch.id,
      p_details => jsonb_build_object('motivo', v_reason), p_device => p_device);
    return jsonb_build_object('ok', false, 'status', 'rejected', 'reason', v_reason);
  end if;

  select i.code, i.project_id into v_existing
  from public.image_versions v join public.images i on i.id = v.image_id
  where v.sha256 = v_sha;
  if found then
    perform private.write_audit('UPLOAD_DUPLICADO', 'batch', 'batch', v_batch.id, p_batch_id => v_batch.id,
      p_details => jsonb_build_object('sha256', v_sha), p_device => p_device);
    return jsonb_build_object('ok', false, 'status', 'duplicate',
      -- só revela o código se a imagem existente for do mesmo projeto
      'existing_code', case when v_existing.project_id = v_batch.project_id then v_existing.code end);
  end if;

  select coalesce(max(i.sequence_number), 0) + 1 into v_seq from public.images i where i.batch_id = v_batch.id;
  v_code := v_batch.code || '-' || lpad(v_seq::text, 4, '0');

  insert into public.images (batch_id, project_id, code, sequence_number, organ, optical_magnification, uploaded_by)
  values (v_batch.id, v_batch.project_id, v_code, v_seq,
          nullif(btrim(p_organ), ''), nullif(btrim(p_optical_magnification), ''), auth.uid())
  returning id into v_image_id;

  insert into public.image_versions (image_id, version_number, sha256, storage_key, preview_storage_key, mime_type,
                                     size_bytes, width_px, height_px, metadata_sanitized, uploaded_by)
  values (v_image_id, 1, v_sha, p_storage_key, p_preview_storage_key, p_mime_type,
          p_size_bytes, p_width_px, p_height_px, coalesce(p_metadata_sanitized, false), auth.uid())
  returning id into v_ver_id;

  perform private.write_audit('UPLOAD', 'batch', 'image', v_image_id, p_image_id => v_image_id,
    p_details => jsonb_build_object('code', v_code, 'sha256', v_sha, 'size_bytes', p_size_bytes,
                                    'mime_type', p_mime_type, 'metadata_sanitized', coalesce(p_metadata_sanitized, false)),
    p_device => p_device);

  return jsonb_build_object('ok', true, 'status', 'uploaded', 'image_id', v_image_id,
                            'image_version_id', v_ver_id, 'code', v_code);
end $$;

-- Guarda a pré-anotação de um arquivo (uma única vez, D10). Gestor do projeto ou backend.
create function public.set_pre_annotation(p_image_version_id uuid, p_marks jsonb, p_device text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_ver record;
  v_cnt record;
begin
  select v.id, v.image_id, v.pre_annotation, i.project_id into v_ver
  from public.image_versions v join public.images i on i.id = v.image_id
  where v.id = p_image_version_id
  for update of v;

  if not found or not (private.is_backend() or private.manages_project(v_ver.project_id)) then
    perform private.write_audit('ACESSO_NEGADO', 'security', 'image_version', p_image_version_id,
      p_details => jsonb_build_object('rpc', 'set_pre_annotation'), p_device => p_device);
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_ver.pre_annotation is not null then
    raise exception 'A pré-anotação desta imagem já foi gerada.' using errcode = 'PT409';
  end if;

  select * into v_cnt from private.count_marks(v_ver.project_id, p_marks);
  update public.image_versions set pre_annotation = p_marks, pre_annotation_at = now() where id = v_ver.id;

  perform private.write_audit('PRE_ANOTACAO_GERADA', 'annotation', 'image_version', v_ver.id,
    p_image_id => v_ver.image_id,
    p_details => jsonb_build_object('marcacoes', jsonb_array_length(p_marks)), p_device => p_device);
  return jsonb_build_object('ok', true, 'marks', jsonb_array_length(p_marks));
end $$;

-- Atribui imagens a avaliadores. Idempotente: repetir não duplica (RF-10).
-- Tudo ou nada: se uma imagem passar de N (RF-29) ou violar RN-07, nada é gravado.
create function public.assign_evaluators(p_image_ids uuid[], p_evaluator_ids uuid[], p_device text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_images  uuid[] := array(select distinct x from unnest(p_image_ids) x where x is not null);
  v_evals   uuid[] := array(select distinct x from unnest(p_evaluator_ids) x where x is not null);
  v_created integer;
  v_image   uuid;
begin
  if auth.uid() is null then
    perform private.forbid('Sessão obrigatória.');
  end if;
  if cardinality(v_images) = 0 or cardinality(v_evals) = 0 then
    raise exception 'Informe ao menos uma imagem e um avaliador.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_images) x left join public.images i on i.id = x
             where i.id is null or not private.manages_project(i.project_id)) then
    perform private.write_audit('ACESSO_NEGADO', 'security', 'image', null,
      p_details => jsonb_build_object('rpc', 'assign_evaluators'), p_device => p_device);
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if auth.uid() = any (v_evals) then
    raise exception 'RN-07: gestores não podem se autoatribuir análises (protocolo duplo-cego).' using errcode = '23514';
  end if;

  insert into public.analyses (image_id, evaluator_id, assigned_by)
  select i, e, auth.uid()
  from unnest(v_images) i cross join unnest(v_evals) e
  where not exists (select 1 from public.analyses a where a.image_id = i and a.evaluator_id = e)
  order by i, e;
  get diagnostics v_created = row_count;

  foreach v_image in array v_images loop
    perform private.write_audit('ATRIBUICAO', 'batch', 'image', v_image, p_image_id => v_image,
      p_details => jsonb_build_object('avaliadores', to_jsonb(v_evals)), p_device => p_device);
  end loop;

  return jsonb_build_object('ok', true, 'created', v_created,
                            'skipped', cardinality(v_images) * cardinality(v_evals) - v_created);
end $$;

create function public.assign_evaluators_to_batch(p_batch_id uuid, p_evaluator_ids uuid[], p_device text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_project uuid;
  v_images  uuid[];
begin
  select b.project_id into v_project from public.batches b where b.id = p_batch_id;
  if v_project is null or not private.manages_project(v_project) then
    perform private.write_audit('ACESSO_NEGADO', 'security', 'batch', p_batch_id,
      p_details => jsonb_build_object('rpc', 'assign_evaluators_to_batch'), p_device => p_device);
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  v_images := array(select i.id from public.images i
                    where i.batch_id = p_batch_id and i.status in ('nao_atribuida', 'aguardando_analises')
                    order by i.sequence_number);
  if cardinality(v_images) = 0 then
    return jsonb_build_object('ok', true, 'created', 0, 'skipped', 0);
  end if;
  return public.assign_evaluators(v_images, p_evaluator_ids, p_device);
end $$;


-- -----------------------------------------------------------------------------
-- 11. RPCs: avaliador — abrir, salvar, finalizar, restaurar (RF-18, RF-21, RF-28, RF-33, RF-34)
-- -----------------------------------------------------------------------------

-- Abre a análise do próprio usuário. Análise de outra pessoa = NOT_FOUND + ACESSO_NEGADO (RF-28).
create function public.open_analysis(p_analysis_id uuid, p_device text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_a      record;
  v_latest record;
begin
  if auth.uid() is null then
    perform private.forbid('Sessão obrigatória.');
  end if;

  select a.id, a.status, a.blind_code, a.current_version, a.assigned_at, a.started_at, a.last_saved_at,
         a.finalized_at, i.id as image_id, i.code as image_code, i.organ, i.optical_magnification,
         i.project_id, b.name as batch_name, b.code as batch_code, p.name as project_name, p.status as project_status,
         v.id as image_version_id, v.width_px, v.height_px, v.mime_type, v.pre_annotation
    into v_a
  from public.analyses a
  join public.images i   on i.id = a.image_id
  join public.batches b  on b.id = i.batch_id
  join public.projects p on p.id = i.project_id
  left join public.image_versions v on v.id = private.latest_image_version(i.id)
  where a.id = p_analysis_id and a.evaluator_id = auth.uid() and private.has_role('avaliador');

  if not found then
    perform private.write_audit('ACESSO_NEGADO', 'security', 'analysis', p_analysis_id,
      p_details => jsonb_build_object('rpc', 'open_analysis'), p_device => p_device);
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;

  select av.version_number, av.kind, av.marks, av.observation, av.reagents_count, av.non_reagents_count,
         av.ki67_index, av.created_at, av.content_sha256
    into v_latest
  from public.analysis_versions av
  where av.analysis_id = v_a.id and av.version_number = v_a.current_version;

  perform private.write_audit('ANALISE_ABERTA', 'annotation', 'analysis', v_a.id,
    p_image_id => v_a.image_id, p_device => p_device);

  return jsonb_build_object(
    'ok', true,
    'analysis', jsonb_build_object(
      'id', v_a.id, 'status', v_a.status, 'blind_code', v_a.blind_code,
      'current_version', v_a.current_version, 'assigned_at', v_a.assigned_at,
      'started_at', v_a.started_at, 'last_saved_at', v_a.last_saved_at, 'finalized_at', v_a.finalized_at,
      'read_only', v_a.status = 'finalizada' or v_a.project_status <> 'ativo'),
    'image', jsonb_build_object(
      'id', v_a.image_id, 'code', v_a.image_code, 'organ', v_a.organ,
      'optical_magnification', v_a.optical_magnification,
      'batch_name', v_a.batch_name, 'batch_code', v_a.batch_code, 'project_name', v_a.project_name,
      'image_version_id', v_a.image_version_id, 'width', v_a.width_px, 'height', v_a.height_px,
      'mime_type', v_a.mime_type),
    'labels', (select coalesce(jsonb_agg(jsonb_build_object('key', l.key, 'name', l.name, 'color', l.color,
                                                            'symbol', l.symbol, 'index_role', l.index_role)
                                         order by l.sort_order), '[]'::jsonb)
               from public.labels l where l.project_id = v_a.project_id and l.is_active),
    'latest_version', case when v_latest.version_number is null then null else jsonb_build_object(
      'version_number', v_latest.version_number, 'kind', v_latest.kind, 'marks', v_latest.marks,
      'observation', v_latest.observation, 'reagents', v_latest.reagents_count,
      'non_reagents', v_latest.non_reagents_count, 'ki67_index', v_latest.ki67_index,
      'created_at', v_latest.created_at, 'content_sha256', v_latest.content_sha256) end,
    -- RF-18: a mesma pré-anotação para todos, só enquanto não existe versão própria
    'pre_annotation', case when v_a.current_version = 0 then coalesce(v_a.pre_annotation, '[]'::jsonb) end);
end $$;

-- Núcleo comum de salvar / finalizar / restaurar.
create function private.append_analysis_version(
  p_analysis_id  uuid,
  p_base_version integer,
  p_kind         public.version_kind,
  p_marks        jsonb,
  p_observation  text,
  p_device       text,
  p_restored_from integer default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_a       record;
  v_cnt     record;
  v_ki67    numeric;
  v_number  integer;
  v_now     timestamptz := now();
begin
  if auth.uid() is null then
    perform private.forbid('Sessão obrigatória.');
  end if;

  select a.id, a.image_id, a.status, a.current_version, i.project_id, p.status as project_status,
         private.latest_image_version(i.id) as image_version_id
    into v_a
  from public.analyses a
  join public.images i   on i.id = a.image_id
  join public.projects p on p.id = i.project_id
  where a.id = p_analysis_id and a.evaluator_id = auth.uid() and private.has_role('avaliador')
  for update of a;

  if not found then
    perform private.write_audit('ACESSO_NEGADO', 'security', 'analysis', p_analysis_id,
      p_details => jsonb_build_object('rpc', 'save', 'kind', p_kind), p_device => p_device);
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_a.status = 'finalizada' then
    raise exception 'Análise finalizada não aceita novas versões (RF-21).' using errcode = 'PT409';
  end if;
  if v_a.project_status <> 'ativo' then
    raise exception 'O projeto não está ativo.' using errcode = 'PT409';
  end if;
  if p_base_version is distinct from v_a.current_version then
    -- Outro aparelho salvou antes (02-arquitetura.md §6.4): o app decide qual seguir.
    return jsonb_build_object('ok', false, 'error', 'VERSION_CONFLICT', 'current_version', v_a.current_version);
  end if;
  if char_length(coalesce(p_observation, '')) > 2000 then
    raise exception 'A observação tem limite de 2.000 caracteres (RF-20).' using errcode = '22023';
  end if;

  select * into v_cnt from private.count_marks(v_a.project_id, p_marks);
  v_ki67   := private.ki67_index(v_cnt.reagents, v_cnt.non_reagents);
  v_number := v_a.current_version + 1;

  insert into public.analysis_versions
    (analysis_id, version_number, image_version_id, author_id, kind, marks, observation,
     reagents_count, non_reagents_count, ki67_index, restored_from_version, device, content_sha256)
  values
    (v_a.id, v_number, v_a.image_version_id, auth.uid(), p_kind, p_marks, coalesce(p_observation, ''),
     v_cnt.reagents, v_cnt.non_reagents, v_ki67, p_restored_from, private.device_label(p_device), '');

  update public.analyses set
    current_version = v_number,
    status          = case when p_kind = 'finalizacao' then 'finalizada'::public.analysis_status
                           else 'em_andamento'::public.analysis_status end,
    started_at      = coalesce(started_at, v_now),
    last_saved_at   = v_now,
    finalized_at    = case when p_kind = 'finalizacao' then v_now end
  where id = v_a.id;

  perform private.write_audit(
    case p_kind when 'finalizacao' then 'ANALISE_FINALIZADA'
                when 'restauracao' then 'VERSAO_RESTAURADA'
                else 'ANALISE_SALVA' end,
    'annotation', 'analysis', v_a.id, p_image_id => v_a.image_id,
    p_details => jsonb_build_object('versao', v_number, 'tipo', p_kind, 'restaurada_de', p_restored_from),
    p_device => p_device);

  return jsonb_build_object('ok', true, 'version_number', v_number, 'reagents', v_cnt.reagents,
                            'non_reagents', v_cnt.non_reagents, 'ki67_index', v_ki67, 'saved_at', v_now);
end $$;

-- Autosave / salvar manual (RF-21). p_base_version = versão em que o app se baseou.
create function public.save_analysis_version(
  p_analysis_id  uuid,
  p_base_version integer,
  p_marks        jsonb,
  p_observation  text default '',
  p_device       text default null,
  p_kind         public.version_kind default 'autosave'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if p_kind not in ('autosave', 'manual') then
    raise exception 'Use finalize_analysis ou restore_analysis_version para este tipo de versão.' using errcode = '22023';
  end if;
  return private.append_analysis_version(p_analysis_id, p_base_version, p_kind, p_marks, p_observation, p_device);
end $$;

-- Finaliza (RF-21) e, se as N análises estiverem prontas, libera a imagem para
-- comparação (RN-05) ou a conclui quando N = 1.
create function public.finalize_analysis(
  p_analysis_id  uuid,
  p_base_version integer,
  p_marks        jsonb,
  p_observation  text default '',
  p_device       text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_result jsonb;
  v_image  record;
  v_done   integer;
begin
  v_result := private.append_analysis_version(p_analysis_id, p_base_version, 'finalizacao',
                                              p_marks, p_observation, p_device);
  if not (v_result ->> 'ok')::boolean then
    return v_result;
  end if;

  select i.id, i.status, b.evaluators_per_image as n into v_image
  from public.analyses a join public.images i on i.id = a.image_id join public.batches b on b.id = i.batch_id
  where a.id = p_analysis_id
  for update of i;

  select count(*) into v_done from public.analyses a where a.image_id = v_image.id and a.status = 'finalizada';
  if v_done >= v_image.n and v_image.status = 'aguardando_analises' then
    update public.images
      set status = case when v_image.n >= 2 then 'pronta_para_validacao'::public.image_status
                        else 'concluida'::public.image_status end
    where id = v_image.id;
    perform private.write_audit(case when v_image.n >= 2 then 'IMAGEM_PRONTA_PARA_VALIDACAO' else 'IMAGEM_CONCLUIDA' end,
      'annotation', 'image', v_image.id, p_image_id => v_image.id,
      p_details => jsonb_build_object('n', v_image.n), p_device => p_device);
  end if;

  return v_result || jsonb_build_object('image_ready', v_done >= v_image.n);
end $$;

-- Restaurar a versão k cria uma versão nova igual a k; nada é apagado (RF-34).
create function public.restore_analysis_version(
  p_analysis_id    uuid,
  p_version_number integer,
  p_base_version   integer,
  p_device         text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_src record;
begin
  select av.marks, av.observation into v_src
  from public.analysis_versions av
  join public.analyses a on a.id = av.analysis_id
  where av.analysis_id = p_analysis_id and av.version_number = p_version_number and a.evaluator_id = auth.uid();
  if not found then
    perform private.write_audit('ACESSO_NEGADO', 'security', 'analysis', p_analysis_id,
      p_details => jsonb_build_object('rpc', 'restore_analysis_version', 'versao', p_version_number), p_device => p_device);
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  return private.append_analysis_version(p_analysis_id, p_base_version, 'restauracao',
                                         v_src.marks, v_src.observation, p_device, p_version_number);
end $$;


-- -----------------------------------------------------------------------------
-- 12. RPCs: validador — fila, comparação cega e resultado (RF-29 a RF-32, RN-05, RN-08)
-- -----------------------------------------------------------------------------

-- Fila: imagens com as N análises finalizadas que o usuário NÃO anotou.
-- O gestor também enxerga as do próprio projeto (RF-30). ki67_indices traz só os
-- índices finais, em ordem crescente (sem dizer de quem é cada um), para o card
-- mostrar a divergência sem abrir a comparação.
create function public.validation_queue(p_include_validated boolean default false)
returns table (
  image_id              uuid,
  image_code            text,
  status                public.image_status,
  batch_id              uuid,
  batch_name            text,
  project_id            uuid,
  project_name          text,
  organ                 text,
  optical_magnification text,
  evaluators_per_image  smallint,
  finalized_count       bigint,
  ready_since           timestamptz,
  image_version_id      uuid,
  width_px              integer,
  height_px             integer,
  ki67_indices          numeric[],
  consensus_ki67        numeric
)
language sql stable security definer set search_path = '' as $$
  select i.id, i.code, i.status, b.id, b.name, p.id, p.name, i.organ, i.optical_magnification,
         b.evaluators_per_image,
         (select count(*) from public.analyses a where a.image_id = i.id and a.status = 'finalizada'),
         i.status_changed_at,
         v.id, v.width_px, v.height_px,
         (select coalesce(array_agg(av.ki67_index order by av.ki67_index), '{}')
            from public.analyses a
            join public.analysis_versions av on av.analysis_id = a.id and av.version_number = a.current_version
           where a.image_id = i.id and a.status = 'finalizada' and av.ki67_index is not null),
         (select c.consensus_ki67 from public.consensus_results c where c.image_id = i.id)
  from public.images i
  join public.batches b  on b.id = i.batch_id
  join public.projects p on p.id = i.project_id
  left join public.image_versions v on v.id = private.latest_image_version(i.id)
  where (i.status = 'pronta_para_validacao' or (p_include_validated and i.status = 'validada'))
    and (private.can_validate_image(i.id) or private.manages_project(i.project_id))
  order by i.status_changed_at
$$;

-- Comparação cega: as N análises identificadas só por letra (RF-30), com as
-- versões finais e a divergência de índice calculada no servidor (RF-31).
create function public.get_comparison(p_image_id uuid, p_device text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_img      record;
  v_analyses jsonb;
  v_metrics  jsonb;
  v_result   jsonb;
begin
  if auth.uid() is null then
    perform private.forbid('Sessão obrigatória.');
  end if;

  select i.id, i.code, i.status, i.project_id, i.organ, i.optical_magnification, b.name as batch_name,
         b.evaluators_per_image as n, v.id as image_version_id, v.width_px, v.height_px, v.mime_type
    into v_img
  from public.images i
  join public.batches b on b.id = i.batch_id
  left join public.image_versions v on v.id = private.latest_image_version(i.id)
  where i.id = p_image_id
    and i.status in ('pronta_para_validacao', 'validada')
    and (private.can_validate_image(i.id) or private.manages_project(i.project_id));

  if not found then
    perform private.write_audit('ACESSO_NEGADO', 'security', 'image', p_image_id,
      p_details => jsonb_build_object('rpc', 'get_comparison',
                                      'motivo', 'imagem incompleta, inexistente ou anotada pelo próprio validador'),
      p_device => p_device);
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'blind_code', a.blind_code, 'version_number', av.version_number, 'finalized_at', a.finalized_at,
           'marks', av.marks, 'observation', av.observation, 'reagents', av.reagents_count,
           'non_reagents', av.non_reagents_count, 'ki67_index', av.ki67_index,
           'content_sha256', av.content_sha256) order by a.blind_code), '[]'::jsonb)
    into v_analyses
  from public.analyses a
  join public.analysis_versions av on av.analysis_id = a.id and av.version_number = a.current_version
  where a.image_id = p_image_id and a.status = 'finalizada';

  select jsonb_build_object(
           'min', min(av.ki67_index), 'max', max(av.ki67_index),
           'delta_pp', max(av.ki67_index) - min(av.ki67_index),
           'median', percentile_cont(0.5) within group (order by av.ki67_index))
    into v_metrics
  from public.analyses a
  join public.analysis_versions av on av.analysis_id = a.id and av.version_number = a.current_version
  where a.image_id = p_image_id and a.status = 'finalizada' and av.ki67_index is not null;

  select to_jsonb(c) - 'validator_id' - 'adopted_analysis_id' - 'adopted_version_id' into v_result
  from public.consensus_results c where c.image_id = p_image_id;

  perform private.write_audit('COMPARACAO_ABERTA', 'validation', 'image', p_image_id,
    p_image_id => p_image_id, p_device => p_device);

  return jsonb_build_object(
    'ok', true,
    'image', jsonb_build_object('id', v_img.id, 'code', v_img.code, 'status', v_img.status,
      'organ', v_img.organ, 'optical_magnification', v_img.optical_magnification,
      'batch_name', v_img.batch_name, 'n', v_img.n, 'image_version_id', v_img.image_version_id,
      'width', v_img.width_px, 'height', v_img.height_px, 'mime_type', v_img.mime_type),
    'labels', (select coalesce(jsonb_agg(jsonb_build_object('key', l.key, 'name', l.name, 'color', l.color,
                                                            'symbol', l.symbol, 'index_role', l.index_role)
                                         order by l.sort_order), '[]'::jsonb)
               from public.labels l where l.project_id = v_img.project_id),
    'analyses', v_analyses,
    'metrics',  v_metrics,
    'result',   v_result);
end $$;

-- Registra o resultado imutável (RF-32). Escolha de uma análise (por letra) ou
-- consenso com justificativa. ICC e concordância espacial vêm do app (ki67.ts);
-- contagens, índice e Δ p.p. são recalculados aqui.
create function public.submit_validation(
  p_image_id           uuid,
  p_kind               public.validation_kind,
  p_justification      text,
  p_adopted_blind_code text    default null,
  p_consensus_marks    jsonb   default null,
  p_consensus_ki67     numeric default null,
  p_metrics            jsonb   default '{}'::jsonb,
  p_device             text    default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_img              record;
  v_cnt              record;
  v_adopted_analysis uuid;
  v_adopted_version  uuid;
  v_adopted_code     char(1);
  v_reag             integer;
  v_nonreag          integer;
  v_ki67             numeric;
  v_delta            numeric;
  v_row              public.consensus_results;
begin
  if auth.uid() is null then
    perform private.forbid('Sessão obrigatória.');
  end if;

  select i.id, i.status, i.project_id into v_img from public.images i where i.id = p_image_id for update;

  if not found or not private.can_validate_image(p_image_id) then
    perform private.write_audit('ACESSO_NEGADO', 'security', 'image', p_image_id,
      p_details => jsonb_build_object('rpc', 'submit_validation'), p_device => p_device);
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  if v_img.status = 'validada' then
    raise exception 'Esta imagem já tem resultado validado.' using errcode = 'PT409';
  end if;
  if char_length(btrim(coalesce(p_justification, ''))) < 10 then
    raise exception 'A justificativa técnica é obrigatória (mínimo de 10 caracteres).' using errcode = '22023';
  end if;

  select max(av.ki67_index) - min(av.ki67_index) into v_delta
  from public.analyses a
  join public.analysis_versions av on av.analysis_id = a.id and av.version_number = a.current_version
  where a.image_id = p_image_id and a.status = 'finalizada' and av.ki67_index is not null;

  if p_kind = 'escolha' then
    select a.id, av.id, a.blind_code, av.reagents_count, av.non_reagents_count, av.ki67_index
      into v_adopted_analysis, v_adopted_version, v_adopted_code, v_reag, v_nonreag, v_ki67
    from public.analyses a
    join public.analysis_versions av on av.analysis_id = a.id and av.version_number = a.current_version
    where a.image_id = p_image_id and a.status = 'finalizada' and a.blind_code = upper(btrim(p_adopted_blind_code));
    if not found then
      raise exception 'Análise % não encontrada nesta imagem.', p_adopted_blind_code using errcode = '22023';
    end if;
    if v_ki67 is null then
      raise exception 'A análise escolhida não tem núcleos contados.' using errcode = '22023';
    end if;
  else
    if p_consensus_marks is not null then
      select * into v_cnt from private.count_marks(v_img.project_id, p_consensus_marks);
      v_reag := v_cnt.reagents; v_nonreag := v_cnt.non_reagents;
      v_ki67 := private.ki67_index(v_reag, v_nonreag);
    else
      v_ki67 := round(p_consensus_ki67, 1);
    end if;
    if v_ki67 is null or v_ki67 < 0 or v_ki67 > 100 then
      raise exception 'Informe as marcações de consenso ou um índice Ki-67 entre 0 e 100.' using errcode = '22023';
    end if;
  end if;

  insert into public.consensus_results
    (image_id, validator_id, kind, adopted_analysis_id, adopted_version_id, adopted_blind_code, consensus_marks,
     reagents_count, non_reagents_count, consensus_ki67, icc_score, divergence_delta_pp, spatial_agreement_pct,
     agreement_metrics, justification, device, content_sha256)
  values
    (p_image_id, auth.uid(), p_kind, v_adopted_analysis, v_adopted_version, v_adopted_code,
     case when p_kind = 'consenso' then p_consensus_marks end,
     v_reag, v_nonreag, v_ki67,
     nullif(p_metrics ->> 'icc_score', '')::numeric,
     v_delta,
     nullif(p_metrics ->> 'spatial_agreement_pct', '')::numeric,
     coalesce(p_metrics, '{}'::jsonb), btrim(p_justification), private.device_label(p_device), '')
  returning * into v_row;

  update public.images set status = 'validada' where id = p_image_id;

  perform private.write_audit('VALIDACAO_REGISTRADA', 'validation', 'consensus_result', v_row.id,
    p_image_id => p_image_id,
    p_details => jsonb_build_object('tipo', p_kind, 'analise_adotada', v_row.adopted_blind_code,
                                    'ki67', v_ki67, 'content_sha256', v_row.content_sha256),
    p_device => p_device);

  return jsonb_build_object('ok', true, 'id', v_row.id, 'consensus_ki67', v_row.consensus_ki67,
                            'divergence_delta_pp', v_row.divergence_delta_pp,
                            'content_sha256', v_row.content_sha256, 'frozen_at', v_row.frozen_at);
end $$;


-- -----------------------------------------------------------------------------
-- 13. Views (security_invoker: respeitam o RLS de quem consulta)
-- -----------------------------------------------------------------------------

-- Abas Pendentes / Avaliadas do avaliador (RF-22, RF-24).
create view public.v_my_analyses with (security_invoker = true) as
select a.id as analysis_id, a.image_id, a.status, a.blind_code, a.current_version,
       a.assigned_at, a.started_at, a.last_saved_at, a.finalized_at,
       i.code as image_code, i.organ, i.optical_magnification,
       b.id as batch_id, b.code as batch_code, b.name as batch_name,
       p.id as project_id, p.name as project_name,
       v.reagents_count, v.non_reagents_count, v.ki67_index
from public.analyses a
join public.images i   on i.id = a.image_id
join public.batches b  on b.id = i.batch_id
join public.projects p on p.id = i.project_id
left join public.analysis_versions v on v.analysis_id = a.id and v.version_number = a.current_version
where a.evaluator_id = auth.uid();

-- Painel do gestor por lote (RF-25).
create view public.v_batch_progress with (security_invoker = true) as
select b.id as batch_id, b.project_id, b.code, b.name, b.description, b.evaluators_per_image, b.created_at,
       count(distinct i.id)                                                      as images_count,
       count(distinct i.id) filter (where i.status = 'nao_atribuida')            as unassigned_images,
       count(distinct i.id) filter (where i.status = 'aguardando_analises')      as awaiting_images,
       count(distinct i.id) filter (where i.status = 'pronta_para_validacao')    as ready_images,
       count(distinct i.id) filter (where i.status in ('validada', 'concluida')) as completed_images,
       count(a.id) filter (where a.status = 'pendente')                          as pending_analyses,
       count(a.id) filter (where a.status = 'em_andamento')                      as in_progress_analyses,
       count(a.id) filter (where a.status = 'finalizada')                        as finalized_analyses
from public.batches b
left join public.images i   on i.batch_id = b.id
left join public.analyses a on a.image_id = i.id
group by b.id;

-- Análises com a versão atual (gestor: todas do projeto; avaliador: só as próprias, pelo RLS).
create view public.v_project_analyses with (security_invoker = true) as
select a.id as analysis_id, a.image_id, a.evaluator_id, a.blind_code, a.status, a.current_version,
       a.assigned_at, a.last_saved_at, a.finalized_at,
       i.code as image_code, i.batch_id, i.project_id,
       v.marks, v.observation, v.reagents_count, v.non_reagents_count, v.ki67_index, v.content_sha256
from public.analyses a
join public.images i on i.id = a.image_id
left join public.analysis_versions v on v.analysis_id = a.id and v.version_number = a.current_version;

-- Painel do gestor por avaliador (RF-25).
create view public.v_evaluator_progress with (security_invoker = true) as
select i.project_id, i.batch_id, a.evaluator_id, pr.name as evaluator_name,
       count(*)                                         as total,
       count(*) filter (where a.status = 'pendente')     as pending,
       count(*) filter (where a.status = 'em_andamento') as in_progress,
       count(*) filter (where a.status = 'finalizada')   as finalized,
       max(a.last_saved_at)                             as last_activity_at
from public.analyses a
join public.images i on i.id = a.image_id
left join public.profiles pr on pr.id = a.evaluator_id
group by i.project_id, i.batch_id, a.evaluator_id, pr.name;


-- -----------------------------------------------------------------------------
-- 14. Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.projects          enable row level security;
alter table public.labels            enable row level security;
alter table public.batches           enable row level security;
alter table public.images            enable row level security;
alter table public.image_versions    enable row level security;
alter table public.analyses          enable row level security;
alter table public.analysis_versions enable row level security;
alter table public.consensus_results enable row level security;
alter table public.audit_logs        enable row level security;
alter table private.app_settings          enable row level security;  -- sem políticas: só backend
alter table private.two_factor_challenges enable row level security;  -- sem políticas: só backend

-- profiles
create policy "profiles: o próprio usuário lê o seu" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: admin lê todos" on public.profiles
  for select to authenticated using ((select private.is_admin()));
create policy "profiles: gestor lê avaliadores e sua equipe" on public.profiles
  for select to authenticated using (
    ((select private.has_role('gestor')) and 'avaliador' = any (roles))
    or private.works_in_my_projects(id));
create policy "profiles: o próprio usuário edita nome e instituição" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and (select private.is_active_user()))
  with check (id = (select auth.uid()));
create policy "profiles: admin edita" on public.profiles
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- projects
create policy "projects: leitura por admin, gestor e avaliadores do projeto" on public.projects
  for select to authenticated using (
    (select private.is_admin())
    or (manager_id = (select auth.uid()) and (select private.has_role('gestor')))
    or private.evaluates_in_project(id));
create policy "projects: admin cria" on public.projects
  for insert to authenticated with check ((select private.is_admin()));
create policy "projects: admin edita" on public.projects
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- labels
create policy "labels: leitura por quem participa do projeto" on public.labels
  for select to authenticated using (private.can_see_project(project_id) or (select private.has_role('validador')));
create policy "labels: gestor cria" on public.labels
  for insert to authenticated with check (private.manages_project(project_id));
create policy "labels: gestor edita" on public.labels
  for update to authenticated using (private.manages_project(project_id)) with check (private.manages_project(project_id));

-- batches
create policy "batches: leitura por admin, gestor e avaliadores do lote" on public.batches
  for select to authenticated using (
    (select private.is_admin()) or private.manages_project(project_id) or private.evaluates_in_batch(id));
create policy "batches: gestor cria" on public.batches
  for insert to authenticated with check (private.manages_project(project_id));
create policy "batches: gestor edita" on public.batches
  for update to authenticated using (private.manages_project(project_id)) with check (private.manages_project(project_id));

-- images / image_versions: escrita só pelas RPCs
create policy "images: gestor, avaliador atribuído ou validador elegível" on public.images
  for select to authenticated using (
    private.manages_project(project_id) or private.evaluates_image(id) or private.can_validate_image(id));
create policy "image_versions: mesmo acesso da imagem" on public.image_versions
  for select to authenticated using (private.can_see_image(image_id));

-- analyses: avaliador vê só a própria (RF-27); gestor vê as do projeto.
-- O validador NÃO lê esta tabela: usa get_comparison, que esconde quem anotou.
create policy "analyses: dono ou gestor do projeto" on public.analyses
  for select to authenticated using (
    (evaluator_id = (select auth.uid()) and (select private.has_role('avaliador')))
    or private.manages_image(image_id));

create policy "analysis_versions: dono ou gestor do projeto" on public.analysis_versions
  for select to authenticated using (private.owns_analysis(analysis_id) or private.manages_analysis(analysis_id));

create policy "consensus_results: gestor do projeto ou validador elegível" on public.consensus_results
  for select to authenticated using (private.manages_image(image_id) or private.can_validate_image(image_id));

-- audit_logs: admin vê tudo; gestor, só o próprio projeto (RF-39). Inserção só pelas funções.
create policy "audit_logs: admin lê tudo" on public.audit_logs
  for select to authenticated using ((select private.is_admin()));
create policy "audit_logs: gestor lê o log do projeto" on public.audit_logs
  for select to authenticated using (project_id is not null and private.manages_project(project_id));


-- -----------------------------------------------------------------------------
-- 15. Permissões (GRANT/REVOKE) — segunda barreira além do RLS
-- -----------------------------------------------------------------------------

-- Visitante sem login (anon) não acessa nada.
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon, public;
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on functions from anon, public;

-- Usuário logado: só leitura direta; o RLS filtra as linhas.
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from authenticated;
revoke all on all sequences in schema public from authenticated;
grant select on all tables in schema public to authenticated;

-- Escritas diretas permitidas, coluna por coluna (o RLS ainda decide quem):
grant update (name, institution, avatar_url) on public.profiles to authenticated;
-- request_id só entra no insert: a chave do formulário não muda depois de criada.
grant insert (code, name, description, manager_id, status, request_id), update (name, description, manager_id, status)
  on public.projects to authenticated;
grant insert (project_id, code, name, description, evaluators_per_image, request_id), update (name, description, evaluators_per_image)
  on public.batches to authenticated;
grant insert (project_id, key, name, color, symbol, index_role, is_active, sort_order),
      update (name, color, symbol, is_active, sort_order)
  on public.labels to authenticated;

-- WORM: nem o service_role altera ou apaga (os triggers também bloqueiam o postgres).
revoke update, delete, truncate on public.audit_logs, public.analysis_versions, public.consensus_results
  from authenticated, service_role;

-- RPCs do app
grant execute on function public.my_session()                                          to authenticated;
grant execute on function public.verify_two_factor_code(text, text)                    to authenticated;
grant execute on function public.register_login(text)                                  to authenticated;
grant execute on function public.log_event(text, public.audit_category, jsonb, uuid, uuid, uuid, text) to authenticated;
grant execute on function public.verify_audit_chain()                                  to authenticated, service_role;
grant execute on function public.admin_update_user(uuid, text, text, public.app_role[], boolean) to authenticated;
grant execute on function public.register_image(uuid, text, text, text, bigint, integer, integer, boolean, text, text, text, text) to authenticated, service_role;
grant execute on function public.set_pre_annotation(uuid, jsonb, text)                 to authenticated, service_role;
grant execute on function public.assign_evaluators(uuid[], uuid[], text)               to authenticated;
grant execute on function public.assign_evaluators_to_batch(uuid, uuid[], text)        to authenticated;
grant execute on function public.open_analysis(uuid, text)                             to authenticated;
grant execute on function public.save_analysis_version(uuid, integer, jsonb, text, text, public.version_kind) to authenticated;
grant execute on function public.finalize_analysis(uuid, integer, jsonb, text, text)   to authenticated;
grant execute on function public.restore_analysis_version(uuid, integer, integer, text) to authenticated;
grant execute on function public.validation_queue(boolean)                             to authenticated;
grant execute on function public.get_comparison(uuid, text)                            to authenticated;
grant execute on function public.submit_validation(uuid, public.validation_kind, text, text, jsonb, numeric, jsonb, text) to authenticated;

-- Funções do schema private: só as usadas pelas políticas RLS e pelos triggers
-- que rodam com o papel do usuário. write_audit e companhia ficam inacessíveis.
revoke execute on all functions in schema private from public;
grant execute on function
  private.is_backend(), private.session_id(), private.two_factor_ok(), private.is_active_user(),
  private.has_role(public.app_role), private.is_admin(), private.manages_project(uuid), private.manages_image(uuid),
  private.manages_analysis(uuid), private.owns_analysis(uuid), private.evaluates_image(uuid),
  private.evaluates_in_batch(uuid), private.evaluates_in_project(uuid), private.can_validate_image(uuid),
  private.can_see_project(uuid), private.can_see_image(uuid), private.works_in_my_projects(uuid),
  private.forbid(text), private.sha256_hex(text)
  to authenticated, service_role;

-- RPCs exclusivas do backend (Edge Functions com service_role)
revoke execute on function public.issue_two_factor_code(uuid, uuid)     from authenticated;
revoke execute on function public.log_auth_failure(text, text, text)    from authenticated;
grant  execute on function public.issue_two_factor_code(uuid, uuid)     to service_role;
grant  execute on function public.log_auth_failure(text, text, text)    to service_role;

-- =============================================================================
-- Fim. Próximo passo: supabase/bootstrap_admin.sql
-- =============================================================================
