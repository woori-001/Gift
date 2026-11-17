-- 개인정보 줄이기
--  가) 파일을 빼거나 바꾸면 내용(data)을 바로 비움
--  나) 검수 기록을 지우면 문제 건 목록의 고객 정보(이름·번호·상세)를 비움
--  다) 정산예정일이 30일 지난 회차는 자동으로 닫고 내용을 비움 (회차 목록·열기 때마다 정리)
--  라) 가입서비스 번호는 가려서 저장 (앞 3자리·뒤 4자리만 남김: 010-****-5678). 고객명도 서버에서 한 번 더 가림

-- 숫자 7자리 이상 묶음(하이픈 포함)에서 앞 3자리·뒤 4자리만 남기고 * 로. 앱(js)의 maskSvc 와 같은 규칙
create or replace function private.gift_mask_run(p_run text) returns text
language plpgsql immutable set search_path = '' as $$
declare n int := length(regexp_replace(p_run, '[^0-9]', '', 'g')); k int := 0; r text := ''; c text; i int;
begin
  if n < 7 then return p_run; end if;
  for i in 1..length(p_run) loop
    c := substr(p_run, i, 1);
    if c ~ '[0-9]' then
      k := k + 1;
      r := r || case when k > 3 and k <= n - 4 then '*' else c end;
    else
      r := r || c;
    end if;
  end loop;
  return r;
end $$;

create or replace function private.gift_mask_svc(p text) returns text
language plpgsql immutable set search_path = '' as $$
declare r text := ''; run text := ''; c text; i int; len int;
begin
  if p is null or p = '' then return p; end if;
  len := length(p);
  for i in 1..len + 1 loop
    c := case when i <= len then substr(p, i, 1) end;
    if c is not null and (c ~ '[0-9]' or (c = '-' and run <> '')) then
      run := run || c;
    else
      if run <> '' then r := r || private.gift_mask_run(run); run := ''; end if;
      if c is not null then r := r || c; end if;
    end if;
  end loop;
  return r;
end $$;

-- 고객명: 앱의 mask 와 같은 규칙(두 번째 글자를 *)
create or replace function private.gift_mask_name(p text) returns text
language sql immutable set search_path = '' as $$
  select case when p is null or position('*' in p) > 0 or length(p) < 2 then p
              else substr(p, 1, 1) || '*' || substr(p, 3) end
$$;

