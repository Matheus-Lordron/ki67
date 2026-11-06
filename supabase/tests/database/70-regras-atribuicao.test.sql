-- R-05 · Regras da atribuição e do fluxo: RN-07 (gestor não avalia no próprio projeto),
-- RF-29 (no máximo N avaliadores por imagem), RN-05 (comparação só com as N finalizadas), RF-21.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);
select tests.criar_cenario();

-- Como backend: as regras valem mesmo fora das RPCs.
select throws_ok(
  $$insert into public.analyses (image_id, evaluator_id, blind_code, assigned_by)
    values (tests.uid('c3'), tests.uid('02'), 'A', tests.uid('02'))$$,
  '23514', 'RN-07: o gestor do projeto não pode ser avaliador nele (protocolo duplo-cego).',
  'o gestor não pode ser avaliador no próprio projeto (RN-07)');

update public.profiles set roles = '{avaliador,gestor}' where id = tests.uid('04');
select throws_ok($$update public.projects set manager_id = tests.uid('04') where id = tests.uid('a1')$$,
  '23514', 'RN-07: este usuário já é avaliador no projeto e não pode ser o gestor dele.',
  'quem já avalia no projeto não vira gestor dele (RN-07)');
select lives_ok($$update public.projects set manager_id = tests.uid('04') where id = tests.uid('a2')$$,
  'a mesma pessoa pode gerir um projeto em que não avalia');

select lives_ok(
  $$insert into public.analyses (image_id, evaluator_id, blind_code, assigned_by)
    values (tests.uid('c3'), tests.uid('05'), 'A', tests.uid('02'))$$,
  'o segundo avaliador entra na imagem com N = 2');
select is((select blind_code::text from public.analyses where image_id = tests.uid('c3') and evaluator_id = tests.uid('05')), 'B',
  'a letra cega segue a ordem de atribuição, não o valor enviado (RF-30)');
select throws_ok(
  $$insert into public.analyses (image_id, evaluator_id, blind_code, assigned_by)
    values (tests.uid('c3'), tests.uid('06'), 'A', tests.uid('02'))$$,
  '23514', 'RF-29: a imagem já tem os 2 avaliadores definidos para o lote.',
  'o terceiro avaliador é recusado com N = 2 (RF-29)');
select throws_ok($$update public.batches set evaluators_per_image = 1 where id = tests.uid('b1')$$,
  '23514', 'RF-29: já existem imagens com 2 avaliadores neste lote; N não pode ficar menor que isso.',
  'N não fica menor que o número de avaliadores já atribuídos (RF-29)');
select throws_ok(
  $$insert into public.analyses (image_id, evaluator_id, blind_code, assigned_by)
    values (tests.uid('c1'), tests.uid('06'), 'A', tests.uid('02'))$$,
  '23514', 'A imagem já concluiu a etapa de análise.',
  'imagem pronta para validação não recebe avaliador novo');

-- RN-05: a imagem só vai para a comparação quando as N análises estão finalizadas.
select tests.como(tests.uid('04'));
select public.finalize_analysis(tests.uid('e5'), 0, '[]', '', 'teste');
reset role;
select is((select status::text from public.images where id = tests.uid('c3')), 'aguardando_analises',
  'com 1 de 2 análises finalizadas, a imagem continua aguardando (RN-05)');
select tests.como(tests.uid('05'));
select public.finalize_analysis((select id from public.analyses where image_id = tests.uid('c3') and evaluator_id = tests.uid('05')),
                                0, '[]', '', 'teste');
reset role;
select is((select status::text from public.images where id = tests.uid('c3')), 'pronta_para_validacao',
  'com as 2 finalizadas, a imagem fica pronta para validação (RN-05)');

select tests.como(tests.uid('04'));
select throws_ok($$select public.save_analysis_version(tests.uid('e1'), 1, '[]', '', 'teste')$$,
  'PT409', 'Análise finalizada não aceita novas versões (RF-21).',
  'análise finalizada não aceita versão nova (RF-21)');

select * from finish();
rollback;
