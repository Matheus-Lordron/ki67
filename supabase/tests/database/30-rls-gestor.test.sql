-- R-05 · Gestor (RF-08 a RF-10, RF-39): enxerga e conduz só os próprios projetos.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);
select tests.criar_cenario();

select tests.como(tests.uid('02'));  -- gestor do P1

select results_eq($$select id from public.projects$$, $$values (tests.uid('a1'))$$,
  'o gestor vê só o próprio projeto');
select is((select count(*)::int from public.analyses), 5,
  'o gestor vê as 5 análises do próprio projeto');
select is((select count(*)::int from public.analyses where id = tests.uid('e6')), 0,
  'o gestor não vê análises de outro projeto');
select is((select count(*)::int from public.images), 3,
  'o gestor vê as 3 imagens do próprio projeto');
select ok((select count(*) from public.audit_logs where project_id = tests.uid('a1')) > 0
      and (select count(*) from public.audit_logs where project_id is distinct from tests.uid('a1')) = 0,
  'o gestor lê só o log do próprio projeto (RF-39)');
-- Comportamento atual: o gestor lê o perfil de todo avaliador, inclusive de outros projetos.
select results_eq($$select id from public.profiles order by id$$,
  $$select unnest(array[tests.uid('02'), tests.uid('04'), tests.uid('05'), tests.uid('06'), tests.uid('08')]) order by 1$$,
  'o gestor lê o próprio perfil e o de todos os avaliadores');
select is(public.get_comparison(tests.uid('c1'), 'teste') ->> 'ok', 'true',
  'o gestor abre a comparação de uma imagem pronta do projeto');

select throws_ok(
  $$insert into public.projects (code, name, manager_id) values ('GESTOR-1', 'Do gestor', tests.uid('02'))$$,
  '42501', 'new row violates row-level security policy for table "projects"',
  'gestor não cria projeto (só o admin, RN-01)');
select lives_ok(
  $$insert into public.batches (project_id, code, name) values (tests.uid('a1'), 'LT02', 'Lote do gestor')$$,
  'o gestor cria lote no próprio projeto');
select throws_ok(
  $$insert into public.batches (project_id, code, name) values (tests.uid('a2'), 'LT09', 'Lote alheio')$$,
  '42501', 'new row violates row-level security policy for table "batches"',
  'o gestor não cria lote no projeto de outro gestor');

select tests.como(tests.uid('03'));  -- gestor do P2

select results_eq($$select id from public.projects$$, $$values (tests.uid('a2'))$$,
  'o outro gestor vê só o projeto dele');
select is((select count(*)::int from public.analyses where image_id in (select tests.uid('c1'))), 0,
  'o outro gestor não vê análises do P1');
select is(public.get_comparison(tests.uid('c1'), 'teste') ->> 'error', 'FORBIDDEN',
  'o outro gestor não abre a comparação de imagem do P1');

select * from finish();
rollback;
