-- R-05 · Bloqueio sem 2FA (RF-02): sessão sem o código confirmado não enxerga dados,
-- e o visitante sem login (anon) não tem acesso a nenhuma tabela.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);
select tests.criar_cenario();

select tests.sem_2fa(tests.uid('04'));  -- E1 logado, sem confirmar o código

select is(public.my_session() -> 'two_factor_verified', 'false'::jsonb,
  'a sessão sabe que o 2FA não foi confirmado');
select ok(not private.has_role('avaliador'), 'sem 2FA, o papel não vale');
select is((select count(*)::int from public.analyses), 0, 'sem 2FA, o avaliador não vê análises');
select is((select count(*)::int from public.projects), 0, 'sem 2FA, o avaliador não vê projetos');
select is(public.open_analysis(tests.uid('e1'), 'teste') ->> 'error', 'NOT_FOUND',
  'sem 2FA, nem a própria análise abre');

select tests.sem_2fa(tests.uid('01'));  -- admin sem confirmar o código

select is((select count(*)::int from public.audit_logs), 0, 'sem 2FA, o admin não lê o log');
-- Comportamento atual: o próprio perfil é lido antes do 2FA (o app precisa dele para a tela do código).
select results_eq($$select id from public.profiles$$, $$values (tests.uid('01'))$$,
  'sem 2FA, só o próprio perfil é lido');
select throws_ok($$select public.verify_audit_chain()$$, '42501',
  'Somente o administrador verifica a cadeia do log.',
  'sem 2FA, o admin não verifica a cadeia do log');

reset role;
update private.app_settings set require_two_factor = false;
select tests.sem_2fa(tests.uid('04'));
select is((select count(*)::int from public.analyses), 3,
  'com o 2FA desligado nas configurações, a mesma sessão volta a ver as análises');

reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok($$select count(*) from public.analyses$$, '42501', 'permission denied for table analyses',
  'o visitante sem login não lê análises');
select throws_ok($$select count(*) from public.profiles$$, '42501', 'permission denied for table profiles',
  'o visitante sem login não lê perfis');

select * from finish();
rollback;
