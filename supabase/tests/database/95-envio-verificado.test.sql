-- R-12 (S1): a imagem só entra no banco depois que o servidor conferiu o arquivo da
-- quarentena. register_verified_image e log_upload_rejected são exclusivas do backend
-- (Edge Function r2-confirm-upload) e recebem o usuário já autenticado por ela.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);
select tests.criar_cenario();

create function pg_temp.registrar(p_usuario uuid, p_lote uuid, p_sha text,
                                  p_chave text default null, p_mime text default 'image/png',
                                  p_tamanho bigint default 1024) returns jsonb
language sql as $$
  select public.register_verified_image(p_usuario, p_lote, p_sha,
    coalesce(p_chave, 'projects/' || (select project_id from public.batches where id = p_lote)
                      || '/batches/' || p_lote || '/' || p_sha || '.png'),
    p_mime, p_tamanho, 64, 32, 'mama', '40x', 'Chrome')
$$;

-- Backend (service_role): sem claims de usuário.
reset role;
select set_config('request.jwt.claims', '', true);

-- Caminho feliz: gestor 02 no lote B1 do seu projeto P1.
select is(pg_temp.registrar(tests.uid('02'), tests.uid('b1'), repeat('a', 64)) ->> 'status', 'uploaded',
  'o gestor do projeto registra a imagem conferida');
select is((select row(v.metadata_sanitized, v.uploaded_by, v.width_px, v.size_bytes)::text
           from public.image_versions v where v.sha256 = repeat('a', 64)),
  row(true, tests.uid('02'), 64, 1024::bigint)::text,
  'a versão fica marcada como higienizada e em nome do gestor');
select is((select i.code from public.images i join public.image_versions v on v.image_id = i.id
           where v.sha256 = repeat('a', 64)), 'LT01-0004',
  'o código segue a numeração do lote');
select is((select user_id from public.audit_logs where action = 'UPLOAD' order by id desc limit 1), tests.uid('02'),
  'o log de UPLOAD fica em nome do gestor, não do sistema');

-- Duplicata e recusas.
select is(pg_temp.registrar(tests.uid('02'), tests.uid('b1'), repeat('a', 64)) ->> 'status', 'duplicate',
  'o mesmo arquivo de novo vira duplicata');
select is(pg_temp.registrar(tests.uid('03'), tests.uid('b1'), repeat('b', 64)) ->> 'reason', 'NOT_FOUND',
  'gestor de outro projeto não registra no lote alheio');
select is(pg_temp.registrar(tests.uid('04'), tests.uid('b1'), repeat('b', 64)) ->> 'reason', 'NOT_FOUND',
  'quem não é gestor não registra');
select is(pg_temp.registrar(tests.uid('02'), tests.uid('b1'), repeat('b', 64),
    'projects/' || tests.uid('a1') || '/batches/' || tests.uid('b1') || '/outro-nome.png') ->> 'status', 'rejected',
  'a chave precisa ser exatamente a derivada do hash');
select is(pg_temp.registrar(tests.uid('02'), tests.uid('b1'), repeat('b', 64),
    'quarantine/' || tests.uid('a1') || '/' || tests.uid('b1') || '/' || repeat('b', 64) || '.png') ->> 'status', 'rejected',
  'chave da quarentena nunca é registrada');
select is(pg_temp.registrar(tests.uid('02'), tests.uid('b1'), repeat('b', 64), null, 'image/gif') ->> 'status', 'rejected',
  'formato fora da lista é recusado');
select is(pg_temp.registrar(tests.uid('02'), tests.uid('b1'), repeat('b', 64), null, 'image/png', 52428801) ->> 'status', 'rejected',
  'acima de 50 MB é recusado');

update public.profiles set is_active = false where id = tests.uid('02');
select is(pg_temp.registrar(tests.uid('02'), tests.uid('b1'), repeat('c', 64)) ->> 'reason', 'NOT_FOUND',
  'gestor desativado não registra');
update public.profiles set is_active = true where id = tests.uid('02');

-- Recusa feita pela função (metadados, hash diferente...): só o log.
select public.log_upload_rejected(tests.uid('02'), tests.uid('b1'), repeat('d', 64), 'Metadados de texto no arquivo.', 'Chrome');
select is((select row(user_id, batch_id, details ->> 'motivo')::text from public.audit_logs
           where action = 'UPLOAD_RECUSADO' order by id desc limit 1),
  row(tests.uid('02'), tests.uid('b1'), 'Metadados de texto no arquivo.')::text,
  'a recusa da função fica no log, em nome do gestor e no lote');

-- O app não chama nenhuma das duas.
select tests.como(tests.uid('02'));
select throws_ok($$select pg_temp.registrar(tests.uid('02'), tests.uid('b1'), repeat('e', 64))$$, '42501', null,
  'o app não registra imagem pelo caminho verificado');
select throws_ok($$select public.log_upload_rejected(tests.uid('02'), tests.uid('b1'), repeat('e', 64), 'x', null)$$,
  '42501', null, 'o app não escreve recusas no log');
select is((select count(*)::int from public.image_versions where sha256 = repeat('e', 64)), 0,
  'nada foi registrado pelo app');

select tests.como(tests.uid('01'));
select is(public.verify_audit_chain() ->> 'ok', 'true', 'a cadeia do log continua íntegra');

select * from finish();
rollback;
