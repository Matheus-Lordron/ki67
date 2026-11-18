-- R-12 parte 2: o app passou a enviar para a quarentena e a confirmar pela Edge Function
-- r2-confirm-upload, que confere o arquivo e registra a imagem pelo register_verified_image.
-- O register_image antigo confiava no hash e na higienização declarados pelo app; fica
-- fechado para o app (anon e authenticated). A função continua existindo (não apaga nada)
-- e o backend ainda pode executá-la.
--
-- Ordem de implantação: a função r2-confirm-upload (parte 1) precisa estar publicada e o
-- app atualizado antes desta migração; um app antigo que chame register_image recebe 42501.

revoke execute on function public.register_image(uuid, text, text, text, bigint, integer, integer, boolean, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.register_image(uuid, text, text, text, bigint, integer, integer, boolean, text, text, text, text)
  to service_role;
