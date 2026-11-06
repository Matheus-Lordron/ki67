-- R-05 · Log de auditoria (RF-37, RF-38): hash encadeado, verificação só pelo admin e
-- adulteração detectada por verify_audit_chain().
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);
select tests.criar_cenario();

select tests.como(tests.uid('01'));
select is(public.verify_audit_chain() ->> 'ok', 'true', 'a cadeia do log está íntegra');
select ok((public.verify_audit_chain() ->> 'checked')::int > 0, 'a verificação percorre os registros');

select tests.como(tests.uid('04'));
select throws_ok($$select public.verify_audit_chain()$$, '42501',
  'Somente o administrador verifica a cadeia do log.',
  'só o admin verifica a cadeia do log');
select throws_ok(
  $$insert into public.audit_logs (action, category, prev_hash, hash) values ('FORJADO', 'security', '', '')$$,
  '42501', 'permission denied for table audit_logs',
  'o usuário não grava no log direto na tabela');

reset role;
select set_config('request.jwt.claims', '', true);
select is((select prev_hash from public.audit_logs order by id limit 1), repeat('0', 64),
  'o primeiro registro aponta para o hash zero');
select ok(not exists (select 1 from public.audit_logs l
                      join public.audit_logs anterior on anterior.id = l.id - 1
                      where l.prev_hash <> anterior.hash),
  'cada registro guarda o hash do anterior');

-- Simula uma adulteração feita por fora (trigger desligado só nesta transação).
alter table public.audit_logs disable trigger audit_logs_worm;
update public.audit_logs set details = '{"adulterado": true}'
where id = (select id from public.audit_logs order by id offset 2 limit 1);
alter table public.audit_logs enable trigger audit_logs_worm;
select is(public.verify_audit_chain() ->> 'first_broken_id',
  (select id::text from public.audit_logs order by id offset 2 limit 1),
  'a verificação aponta o registro adulterado');

select * from finish();
rollback;
