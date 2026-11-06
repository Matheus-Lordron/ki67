-- R-05 · Cegamento do avaliador (RF-26 a RF-28, RN-02, RN-03): só vê o que recebeu
-- e as próprias análises; pedir a análise de outro devolve NOT_FOUND e vai para o log.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);
select tests.criar_cenario();

select tests.como(tests.uid('04'));  -- avaliador E1: e1 (I1), e3 (I2), e5 (I3)

select is((select count(*)::int from public.analyses), 3,
  'E1 vê exatamente as 3 análises dele');
select is((select count(*)::int from public.analyses where evaluator_id <> tests.uid('04')), 0,
  'E1 não vê nenhuma análise de outro avaliador (RF-27)');
select results_eq(
  $$select id from public.images order by code, id$$,
  $$select unnest(array[tests.uid('c1'), tests.uid('c2'), tests.uid('c3')]) order by 1$$,
  'E1 vê só as imagens que recebeu (RN-03)');
select results_eq($$select id from public.projects$$, $$values (tests.uid('a1'))$$,
  'E1 vê só o projeto em que avalia');
select is((select count(*)::int from public.analysis_versions
           where analysis_id in (tests.uid('e2'), tests.uid('e4'))), 0,
  'E1 não lê versões das análises dos outros');
select is((select count(*)::int from public.image_versions where id = tests.uid('d4')), 0,
  'E1 não lê o arquivo de uma imagem de outro projeto');
select is((select count(*)::int from public.audit_logs), 0,
  'E1 não lê o log de auditoria');
select results_eq($$select id from public.profiles$$, $$values (tests.uid('04'))$$,
  'E1 só lê o próprio perfil');

select is(public.open_analysis(tests.uid('e2'), 'teste'), '{"ok": false, "error": "NOT_FOUND"}'::jsonb,
  'abrir a análise de outro avaliador devolve NOT_FOUND, sem confirmar que ela existe (RF-28)');
select is(public.open_analysis(tests.uid('e1'), 'teste') #>> '{analysis,blind_code}', 'A',
  'E1 abre a própria análise');
select is(public.save_analysis_version(tests.uid('e5'), 0, '[]', '', 'teste') ->> 'ok', 'true',
  'E1 salva uma versão da própria análise');
select is(public.save_analysis_version(tests.uid('e2'), 1, '[]', '', 'teste'),
  '{"ok": false, "error": "NOT_FOUND"}'::jsonb,
  'salvar na análise de outro avaliador devolve NOT_FOUND (RN-02)');
select throws_ok(
  $$insert into public.projects (code, name, manager_id) values ('INVASOR-1', 'Invasor', tests.uid('02'))$$,
  '42501', 'new row violates row-level security policy for table "projects"',
  'avaliador não cria projeto');
select throws_ok($$update public.analyses set status = 'finalizada' where id = tests.uid('e5')$$,
  '42501', 'permission denied for table analyses',
  'avaliador não altera a análise direto na tabela (só pelas RPCs)');

reset role;
select is((select count(*)::int from public.audit_logs
           where action = 'ACESSO_NEGADO' and entity_id = tests.uid('e2') and user_id = tests.uid('04')), 2,
  'as duas tentativas na análise de outro avaliador ficaram no log como ACESSO_NEGADO');

select * from finish();
rollback;
