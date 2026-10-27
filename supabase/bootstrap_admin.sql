-- =============================================================================
-- Primeiro administrador (rode UMA vez, depois de aplicar as migrações)
--
-- 1. Painel do Supabase > Authentication > Users > Add user > Create new user
--    Informe o seu e-mail e uma senha forte e marque "Auto Confirm User".
--    O trigger on_auth_user_created cria o perfil em public.profiles, sem papéis.
-- 2. Troque o e-mail abaixo pelo que você usou e rode no SQL Editor.
--    (O SQL Editor roda como backend, por isso pode alterar papéis.)
-- =============================================================================

update public.profiles
set roles = '{admin}',
    name  = 'Administrador'
where email = lower('seu-email@instituicao.edu.br');

-- Confira: deve aparecer uma linha com roles = {admin}
select id, name, email, roles, is_active from public.profiles;

-- -----------------------------------------------------------------------------
-- SÓ EM DESENVOLVIMENTO, enquanto a Edge Function de envio do código 2FA não
-- existir (Fase 4): desliga a exigência do 2FA. NUNCA deixe assim em produção.
-- -----------------------------------------------------------------------------
-- update private.app_settings set require_two_factor = false, updated_at = now();
