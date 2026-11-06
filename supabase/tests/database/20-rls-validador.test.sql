-- R-05 · Cegamento do validador (RF-29, RF-30, RN-05, RN-08): só vê imagens prontas
-- que não anotou, e a comparação entrega as análises como A, B... sem dizer de quem são.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);
select tests.criar_cenario();

select tests.como(tests.uid('07'));  -- validador V, não anotou nada

select is((select count(*)::int from public.analyses), 0,
  'o validador não lê a tabela de análises (usa a comparação cega)');
select is((select count(*)::int from public.analysis_versions), 0,
  'o validador não lê as versões das análises');
select results_eq($$select id from public.images order by code, id$$,
  $$select unnest(array[tests.uid('c1'), tests.uid('c2')]) order by 1$$,
  'o validador só vê as imagens prontas para validação (RN-05)');
select results_eq($$select id from public.profiles$$, $$values (tests.uid('07'))$$,
  'o validador só lê o próprio perfil');

select is(public.get_comparison(tests.uid('c1'), 'teste') ->> 'ok', 'true',
  'o validador abre a comparação de uma imagem pronta');
select results_eq(
  $$select a ->> 'blind_code' from jsonb_array_elements(public.get_comparison(tests.uid('c1'), 'teste') -> 'analyses') a$$,
  $$values ('A'), ('B')$$,
  'a comparação traz as análises pelas letras cegas (RF-30)');
select ok(position(tests.uid('04')::text in public.get_comparison(tests.uid('c1'), 'teste')::text) = 0
      and position(tests.uid('05')::text in public.get_comparison(tests.uid('c1'), 'teste')::text) = 0
      and position('Avaliador' in public.get_comparison(tests.uid('c1'), 'teste')::text) = 0,
  'a comparação não contém o id nem o nome de quem anotou');
select is(public.get_comparison(tests.uid('c3'), 'teste') ->> 'error', 'FORBIDDEN',
  'imagem ainda aguardando análises não abre na comparação (RN-05)');

select tests.como(tests.uid('08'));  -- EV: avaliador de I2 e também validador

select is(public.get_comparison(tests.uid('c2'), 'teste') ->> 'error', 'FORBIDDEN',
  'quem anotou a imagem não valida a imagem (RN-08)');
select is(public.get_comparison(tests.uid('c1'), 'teste') ->> 'ok', 'true',
  'a mesma pessoa valida uma imagem que não anotou');
select results_eq($$select id from public.analyses$$, $$values (tests.uid('e4'))$$,
  'como avaliador, EV continua vendo só a própria análise');

reset role;
select is((select count(*)::int from public.audit_logs
           where action = 'ACESSO_NEGADO' and entity_id = tests.uid('c2') and user_id = tests.uid('08')), 1,
  'a tentativa de validar a própria imagem ficou no log como ACESSO_NEGADO');
select is((select count(*)::int from public.audit_logs
           where action = 'COMPARACAO_ABERTA' and user_id = tests.uid('07')), 5,
  'cada uma das 5 comparações abertas pelo validador acima ficou no log');

select * from finish();
rollback;
