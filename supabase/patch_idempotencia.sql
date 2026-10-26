-- =============================================================================
-- Atualização: clique duplo não cria projeto nem lote repetido.
-- SÓ para quem já rodou o schema.sql antes desta mudança.
-- (Quem vai rodar o schema.sql agora pela primeira vez NÃO precisa deste arquivo.)
-- SQL Editor > New query > cole este arquivo > Run. Pode rodar mais de uma vez.
--
-- O formulário gera uma chave (request_id) ao abrir e a reenvia em toda
-- tentativa. Com a coluna unique, o app grava com ON CONFLICT (request_id)
-- DO NOTHING: a repetição não insere outra linha nem outro registro de log.
-- =============================================================================

alter table public.projects add column if not exists request_id uuid unique;
alter table public.batches  add column if not exists request_id uuid unique;

comment on column public.projects.request_id is 'Chave do formulário: reenviar não duplica';
comment on column public.batches.request_id  is 'Chave do formulário: reenviar não duplica';

-- request_id só entra no insert: a chave do formulário não muda depois de criada.
grant insert (request_id) on public.projects to authenticated;
grant insert (request_id) on public.batches  to authenticated;
