-- =============================================================================
-- Atualização da Fase 4 — SÓ para quem já rodou o schema.sql da Fase 1.
-- (Quem vai rodar o schema.sql agora pela primeira vez NÃO precisa deste arquivo.)
-- SQL Editor > New query > cole este arquivo > Run.
-- =============================================================================

drop function if exists public.validation_queue(boolean);

-- Fila: imagens com as N análises finalizadas que o usuário NÃO anotou.
-- O gestor também enxerga as do próprio projeto (RF-30). ki67_indices traz só os
-- índices finais, em ordem crescente (sem dizer de quem é cada um), para o card
-- mostrar a divergência sem abrir a comparação.
create function public.validation_queue(p_include_validated boolean default false)
returns table (
  image_id              uuid,
  image_code            text,
  status                public.image_status,
  batch_id              uuid,
  batch_name            text,
  project_id            uuid,
  project_name          text,
  organ                 text,
  optical_magnification text,
  evaluators_per_image  smallint,
  finalized_count       bigint,
  ready_since           timestamptz,
  image_version_id      uuid,
  width_px              integer,
  height_px             integer,
  ki67_indices          numeric[],
  consensus_ki67        numeric
)
language sql stable security definer set search_path = '' as $$
  select i.id, i.code, i.status, b.id, b.name, p.id, p.name, i.organ, i.optical_magnification,
         b.evaluators_per_image,
         (select count(*) from public.analyses a where a.image_id = i.id and a.status = 'finalizada'),
         i.status_changed_at,
         v.id, v.width_px, v.height_px,
         (select coalesce(array_agg(av.ki67_index order by av.ki67_index), '{}')
            from public.analyses a
            join public.analysis_versions av on av.analysis_id = a.id and av.version_number = a.current_version
           where a.image_id = i.id and a.status = 'finalizada' and av.ki67_index is not null),
         (select c.consensus_ki67 from public.consensus_results c where c.image_id = i.id)
  from public.images i
  join public.batches b  on b.id = i.batch_id
  join public.projects p on p.id = i.project_id
  left join public.image_versions v on v.id = private.latest_image_version(i.id)
  where (i.status = 'pronta_para_validacao' or (p_include_validated and i.status = 'validada'))
    and (private.can_validate_image(i.id) or private.manages_project(i.project_id))
  order by i.status_changed_at
$$;

-- Análises com a versão atual (gestor: todas do projeto; avaliador: só as próprias, pelo RLS).
create view public.v_project_analyses with (security_invoker = true) as
select a.id as analysis_id, a.image_id, a.evaluator_id, a.blind_code, a.status, a.current_version,
       a.assigned_at, a.last_saved_at, a.finalized_at,
       i.code as image_code, i.batch_id, i.project_id,
       v.marks, v.observation, v.reagents_count, v.non_reagents_count, v.ki67_index, v.content_sha256
from public.analyses a
join public.images i on i.id = a.image_id
left join public.analysis_versions v on v.analysis_id = a.id and v.version_number = a.current_version;

revoke all on function public.validation_queue(boolean) from public, anon;
grant execute on function public.validation_queue(boolean) to authenticated;
revoke all on public.v_project_analyses from anon;
grant select on public.v_project_analyses to authenticated;
