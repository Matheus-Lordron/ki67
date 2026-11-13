-- R-12 (S1): a imagem só entra no banco depois que o servidor conferiu o arquivo.
--
-- Fluxo novo: o app envia para quarantine/<projeto>/<lote>/<sha256>.<ext>; a Edge
-- Function r2-confirm-upload baixa, confere hash, tamanho, formato e metadados, grava
-- em projects/... e só então chama register_verified_image. Recusado, ela chama
-- log_upload_rejected. As duas são exclusivas do backend (service_role) e recebem o
-- usuário que a função já autenticou.
--
-- O register_image antigo continua igual até o app passar a usar o fluxo novo
-- (segunda parte do R-12); depois disso ele deixa de ser chamado pelo app.

create function public.register_verified_image(
  p_user_id               uuid,
  p_batch_id              uuid,
  p_sha256                text,
  p_storage_key           text,
  p_mime_type             text,
  p_size_bytes            bigint,
  p_width_px              integer,
  p_height_px             integer,
  p_organ                 text default null,
  p_optical_magnification text default null,
  p_device                text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_batch    record;
  v_sha      text := lower(btrim(coalesce(p_sha256, '')));
  v_ext      text := case p_mime_type when 'image/jpeg' then 'jpg' when 'image/png' then 'png'
                                      when 'image/tiff' then 'tif' end;
  v_reason   text;
  v_existing record;
  v_seq      integer;
  v_code     text;
  v_image_id uuid;
  v_ver_id   uuid;
begin
  if not private.is_backend() then
    perform private.forbid('Somente o backend registra imagens conferidas.');
  end if;

  select b.id, b.code, b.project_id, p.status as project_status into v_batch
  from public.batches b join public.projects p on p.id = b.project_id
  where b.id = p_batch_id
    and p.manager_id = p_user_id
    and exists (select 1 from public.profiles u
                where u.id = p_user_id and u.is_active and 'gestor' = any (u.roles))
  for update of b;  -- serializa a numeração das imagens do lote

  if not found then
    perform private.write_audit('ACESSO_NEGADO', 'security', 'batch', p_batch_id,
      p_details => jsonb_build_object('rpc', 'register_verified_image'), p_device => p_device, p_user_id => p_user_id);
    return jsonb_build_object('ok', false, 'status', 'rejected', 'reason', 'NOT_FOUND');
  end if;

  v_reason := case
    when v_batch.project_status <> 'ativo'                               then 'O projeto não está ativo.'
    when v_sha !~ '^[0-9a-f]{64}$'                                       then 'Hash SHA-256 inválido.'
    when v_ext is null                                                   then 'Formato não aceito (use JPG, PNG ou TIFF).'
    when coalesce(p_size_bytes, 0) <= 0                                  then 'Arquivo vazio.'
    when p_size_bytes > (select s.max_upload_bytes from private.app_settings s) then 'Arquivo acima de 50 MB.'
    when coalesce(p_width_px, 0) <= 0 or coalesce(p_height_px, 0) <= 0  then 'Dimensões da imagem inválidas.'
    when p_storage_key is distinct from
         'projects/' || v_batch.project_id || '/batches/' || v_batch.id || '/' || v_sha || '.' || v_ext
                                                                         then 'Chave de armazenamento fora do padrão do lote.'
  end;
  if v_reason is not null then
    perform private.write_audit('UPLOAD_RECUSADO', 'batch', 'batch', v_batch.id, p_batch_id => v_batch.id,
      p_details => jsonb_build_object('motivo', v_reason), p_device => p_device, p_user_id => p_user_id);
    return jsonb_build_object('ok', false, 'status', 'rejected', 'reason', v_reason);
  end if;

  select i.code, i.project_id into v_existing
  from public.image_versions v join public.images i on i.id = v.image_id
  where v.sha256 = v_sha;
  if found then
    perform private.write_audit('UPLOAD_DUPLICADO', 'batch', 'batch', v_batch.id, p_batch_id => v_batch.id,
      p_details => jsonb_build_object('sha256', v_sha), p_device => p_device, p_user_id => p_user_id);
    return jsonb_build_object('ok', false, 'status', 'duplicate',
      'existing_code', case when v_existing.project_id = v_batch.project_id then v_existing.code end);
  end if;

  select coalesce(max(i.sequence_number), 0) + 1 into v_seq from public.images i where i.batch_id = v_batch.id;
  v_code := v_batch.code || '-' || lpad(v_seq::text, 4, '0');

  insert into public.images (batch_id, project_id, code, sequence_number, organ, optical_magnification, uploaded_by)
  values (v_batch.id, v_batch.project_id, v_code, v_seq,
          nullif(btrim(p_organ), ''), nullif(btrim(p_optical_magnification), ''), p_user_id)
  returning id into v_image_id;

  -- metadata_sanitized = true: o servidor conferiu que o arquivo não tem metadados de texto.
  insert into public.image_versions (image_id, version_number, sha256, storage_key, mime_type,
                                     size_bytes, width_px, height_px, metadata_sanitized, uploaded_by)
  values (v_image_id, 1, v_sha, p_storage_key, p_mime_type,
          p_size_bytes, p_width_px, p_height_px, true, p_user_id)
  returning id into v_ver_id;

  perform private.write_audit('UPLOAD', 'batch', 'image', v_image_id, p_image_id => v_image_id,
    p_details => jsonb_build_object('code', v_code, 'sha256', v_sha, 'size_bytes', p_size_bytes,
                                    'mime_type', p_mime_type, 'metadata_sanitized', true, 'conferido_no_servidor', true),
    p_device => p_device, p_user_id => p_user_id);

  return jsonb_build_object('ok', true, 'status', 'uploaded', 'image_id', v_image_id,
                            'image_version_id', v_ver_id, 'code', v_code);
end $$;

-- Recusa decidida pela função (metadados, hash diferente, formato trocado...).
create function public.log_upload_rejected(p_user_id uuid, p_batch_id uuid, p_sha256 text,
                                           p_reason text, p_device text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_batch uuid;
begin
  if not private.is_backend() then
    perform private.forbid('Somente o backend registra recusas de envio.');
  end if;
  select b.id into v_batch from public.batches b where b.id = p_batch_id;
  perform private.write_audit('UPLOAD_RECUSADO', 'batch', 'batch', v_batch, p_batch_id => v_batch,
    p_details => jsonb_build_object('motivo', left(p_reason, 300), 'sha256', lower(left(p_sha256, 64)),
                                    'conferido_no_servidor', true),
    p_device => p_device, p_user_id => p_user_id);
end $$;

revoke execute on function public.register_verified_image(uuid, uuid, text, text, text, bigint, integer, integer, text, text, text)
  from public, anon, authenticated;
revoke execute on function public.log_upload_rejected(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.register_verified_image(uuid, uuid, text, text, text, bigint, integer, integer, text, text, text)
  to service_role;
grant execute on function public.log_upload_rejected(uuid, uuid, text, text, text) to service_role;
