-- R-12 parte 2: o app não registra mais imagens sozinho. O caminho antigo
-- (register_image, que confiava no hash e na higienização declarados pelo app) fica
-- fechado para o app; o único caminho é a Edge Function r2-confirm-upload.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);
select tests.criar_cenario();

select tests.como(tests.uid('02'));  -- gestor do projeto P1, com 2FA
select throws_ok($$select public.register_image(tests.uid('b1'), repeat('c', 64),
    'projects/x/batches/y/' || repeat('c', 64) || '.png', 'image/png', 1024, 64, 32, true)$$,
  '42501', null, 'o gestor não registra imagem pelo caminho antigo');
select is((select count(*)::int from public.image_versions where sha256 = repeat('c', 64)), 0,
  'nada foi registrado');

reset role;
select ok(not has_function_privilege('anon', 'public.register_image(uuid, text, text, text, bigint, integer, integer, boolean, text, text, text, text)', 'execute'),
  'anon não executa register_image');
select ok(not has_function_privilege('authenticated', 'public.register_image(uuid, text, text, text, bigint, integer, integer, boolean, text, text, text, text)', 'execute'),
  'authenticated não executa register_image');

select * from finish();
rollback;
