create or replace function private.gift_work_json(w public.gift_work) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', w.id, 'settleDate', w.settle_date, 'status', w.status, 'memo', w.memo,
    'createdBy', w.created_by, 'createdAt', private.gift_fmt(w.created_at),
    'updatedBy', w.updated_by, 'updatedAt', private.gift_fmt(w.updated_at),
    'raw', (select jsonb_build_object('file', f.file_name, 'rows', f.row_count, 'at', private.gift_fmt(f.uploaded_at), 'by', f.uploaded_by)
              from public.gift_work_files f where f.work_id = w.id and f.kind = 'raw' and f.removed_at is null
              order by f.uploaded_at desc limit 1),
    'stmtFiles', (select count(*) from public.gift_work_files f where f.work_id = w.id and f.kind = 'stmt' and f.removed_at is null),
    'stmtRows', (select coalesce(sum(f.row_count), 0) from public.gift_work_files f where f.work_id = w.id and f.kind = 'stmt' and f.removed_at is null),
    'runs', (select count(*) from public.gift_runs r where r.settle_date = w.settle_date and r.deleted_at is null))
$$;

-- 작업 중인 회차 목록
create or replace function public.gift_work_list(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a private.gift_accounts := private.gift_auth(p_token);
begin
  return coalesce((select jsonb_agg(private.gift_work_json(w) order by w.settle_date desc)
                     from public.gift_work w where w.status = 'open'), '[]'::jsonb);
end $$;

-- 회차 작업 열기(없으면 만들기)
create or replace function public.gift_work_open(p_token text, p_settle_date date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a private.gift_accounts := private.gift_auth(p_token); w public.gift_work;
begin
  if p_settle_date is null then raise exception '정산예정일을 알 수 없어요. 파일에 정산예정일이 있는지 확인해 주세요.'; end if;
  select * into w from public.gift_work where settle_date = p_settle_date and status = 'open';
  if w.id is null then
    insert into public.gift_work(settle_date, created_by, updated_by)
    values (p_settle_date, private.gift_who(a), private.gift_who(a))
    on conflict do nothing
    returning * into w;
    if w.id is null then
      select * into w from public.gift_work where settle_date = p_settle_date and status = 'open';
    end if;
  end if;
  return private.gift_work_json(w);
end $$;

-- 회차 작업 불러오기(올린 파일 내용 포함)
create or replace function public.gift_work_get(p_token text, p_work_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a private.gift_accounts := private.gift_auth(p_token); w public.gift_work;
begin
  select * into w from public.gift_work where id = p_work_id;
  if w.id is null then raise exception '작업을 찾지 못했어요.'; end if;
  return jsonb_build_object('work', private.gift_work_json(w),
    'files', coalesce((select jsonb_agg(jsonb_build_object('kind', f.kind, 'name', f.file_name, 'partner', f.partner,
                 'settleDate', f.settle_date, 'rows', f.row_count, 'cols', f.cols, 'data', f.data,
                 'by', f.uploaded_by, 'at', private.gift_fmt(f.uploaded_at)) order by f.kind, f.file_name)
               from public.gift_work_files f where f.work_id = w.id and f.removed_at is null), '[]'::jsonb));
end $$;

-- 파일 올리기(여러 개 한 번에). 같은 이름은 덮어쓰고, 로우데이터는 회차당 하나만 유지
create or replace function public.gift_work_put_files(p_token text, p_work_id uuid, p_files jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a private.gift_accounts := private.gift_auth(p_token); w public.gift_work; f jsonb; v_n int := 0;
begin
  select * into w from public.gift_work where id = p_work_id and status = 'open';
  if w.id is null then raise exception '작업 중인 회차가 아니에요. 새로고침 후 다시 시도해 주세요.'; end if;
  if jsonb_typeof(p_files) <> 'array' or jsonb_array_length(p_files) > 300 then raise exception '파일 목록 형식이 잘못됐어요.'; end if;

  for f in select * from jsonb_array_elements(p_files) loop
    if coalesce(f->>'kind', '') not in ('raw', 'stmt') then raise exception '파일 종류 값이 잘못됐어요.'; end if;
    if btrim(coalesce(f->>'name', '')) = '' then raise exception '파일 이름이 비어 있어요.'; end if;
    if jsonb_typeof(f->'data') <> 'array' or jsonb_array_length(f->'data') > 30000 then raise exception '% 파일의 행 수가 너무 많거나 형식이 잘못됐어요.', f->>'name'; end if;

    if f->>'kind' = 'raw' then
      update public.gift_work_files set removed_at = now()
       where work_id = w.id and kind = 'raw' and removed_at is null and file_name <> left(f->>'name', 300);
    end if;

    insert into public.gift_work_files(work_id, kind, file_name, partner, settle_date, row_count, cols, data, uploaded_by)
    values (w.id, f->>'kind', left(f->>'name', 300), left(coalesce(f->>'partner', ''), 200),
            nullif(f->>'settleDate', '')::date, jsonb_array_length(f->'data'),
            coalesce(f->'cols', '[]'::jsonb), f->'data', private.gift_who(a))
    on conflict (work_id, kind, file_name) do update set
      partner = excluded.partner, settle_date = excluded.settle_date, row_count = excluded.row_count,
      cols = excluded.cols, data = excluded.data, uploaded_by = excluded.uploaded_by,
      uploaded_at = now(), removed_at = null;
    v_n := v_n + 1;
  end loop;

  update public.gift_work set updated_by = private.gift_who(a), updated_at = now() where id = w.id;
  return jsonb_build_object('saved', v_n, 'work', private.gift_work_json((select x from public.gift_work x where x.id = w.id)));
end $$;

-- 파일 빼기(실제로 지우지 않고 빠진 것으로 표시)
create or replace function public.gift_work_remove_files(p_token text, p_work_id uuid, p_kind text, p_names jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a private.gift_accounts := private.gift_auth(p_token); v_n int;
begin
  update public.gift_work_files set removed_at = now()
   where work_id = p_work_id and removed_at is null
     and (p_kind is null or kind = p_kind)
     and (p_names is null or file_name in (select jsonb_array_elements_text(p_names)));
  get diagnostics v_n = row_count;
  update public.gift_work set updated_by = private.gift_who(a), updated_at = now() where id = p_work_id;
  return jsonb_build_object('removed', v_n, 'work', private.gift_work_json((select x from public.gift_work x where x.id = p_work_id)));
end $$;

-- 회차 작업 끝내기(목록에서 내림)
create or replace function public.gift_work_close(p_token text, p_work_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare a private.gift_accounts := private.gift_auth(p_token);
begin
  update public.gift_work set status = 'closed', closed_by = private.gift_who(a), closed_at = now()
   where id = p_work_id and status = 'open';
  return found;
end $$;

revoke all on function private.gift_work_json(public.gift_work) from public, anon, authenticated;
revoke all on function
  public.gift_work_list(text), public.gift_work_open(text, date), public.gift_work_get(text, uuid),
  public.gift_work_put_files(text, uuid, jsonb), public.gift_work_remove_files(text, uuid, text, jsonb),
  public.gift_work_close(text, uuid)
from public;
grant execute on function
  public.gift_work_list(text), public.gift_work_open(text, date), public.gift_work_get(text, uuid),
  public.gift_work_put_files(text, uuid, jsonb), public.gift_work_remove_files(text, uuid, text, jsonb),
  public.gift_work_close(text, uuid)
to anon, authenticated;
