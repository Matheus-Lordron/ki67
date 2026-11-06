-- R-05 · Imutabilidade (RN-06, RF-11, RF-32, RF-33, RF-38): nada se apaga e versões,
-- resultado e log não mudam, nem pelo backend (postgres).
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);
select tests.criar_cenario();

-- Como backend (postgres): a barreira é o trigger, não a permissão.
select throws_ok($$update public.analysis_versions set observation = 'x'$$, '42501',
  'Versões de análise são imutáveis (RF-33) (operação UPDATE em analysis_versions)',
  'versão de análise não muda (RF-33)');
select throws_ok($$delete from public.analysis_versions$$, '42501',
  'Versões de análise são imutáveis (RF-33) (operação DELETE em analysis_versions)',
  'versão de análise não se apaga');
select throws_ok($$update public.audit_logs set details = '{}'$$, '42501',
  'O log de auditoria é somente-inclusão (RF-38) (operação UPDATE em audit_logs)',
  'registro do log não muda (RF-38)');
select throws_ok($$delete from public.audit_logs$$, '42501',
  'O log de auditoria é somente-inclusão (RF-38) (operação DELETE em audit_logs)',
  'registro do log não se apaga');
select throws_ok($$truncate public.audit_logs$$, '42501',
  'O log de auditoria é somente-inclusão (RF-38) (operação TRUNCATE em audit_logs)',
  'o log não pode ser esvaziado');
select throws_ok($$truncate public.consensus_results$$, '42501',
  'O resultado validado é imutável (RF-32) (operação TRUNCATE em consensus_results)',
  'o resultado validado não pode ser esvaziado (RF-32)');
select throws_ok($$delete from public.analyses$$, '42501',
  'Análises não são excluídas (RN-06) (operação DELETE em analyses)',
  'análise não se apaga (RN-06)');
select throws_ok($$delete from public.images$$, '42501',
  'Imagens não são excluídas (RF-11) (operação DELETE em images)',
  'imagem não se apaga (RF-11)');
select throws_ok($$delete from public.projects$$, '42501',
  'Projetos não são excluídos: mude o status para concluído (operação DELETE em projects)',
  'projeto não se apaga');
select throws_ok($$delete from public.batches$$, '42501',
  'Lotes não são excluídos (operação DELETE em batches)',
  'lote não se apaga');
select throws_ok($$delete from auth.users where id = tests.uid('04')$$, '42501',
  'Usuários não são excluídos: desative o perfil (RF-06) (operação DELETE em users)',
  'usuário não se apaga, só se desativa (RF-06)');
select throws_ok($$update public.analyses set evaluator_id = tests.uid('05') where id = tests.uid('e5')$$, '42501',
  'Imagem, avaliador, letra cega e atribuição de uma análise são imutáveis (RN-02).',
  'a análise não troca de dono (RN-02)');
select throws_ok($$update public.analyses set status = 'em_andamento' where id = tests.uid('e1')$$, '42501',
  'Análise finalizada não pode ser reaberta (RN-04, fase 2).',
  'análise finalizada não volta a ser editável (RN-04)');
select throws_ok($$update public.image_versions set sha256 = repeat('f', 64) where id = tests.uid('d1')$$, '42501',
  'O arquivo original e seus metadados são imutáveis (RF-11).',
  'o arquivo original da imagem não muda (RF-11)');

-- Como o dono da análise: nem permissão de escrita ele tem.
select tests.como(tests.uid('04'));
select throws_ok($$update public.analysis_versions set observation = 'x'$$, '42501',
  'permission denied for table analysis_versions',
  'o avaliador não altera as próprias versões direto na tabela');

select * from finish();
rollback;
