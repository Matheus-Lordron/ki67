-- R-05: ajudantes da bateria de caracterização. Roda primeiro (ordem alfabética) e
-- fica no banco LOCAL de teste; nunca vai para uma migração nem para o Supabase real.
--
--   tests.como(<usuário>)   age como o usuário logado e com o 2FA confirmado
--   tests.sem_2fa(<usuário>) age como o usuário logado, mas sem confirmar o 2FA
--   reset role              volta a ser o backend (postgres)
--   tests.criar_cenario()   monta o cenário fixo descrito abaixo
--
-- Cenário (UUIDs fixos, sufixo = papel):
--   01 admin · 02 gestor do P1 · 03 gestor do P2 · 04 avaliador E1 · 05 avaliador E2
--   06 avaliador E3 · 07 validador V · 08 avaliador e validador EV
--   P1 (gestor 02) → lote B1 (N=2) → I1 (E1 'A', E2 'B', finalizadas: pronta para validação)
--                                   → I2 (E1 'A', EV 'B', finalizadas: pronta para validação)
--                                   → I3 (E1 'A', pendente: aguardando análises)
--   P2 (gestor 03) → lote B2 (N=1) → I4 (E3 'A', pendente)
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

create schema if not exists tests;

create or replace function tests.uid(p_sufixo text) returns uuid
language sql immutable as $$ select ('00000000-0000-4000-8000-0000000000' || p_sufixo)::uuid $$;

create or replace function tests.sessao(p_usuario uuid) returns uuid
language sql immutable as $$ select ('10000000' || substr(p_usuario::text, 9))::uuid $$;

-- Claims do JWT como o PostgREST define; o papel vira authenticated.
create or replace function tests.como(p_usuario uuid, p_sessao uuid default null) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object(
    'sub', p_usuario, 'role', 'authenticated',
    'session_id', coalesce(p_sessao, tests.sessao(p_usuario)))::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Sessão nova, sem desafio 2FA confirmado.
create or replace function tests.sem_2fa(p_usuario uuid) returns void
language sql as $$ select tests.como(p_usuario, '20000000-0000-4000-8000-000000000000'::uuid) $$;

create or replace function tests.criar_cenario() returns void
language plpgsql as $$
declare
  v_marca constant jsonb := '[{"id": "m1", "type": "point", "label": "reagente", "x": 10, "y": 10}]';
  u record;
begin
  for u in select * from (values
      ('01', 'Admin Teste',      '{admin}'),
      ('02', 'Gestor P1',        '{gestor}'),
      ('03', 'Gestor P2',        '{gestor}'),
      ('04', 'Avaliador E1',     '{avaliador}'),
      ('05', 'Avaliador E2',     '{avaliador}'),
      ('06', 'Avaliador E3',     '{avaliador}'),
      ('07', 'Validador V',      '{validador}'),
      ('08', 'Aval. e Valid. EV', '{avaliador,validador}')) t(sufixo, nome, papeis)
  loop
    insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
    values (tests.uid(u.sufixo), 'teste' || u.sufixo || '@teste.local',
            jsonb_build_object('roles', u.papeis::text[]), jsonb_build_object('name', u.nome));
    insert into private.two_factor_challenges (user_id, session_id, code_hash, expires_at, verified_at)
    values (tests.uid(u.sufixo), tests.sessao(tests.uid(u.sufixo)), 'teste', now() + interval '1 hour', now());
  end loop;

  insert into public.projects (id, code, name, manager_id) values
    (tests.uid('a1'), 'TESTE-P1', 'Projeto P1', tests.uid('02')),
    (tests.uid('a2'), 'TESTE-P2', 'Projeto P2', tests.uid('03'));
  insert into public.batches (id, project_id, code, name, evaluators_per_image) values
    (tests.uid('b1'), tests.uid('a1'), 'LT01', 'Lote B1', 2),
    (tests.uid('b2'), tests.uid('a2'), 'LT01', 'Lote B2', 1);
  insert into public.images (id, batch_id, project_id, code, sequence_number, uploaded_by) values
    (tests.uid('c1'), tests.uid('b1'), tests.uid('a1'), 'LT01-0001', 1, tests.uid('02')),
    (tests.uid('c2'), tests.uid('b1'), tests.uid('a1'), 'LT01-0002', 2, tests.uid('02')),
    (tests.uid('c3'), tests.uid('b1'), tests.uid('a1'), 'LT01-0003', 3, tests.uid('02')),
    (tests.uid('c4'), tests.uid('b2'), tests.uid('a2'), 'LT01-0001', 1, tests.uid('03'));
  insert into public.image_versions (id, image_id, sha256, storage_key, mime_type, size_bytes, width_px, height_px, uploaded_by)
  select tests.uid('d' || n), tests.uid('c' || n), repeat(n::text, 64), 'teste/' || n, 'image/png', 100, 10, 10,
         case when n = 4 then tests.uid('03') else tests.uid('02') end
  from generate_series(1, 4) n;

  -- A ordem define a letra cega (A, B...).
  insert into public.analyses (id, image_id, evaluator_id, blind_code, assigned_by) values
    (tests.uid('e1'), tests.uid('c1'), tests.uid('04'), 'A', tests.uid('02'));
  insert into public.analyses (id, image_id, evaluator_id, blind_code, assigned_by) values
    (tests.uid('e2'), tests.uid('c1'), tests.uid('05'), 'A', tests.uid('02'));
  insert into public.analyses (id, image_id, evaluator_id, blind_code, assigned_by) values
    (tests.uid('e3'), tests.uid('c2'), tests.uid('04'), 'A', tests.uid('02'));
  insert into public.analyses (id, image_id, evaluator_id, blind_code, assigned_by) values
    (tests.uid('e4'), tests.uid('c2'), tests.uid('08'), 'A', tests.uid('02'));
  insert into public.analyses (id, image_id, evaluator_id, blind_code, assigned_by) values
    (tests.uid('e5'), tests.uid('c3'), tests.uid('04'), 'A', tests.uid('02')),
    (tests.uid('e6'), tests.uid('c4'), tests.uid('06'), 'A', tests.uid('03'));

  -- Finaliza pelas RPCs, como cada avaliador (claims do JWT, sem trocar de papel).
  for u in select * from (values ('04', 'e1'), ('05', 'e2'), ('04', 'e3'), ('08', 'e4')) t(s, a) loop
    perform set_config('request.jwt.claims', json_build_object('sub', tests.uid(u.s), 'role', 'authenticated',
              'session_id', tests.sessao(tests.uid(u.s)))::text, true);
    if not (public.finalize_analysis(tests.uid(u.a), 0, v_marca, '', 'teste') ->> 'ok')::boolean then
      raise exception 'cenário: não finalizou a análise %', u.a;
    end if;
  end loop;

  perform set_config('request.jwt.claims', '', true);
end $$;

-- Os testes chamam os ajudantes já como authenticated (ou anon).
grant usage on schema tests to authenticated, anon;
grant execute on all functions in schema tests to authenticated, anon;

select pass('ajudantes da bateria criados');
select * from finish();
commit;