-- 올린 파일 내용에서 고객명·가입서비스 칸을 가림
create or replace function private.gift_mask_file_data(p_cols jsonb, p_data jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare i_name int; i_svc int;
begin
  if jsonb_typeof(p_cols) <> 'array' or jsonb_typeof(p_data) <> 'array' or jsonb_array_length(p_data) = 0 then return p_data; end if;
  select (o - 1)::int into i_name from jsonb_array_elements_text(p_cols) with ordinality as t(v, o) where v = '고객명' limit 1;
  select (o - 1)::int into i_svc  from jsonb_array_elements_text(p_cols) with ordinality as t(v, o) where v = '가입서비스' limit 1;
  if i_name is null and i_svc is null then return p_data; end if;
  return (
    select coalesce(jsonb_agg(
      case when jsonb_typeof(e) <> 'array' then e else
        case when i_svc is not null and jsonb_typeof(e -> i_svc) = 'string'
             then jsonb_set(x.e1, array[i_svc::text], to_jsonb(private.gift_mask_svc(e ->> i_svc))) else x.e1 end
      end order by o), '[]'::jsonb)
    from jsonb_array_elements(p_data) with ordinality as t(e, o)
    cross join lateral (
      select case when i_name is not null and jsonb_typeof(e) = 'array' and jsonb_typeof(e -> i_name) = 'string'
                  then jsonb_set(e, array[i_name::text], to_jsonb(private.gift_mask_name(e ->> i_name))) else e end as e1
    ) x
  );
end $$;

-- 검수 기록 상세(detail.raw / detail.st)의 가입서비스·고객명 가림
create or replace function private.gift_mask_detail(p jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare r jsonb := p; k text;
begin
  if jsonb_typeof(p) <> 'object' then return p; end if;
  foreach k in array array['raw', 'st'] loop
    if jsonb_typeof(r -> k) = 'object' then
      if jsonb_typeof(r -> k -> '가입서비스') = 'string' then
        r := jsonb_set(r, array[k, '가입서비스'], to_jsonb(private.gift_mask_svc(r -> k ->> '가입서비스')));
      end if;
      if jsonb_typeof(r -> k -> '고객명') = 'string' then
        r := jsonb_set(r, array[k, '고객명'], to_jsonb(private.gift_mask_name(r -> k ->> '고객명')));
      end if;
    end if;
  end loop;
  return r;
end $$;

-- 다) 오래된 회차 정리 + 빠진 파일 내용 비우기
create or replace function private.gift_cleanup() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.gift_work set status = 'closed', closed_by = '자동 정리(30일)', closed_at = now()
   where status = 'open' and settle_date < current_date - 30;
  update public.gift_work_files f set data = '[]'::jsonb, cols = '[]'::jsonb, removed_at = coalesce(f.removed_at, now())
   where (f.removed_at is not null or exists (select 1 from public.gift_work w where w.id = f.work_id and w.status = 'closed'))
     and (f.data <> '[]'::jsonb or f.cols <> '[]'::jsonb);
end $$;

-- 회차 목록: 볼 때마다 정리 먼저
create or replace function public.gift_work_list(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a private.gift_accounts := private.gift_auth(p_token);
begin
  perform private.gift_cleanup();
  return coalesce((select jsonb_agg(private.gift_work_json(w) order by w.settle_date desc)
                     from public.gift_work w where w.status = 'open'), '[]'::jsonb);
end $$;

-- 회차 열기: 정리 먼저
create or replace function public.gift_work_open(p_token text, p_settle_date date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a private.gift_accounts := private.gift_auth(p_token); w public.gift_work;
begin
  if p_settle_date is null then raise exception '정산예정일을 알 수 없어요. 파일에 정산예정일이 있는지 확인해 주세요.'; end if;
  perform private.gift_cleanup();
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

-- 파일 올리기: 서버에서도 고객명·가입서비스를 가려서 저장, 바뀐 로우데이터는 내용 비움
create or replace function public.gift_work_put_files(p_token text, p_work_id uuid, p_files jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a private.gift_accounts := private.gift_auth(p_token); w public.gift_work; f jsonb; v_n int := 0; v_cols jsonb;
begin
  select * into w from public.gift_work where id = p_work_id and status = 'open';
  if w.id is null then raise exception '작업 중인 회차가 아니에요. 새로고침 후 다시 시도해 주세요.'; end if;
  if jsonb_typeof(p_files) <> 'array' or jsonb_array_length(p_files) > 300 then raise exception '파일 목록 형식이 잘못됐어요.'; end if;

  for f in select * from jsonb_array_elements(p_files) loop
    if coalesce(f->>'kind', '') not in ('raw', 'stmt') then raise exception '파일 종류 값이 잘못됐어요.'; end if;
    if btrim(coalesce(f->>'name', '')) = '' then raise exception '파일 이름이 비어 있어요.'; end if;
    if jsonb_typeof(f->'data') <> 'array' or jsonb_array_length(f->'data') > 30000 then raise exception '% 파일의 행 수가 너무 많거나 형식이 잘못됐어요.', f->>'name'; end if;
    v_cols := coalesce(f->'cols', '[]'::jsonb);

    if f->>'kind' = 'raw' then
      update public.gift_work_files set removed_at = now(), data = '[]'::jsonb, cols = '[]'::jsonb
       where work_id = w.id and kind = 'raw' and removed_at is null and file_name <> left(f->>'name', 300);
    end if;

    insert into public.gift_work_files(work_id, kind, file_name, partner, settle_date, row_count, cols, data, uploaded_by)
    values (w.id, f->>'kind', left(f->>'name', 300), left(coalesce(f->>'partner', ''), 200),
            nullif(f->>'settleDate', '')::date, jsonb_array_length(f->'data'),
            v_cols, private.gift_mask_file_data(v_cols, f->'data'), private.gift_who(a))
    on conflict (work_id, kind, file_name) do update set
      partner = excluded.partner, settle_date = excluded.settle_date, row_count = excluded.row_count,
      cols = excluded.cols, data = excluded.data, uploaded_by = excluded.uploaded_by,
      uploaded_at = now(), removed_at = null;
    v_n := v_n + 1;
  end loop;

  update public.gift_work set updated_by = private.gift_who(a), updated_at = now() where id = w.id;
  return jsonb_build_object('saved', v_n, 'work', private.gift_work_json((select x from public.gift_work x where x.id = w.id)));
end $$;

-- 가) 파일 빼기: 빠진 것으로 표시하면서 내용도 바로 비움
create or replace function public.gift_work_remove_files(p_token text, p_work_id uuid, p_kind text, p_names jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a private.gift_accounts := private.gift_auth(p_token); v_n int;
begin
  update public.gift_work_files set removed_at = now(), data = '[]'::jsonb, cols = '[]'::jsonb
   where work_id = p_work_id and removed_at is null
     and (p_kind is null or kind = p_kind)
     and (p_names is null or file_name in (select jsonb_array_elements_text(p_names)));
  get diagnostics v_n = row_count;
  update public.gift_work set updated_by = private.gift_who(a), updated_at = now() where id = p_work_id;
  return jsonb_build_object('removed', v_n, 'work', private.gift_work_json((select x from public.gift_work x where x.id = p_work_id)));
end $$;

-- 검수 기록 저장: 문제 건의 고객명·가입서비스를 서버에서도 가림
create or replace function private.gift_findings_mask_trg() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.cust_name := private.gift_mask_name(new.cust_name);
  new.svc := private.gift_mask_svc(new.svc);
  new.detail := private.gift_mask_detail(new.detail);
  return new;
end $$;
drop trigger if exists gift_findings_mask on public.gift_findings;
create trigger gift_findings_mask before insert or update on public.gift_findings
  for each row execute function private.gift_findings_mask_trg();

-- 나) 검수 기록 지우기: 기록을 숨기고, 문제 건 목록의 고객 정보를 비움(건수·금액·업체만 남김)
create or replace function public.gift_run_hide(p_token text, p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare a private.gift_accounts := private.gift_auth(p_token, true);
begin
  update public.gift_runs set deleted_at = now(), deleted_by = private.gift_who(a) where id = p_id and deleted_at is null;
  if not found then return false; end if;
  update public.gift_findings set cust_name = '', svc = '', product = '', open_date = '', detail = '{}'::jsonb where run_id = p_id;
  return true;
end $$;

revoke all on function private.gift_mask_run(text), private.gift_mask_svc(text), private.gift_mask_name(text),
  private.gift_mask_file_data(jsonb, jsonb), private.gift_mask_detail(jsonb), private.gift_cleanup(),
  private.gift_findings_mask_trg() from public, anon, authenticated;

-- 지금까지 쌓인 것도 정리
select private.gift_cleanup();
update public.gift_work_files set data = private.gift_mask_file_data(cols, data) where data <> '[]'::jsonb;
update public.gift_findings f set cust_name = '', svc = '', product = '', open_date = '', detail = '{}'::jsonb
 where exists (select 1 from public.gift_runs r where r.id = f.run_id and r.deleted_at is not null);
update public.gift_findings set svc = svc where true;  -- 트리거로 남은 기록도 가림
