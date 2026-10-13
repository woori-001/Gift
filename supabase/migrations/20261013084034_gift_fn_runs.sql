-- 검수 결과 저장·목록·불러오기·메모·숨김 + 실행 권한
create or replace function private.gift_run_json(r public.gift_runs) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', r.id, 'settleDate', r.settle_date, 'rawFile', r.raw_file, 'stmtFiles', r.stmt_files,
    'rawRows', r.raw_rows, 'stmtRows', r.stmt_rows, 'matched', r.matched,
    'undCount', r.und_count, 'undAmount', r.und_amount, 'missCount', r.miss_count, 'missPaid', r.miss_paid,
    'onlyCount', r.only_count, 'chgCount', r.chg_count, 'chkCount', r.chk_count,
    'memo', r.memo, 'by', r.created_by, 'at', private.gift_fmt(r.created_at))
$$;

create or replace function public.gift_run_save(p_token text, p_run jsonb, p_findings jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a private.gift_accounts := private.gift_auth(p_token); v_id uuid; v_n int;
begin
  if jsonb_typeof(p_findings) <> 'array' then raise exception '결과 형식이 잘못됐어요.'; end if;
  if jsonb_array_length(p_findings) > 20000 then raise exception '저장할 결과가 너무 많아요(최대 20,000건).'; end if;
  if exists (select 1 from jsonb_array_elements(p_findings) f where coalesce(f->>'kind', '') not in ('und','miss','only','chg','chk')) then
    raise exception '결과 종류 값이 잘못됐어요.';
  end if;

  insert into public.gift_runs(settle_date, raw_file, stmt_files, raw_rows, stmt_rows, matched,
      und_count, und_amount, miss_count, miss_paid, only_count, chg_count, chk_count, partners, memo, created_by)
  values (
    nullif(p_run->>'settleDate', '')::date,
    left(coalesce(p_run->>'rawFile', ''), 300),
    coalesce((p_run->>'stmtFiles')::int, 0), coalesce((p_run->>'rawRows')::int, 0), coalesce((p_run->>'stmtRows')::int, 0),
    coalesce((p_run->>'matched')::int, 0),
    coalesce((p_run->>'undCount')::int, 0), coalesce((p_run->>'undAmount')::bigint, 0),
    coalesce((p_run->>'missCount')::int, 0), coalesce((p_run->>'missPaid')::int, 0),
    coalesce((p_run->>'onlyCount')::int, 0), coalesce((p_run->>'chgCount')::int, 0), coalesce((p_run->>'chkCount')::int, 0),
    coalesce(p_run->'partners', '[]'::jsonb), left(coalesce(p_run->>'memo', ''), 1000), private.gift_who(a))
  returning id into v_id;

  insert into public.gift_findings(run_id, kind, partner, settle_type, cust_name, svc, product, open_date, amount, detail)
  select v_id, f->>'kind', left(coalesce(f->>'partner', ''), 200), left(coalesce(f->>'type', ''), 20), left(coalesce(f->>'name', ''), 100),
         left(coalesce(f->>'svc', ''), 200), left(coalesce(f->>'product', ''), 200), left(coalesce(f->>'openDate', ''), 20),
         coalesce((f->>'amount')::bigint, 0), coalesce(f->'detail', '{}'::jsonb)
    from jsonb_array_elements(p_findings) f;
  get diagnostics v_n = row_count;

  return jsonb_build_object('id', v_id, 'findings', v_n);
end $$;

create or replace function public.gift_run_list(p_token text, p_limit int default 50) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a private.gift_accounts := private.gift_auth(p_token);
begin
  return coalesce((select jsonb_agg(private.gift_run_json(r) order by r.settle_date desc nulls last, r.created_at desc)
    from (select * from public.gift_runs where deleted_at is null
           order by settle_date desc nulls last, created_at desc
           limit greatest(1, least(coalesce(p_limit, 50), 500))) r), '[]'::jsonb);
end $$;

create or replace function public.gift_run_get(p_token text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a private.gift_accounts := private.gift_auth(p_token); r public.gift_runs;
begin
  select * into r from public.gift_runs where id = p_id and deleted_at is null;
  if r.id is null then raise exception '저장된 검수 기록을 찾지 못했어요.'; end if;
  return jsonb_build_object(
    'run', private.gift_run_json(r) || jsonb_build_object('partners', r.partners),
    'findings', coalesce((select jsonb_agg(jsonb_build_object('kind', f.kind, 'detail', f.detail) order by f.id)
                          from public.gift_findings f where f.run_id = r.id), '[]'::jsonb));
end $$;

create or replace function public.gift_run_memo(p_token text, p_id uuid, p_memo text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare a private.gift_accounts := private.gift_auth(p_token);
begin
  update public.gift_runs set memo = left(coalesce(p_memo, ''), 1000) where id = p_id and deleted_at is null;
  return found;
end $$;

-- 기록 숨기기(관리자). 실제로 지우지 않고 숨김 처리
create or replace function public.gift_run_hide(p_token text, p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare a private.gift_accounts := private.gift_auth(p_token, true);
begin
  update public.gift_runs set deleted_at = now(), deleted_by = private.gift_who(a) where id = p_id and deleted_at is null;
  return found;
end $$;

revoke all on function private.gift_hash(text), private.gift_fmt(timestamptz), private.gift_who(private.gift_accounts),
  private.gift_auth(text, boolean), private.gift_run_json(public.gift_runs) from public, anon, authenticated;

revoke all on function
  public.gift_login(text, text), public.gift_logout(text), public.gift_me(text),
  public.gift_change_password(text, text, text),
  public.gift_account_list(text), public.gift_account_save(text, text, text, text, text, boolean),
  public.gift_run_save(text, jsonb, jsonb), public.gift_run_list(text, int), public.gift_run_get(text, uuid),
  public.gift_run_memo(text, uuid, text), public.gift_run_hide(text, uuid)
from public;

grant execute on function
  public.gift_login(text, text), public.gift_logout(text), public.gift_me(text),
  public.gift_change_password(text, text, text),
  public.gift_account_list(text), public.gift_account_save(text, text, text, text, text, boolean),
  public.gift_run_save(text, jsonb, jsonb), public.gift_run_list(text, int), public.gift_run_get(text, uuid),
  public.gift_run_memo(text, uuid, text), public.gift_run_hide(text, uuid)
to anon, authenticated;
