-- Clique duplo: a mesma chave de formulário (request_id) não cria projeto nem lote repetido.
-- Roda no Supabase local (Docker): npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- Estrutura e permissões
select has_column('public', 'projects', 'request_id', 'projects tem request_id');
select col_is_unique('public', 'projects', 'request_id', 'request_id do projeto é único');
select has_column('public', 'batches', 'request_id', 'batches tem request_id');
select col_is_unique('public', 'batches', 'request_id', 'request_id do lote é único');
select ok(has_column_privilege('authenticated', 'public.projects', 'request_id', 'INSERT'),
  'o app pode enviar a chave ao criar o projeto');
select ok(not has_column_privilege('authenticated', 'public.projects', 'request_id', 'UPDATE'),
  'o app não troca a chave depois de criada');

-- Gestor de teste (o trigger de auth.users cria o perfil com os papéis do app_metadata)
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-4000-8000-000000000001', 'gestor.idempotencia@teste.local',
        '{"roles": ["gestor"]}', '{"name": "Gestor Teste"}');

-- Mesmo envio duas vezes (clique duplo), com códigos diferentes como o app gera
insert into public.projects (code, name, manager_id, request_id)
values ('TESTE-2026-AAAA', 'Projeto idempotência', '00000000-0000-4000-8000-000000000001',
        '11111111-1111-4111-8111-111111111111')
on conflict (request_id) do nothing;
insert into public.projects (code, name, manager_id, request_id)
values ('TESTE-2026-BBBB', 'Projeto idempotência', '00000000-0000-4000-8000-000000000001',
        '11111111-1111-4111-8111-111111111111')
on conflict (request_id) do nothing;

select is((select count(*)::int from public.projects where name = 'Projeto idempotência'), 1,
  'clique duplo no projeto cria uma linha só');
select is((select count(*)::int from public.audit_logs
           where action = 'PROJETO_CRIADO' and details ->> 'name' = 'Projeto idempotência'), 1,
  'e um registro de log só');

insert into public.batches (project_id, code, name, request_id)
select id, 'LT01', 'Lote idempotência', '22222222-2222-4222-8222-222222222222'
from public.projects where code = 'TESTE-2026-AAAA'
on conflict (request_id) do nothing;
insert into public.batches (project_id, code, name, request_id)
select id, 'LT02', 'Lote idempotência', '22222222-2222-4222-8222-222222222222'
from public.projects where code = 'TESTE-2026-AAAA'
on conflict (request_id) do nothing;

select is((select count(*)::int from public.batches where name = 'Lote idempotência'), 1,
  'clique duplo no lote cria uma linha só');

-- Formulários diferentes (chaves diferentes) continuam criando normalmente
insert into public.batches (project_id, code, name, request_id)
select id, 'LT02', 'Outro lote', '33333333-3333-4333-8333-333333333333'
from public.projects where code = 'TESTE-2026-AAAA'
on conflict (request_id) do nothing;
select is((select count(*)::int from public.batches b join public.projects p on p.id = b.project_id
           where p.code = 'TESTE-2026-AAAA'), 2,
  'chave nova cria outro lote');

select * from finish();
rollback;
