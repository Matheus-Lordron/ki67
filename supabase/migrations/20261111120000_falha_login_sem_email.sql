-- R-18 (L1, LGPD art. 6º, III): a falha de login deixa de gravar o e-mail digitado.
--
-- O log de auditoria não pode ser alterado nem apagado (WORM), então o que entra nele
-- fica para sempre, inclusive o e-mail de quem nem tem conta. Agora a falha guarda só o
-- HMAC-SHA256 do e-mail com um sal secreto, que basta para contar tentativas (R-14).
-- Sem o sal, o hash não é recalculável a partir de uma lista de e-mails.
--
-- Registros antigos com o e-mail em texto continuam no log (WORM); a anonimização do
-- histórico fica para o R-17.

-- Segredos internos do banco. Nenhum papel do app lê esta tabela; só as funções
-- SECURITY DEFINER abaixo.
create table private.secrets (
  name  text primary key,
  value bytea not null
);
revoke all on table private.secrets from public, anon, authenticated, service_role;

insert into private.secrets (name, value)
values ('login_email_salt', extensions.gen_random_bytes(32));

create function private.email_hash(p_email text) returns text
language sql stable security definer set search_path = '' as $$
  select encode(extensions.hmac(convert_to(lower(btrim(p_email)), 'UTF8'), s.value, 'sha256'), 'hex')
  from private.secrets s where s.name = 'login_email_salt'
$$;
revoke execute on function private.email_hash(text) from public, anon, authenticated, service_role;

-- Mesma assinatura: a Edge Function não muda a chamada.
create or replace function public.log_auth_failure(p_email text, p_reason text default 'credenciais_invalidas',
                                                   p_device text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid;
begin
  if not private.is_backend() then
    perform private.forbid('Somente o backend registra falhas de login.');
  end if;
  select p.id into v_uid from public.profiles p where p.email = lower(btrim(p_email));
  perform private.write_audit('LOGIN_FALHA', 'auth', 'profile', v_uid,
    p_details => jsonb_build_object('email_hash', private.email_hash(p_email), 'motivo', p_reason),
    p_device => p_device, p_user_id => v_uid);
end $$;

-- SOMENTE service_role (Edge Function de login): falhas dos últimos 15 minutos do
-- e-mail neste IP (par), deste IP e deste e-mail de qualquer IP (R-14). O IP vem do
-- cabeçalho repassado pela função, pela mesma regra do log (private.request_ip).
-- Sem IP conhecido, o par vira só o e-mail.
create function public.count_login_failures(p_email text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_hash text := private.email_hash(p_email);
  v_ip   text := private.request_ip();
  v_ip_count int := 0;
  v_email_count int;
  v_pair int;
begin
  if not private.is_backend() then
    perform private.forbid('Somente o backend consulta falhas de login.');
  end if;
  select count(*) filter (where l.details ->> 'email_hash' = v_hash),
         count(*) filter (where l.details ->> 'email_hash' = v_hash and l.ip_address = v_ip),
         count(*) filter (where l.ip_address = v_ip)
    into v_email_count, v_pair, v_ip_count
  from public.audit_logs l
  where l.action = 'LOGIN_FALHA' and l.occurred_at >= now() - interval '15 minutes';
  if v_ip is null then v_pair := v_email_count; end if;
  return jsonb_build_object('par', v_pair, 'ip', v_ip_count, 'email', v_email_count);
end $$;

revoke execute on function public.count_login_failures(text) from public, anon, authenticated;
grant  execute on function public.count_login_failures(text) to service_role;

-- As falhas recentes são lidas pela janela de 15 min a cada login.
create index audit_logs_login_falha_idx on public.audit_logs (occurred_at desc)
  where action = 'LOGIN_FALHA';
