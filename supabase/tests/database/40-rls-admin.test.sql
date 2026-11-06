-- R-05 · Administrador (RF-06, RF-07, RF-09, RF-39): cadastros e log; não entra nas análises.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);
select tests.criar_cenario();

select tests.como(tests.uid('01'));

select is((select count(*)::int from public.projects), 2, 'o admin vê todos os projetos');
select is((select count(*)::int from public.profiles), 8, 'o admin vê todos os perfis');
select ok((select count(*) from public.audit_logs where project_id = tests.uid('a1')) > 0
      and (select count(*) from public.audit_logs where project_id = tests.uid('a2')) > 0,
  'o admin lê o log de todos os projetos');
select is((select count(*)::int from public.batches), 2, 'o admin vê todos os lotes');
-- Comportamento atual: nenhuma política dá ao admin acesso às análises, imagens e versões.
select is((select count(*)::int from public.analyses), 0, 'o admin não lê as análises');
select is((select count(*)::int from public.images), 0, 'o admin não lê as imagens');
select lives_ok(
  $$insert into public.projects (code, name, manager_id) values ('ADMIN-1', 'Do admin', tests.uid('03'))$$,
  'o admin cria projeto');
select throws_ok(
  $$insert into public.projects (code, name, manager_id) values ('ADMIN-2', 'Sem gestor', tests.uid('04'))$$,
  '23514', 'O gestor designado precisa estar ativo e ter o papel Gestor.',
  'o gestor designado precisa ter o papel Gestor');

select * from finish();
rollback;
