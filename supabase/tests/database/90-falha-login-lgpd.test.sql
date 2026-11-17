-- R-18 (L1, LGPD art. 6º, III): a falha de login guarda o HMAC do e-mail com sal secreto,
-- nunca o e-mail digitado. A contagem de tentativas (R-14) passa a ser feita no banco.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);
select tests.criar_cenario();

-- Procura um texto em todas as linhas de todas as tabelas dos schemas do app e do Auth.
create function pg_temp.tabelas_com(p_texto text) returns text[]
language plpgsql as $$
declare
  t record;
  achou boolean;
  r text[] := '{}';
begin
  for t in select n.nspname, c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where c.relkind = 'r' and n.nspname in ('public', 'private', 'auth')
  loop
    execute format('select exists (select 1 from %I.%I x where x::text ilike %L)',
                   t.nspname, t.relname, '%' || p_texto || '%') into achou;
    if achou then r := r || (t.nspname || '.' || t.relname); end if;
  end loop;
  return r;
end $$;

-- Backend (service_role da Edge Function), com o IP repassado pelo cabeçalho.
reset role;
select set_config('request.jwt.claims', '', true);
select set_config('request.headers', '{"x-forwarded-for": "200.10.20.30, 10.0.0.1"}', true);

select public.log_auth_failure('  Ninguem.Aqui@Fora.Local ', 'credenciais_invalidas', 'Chrome');
select public.log_auth_failure('ninguem.aqui@fora.local', 'credenciais_invalidas', 'Chrome');

select is(pg_temp.tabelas_com('ninguem.aqui@fora.local'), '{}'::text[],
  'depois da falha, o e-mail inexistente não aparece em nenhuma tabela');

select ok((select details ->> 'email_hash' ~ '^[0-9a-f]{64}$' from public.audit_logs
           where action = 'LOGIN_FALHA' order by id desc limit 1),
  'a falha guarda o hash do e-mail (64 hex)');
select is((select count(distinct details ->> 'email_hash')::int from public.audit_logs where action = 'LOGIN_FALHA'), 1,
  'maiúsculas e espaços não mudam o hash: as duas falhas são do mesmo e-mail');
select isnt((select details ->> 'email_hash' from public.audit_logs where action = 'LOGIN_FALHA' limit 1),
  encode(extensions.digest('ninguem.aqui@fora.local', 'sha256'), 'hex'),
  'o hash tem sal: não é o SHA-256 puro, que qualquer um recalcula');
select is((select details ->> 'motivo' from public.audit_logs where action = 'LOGIN_FALHA' limit 1),
  'credenciais_invalidas', 'o motivo continua no log');

-- Contagem (R-14) por e-mail no mesmo IP, só pelo IP e só pelo e-mail.
select public.log_auth_failure('outra.pessoa@fora.local');
select set_config('request.headers', '{"x-forwarded-for": "177.1.1.1"}', true);
select public.log_auth_failure('ninguem.aqui@fora.local');
select set_config('request.headers', '{"x-forwarded-for": "200.10.20.30"}', true);

select is(public.count_login_failures('Ninguem.Aqui@Fora.Local'),
  '{"par": 2, "ip": 3, "email": 3}'::jsonb,
  'conta as falhas do e-mail neste IP, do IP e do e-mail');

select set_config('request.headers', '', true);
select is(public.count_login_failures('ninguem.aqui@fora.local') ->> 'par', '3',
  'sem IP conhecido, o par vira só o e-mail');

-- Sal e contagem fora do alcance do usuário.
select tests.como(tests.uid('01'));
select throws_ok($$select * from private.secrets$$, '42501', null, 'nem o admin lê o sal');
select throws_ok($$select public.count_login_failures('teste04@teste.local')$$, '42501', null,
  'o usuário não consulta a contagem de falhas (só o backend)');
select throws_ok($$select private.email_hash('teste04@teste.local')$$, '42501', null,
  'o usuário não calcula o hash (evita testar e-mails contra o log)');

select is(public.verify_audit_chain() ->> 'ok', 'true', 'a cadeia do log continua íntegra');

-- Janela de 15 min: envelhece a falha vinda de 177.1.1.1 (trigger WORM desligado só aqui).
reset role;
select set_config('request.jwt.claims', '', true);
alter table public.audit_logs disable trigger audit_logs_worm;
update public.audit_logs set occurred_at = now() - interval '16 minutes'
where action = 'LOGIN_FALHA' and ip_address = '177.1.1.1';
alter table public.audit_logs enable trigger audit_logs_worm;
select is(public.count_login_failures('ninguem.aqui@fora.local') ->> 'email', '2',
  'falhas com mais de 15 minutos não contam');

select * from finish();
rollback;
