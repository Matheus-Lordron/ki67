-- =============================================================================
-- LIMPEZA DOS DADOS DE TESTE — SÓ EM DESENVOLVIMENTO. NÃO TEM VOLTA.
--
-- Apaga projetos, labels, lotes, imagens, análises, versões, resultados de
-- validação e TODO o log de auditoria. Mantém os usuários (auth.users e
-- public.profiles), os papéis de cada um e as configurações do sistema.
--
-- O banco normalmente recusa qualquer exclusão (RN-06, RF-38). Este script
-- desliga essas proteções só dentro da transação e as religa no fim.
-- Nunca rode isto num projeto com dados reais de estudo.
--
-- SQL Editor > New query > cole este arquivo > Run.
-- Os arquivos no bucket do R2 NÃO são apagados por aqui: limpe pelo painel da
-- Cloudflare (bucket > Objects).
-- =============================================================================

begin;

alter table public.consensus_results disable trigger user;
alter table public.analysis_versions disable trigger user;
alter table public.analyses          disable trigger user;
alter table public.image_versions    disable trigger user;
alter table public.images            disable trigger user;
alter table public.batches           disable trigger user;
alter table public.labels            disable trigger user;
alter table public.projects          disable trigger user;
alter table public.audit_logs        disable trigger user;

truncate table
  public.consensus_results,
  public.analysis_versions,
  public.analyses,
  public.image_versions,
  public.images,
  public.batches,
  public.labels,
  public.projects,
  public.audit_logs
restart identity;

alter table public.consensus_results enable trigger user;
alter table public.analysis_versions enable trigger user;
alter table public.analyses          enable trigger user;
alter table public.image_versions    enable trigger user;
alter table public.images            enable trigger user;
alter table public.batches           enable trigger user;
alter table public.labels            enable trigger user;
alter table public.projects          enable trigger user;
alter table public.audit_logs        enable trigger user;

commit;

-- Confira: só os usuários devem ter linhas.
select 'usuarios' as tabela, count(*) from public.profiles
union all select 'projetos', count(*) from public.projects
union all select 'lotes', count(*) from public.batches
union all select 'imagens', count(*) from public.images
union all select 'analises', count(*) from public.analyses
union all select 'versoes', count(*) from public.analysis_versions
union all select 'validacoes', count(*) from public.consensus_results
union all select 'log', count(*) from public.audit_logs;
