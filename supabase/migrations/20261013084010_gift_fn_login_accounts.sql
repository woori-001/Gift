-- 로그인·로그아웃·비밀번호·계정 관리
-- 삭제(DELETE) 없이 동작: 세션은 만료 처리, 계정은 사용 중지, 기록은 숨김 처리
alter table public.gift_runs add column if not exists deleted_at timestamptz;
alter table public.gift_runs add column if not exists deleted_by text;

create or replace function public.gift_login(p_id text, p_password text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_ip text; v_fail int; v_acc private.gift_accounts; v_token text;
begin
  v_ip := split_part(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1);
  select count(*) into v_fail from private.gift_login_attempts
   where ip = v_ip and not ok and at > now() - interval '10 minutes';
  if v_fail >= 10 then
    return jsonb_build_object('ok', false, 'error', '로그인 실패가 너무 많아요. 10분 뒤 다시 시도해 주세요.');
  end if;

  select * into v_acc from private.gift_accounts where id = btrim(coalesce(p_id, ''));
  if v_acc.id is null or v_acc.pw_hash <> extensions.crypt(coalesce(p_password, ''), v_acc.pw_hash) then
    insert into private.gift_login_attempts(ip, account_id, ok) values (v_ip, left(coalesce(p_id, ''), 60), false);
    return jsonb_build_object('ok', false, 'error', '아이디 또는 비밀번호가 맞지 않아요.');
  end if;
  if not v_acc.enabled then
    return jsonb_build_object('ok', false, 'error', '사용이 중지된 계정이에요. 관리자에게 문의해 주세요.');
  end if;

  insert into private.gift_login_attempts(ip, account_id, ok) values (v_ip, v_acc.id, true);
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into private.gift_sessions(token_hash, account_id, expires_at)
  values (private.gift_hash(v_token), v_acc.id, now() + interval '8 hours');
  update private.gift_accounts set last_login_at = now() where id = v_acc.id;

  return jsonb_build_object('ok', true, 'token', v_token, 'mustChange', v_acc.must_change,
    'user', jsonb_build_object('id', v_acc.id, 'name', coalesce(nullif(v_acc.name, ''), v_acc.id), 'role', v_acc.role));
end $$;

-- 로그아웃: 세션을 즉시 만료
create or replace function public.gift_logout(p_token text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update private.gift_sessions set expires_at = now() where token_hash = private.gift_hash(p_token);
  return true;
end $$;

create or replace function public.gift_change_password(p_token text, p_old text, p_new text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare a private.gift_accounts := private.gift_auth(p_token);
begin
  if a.pw_hash <> extensions.crypt(coalesce(p_old, ''), a.pw_hash) then
    raise exception '현재 비밀번호가 맞지 않아요.';
  end if;
  if length(coalesce(p_new, '')) < 6 then raise exception '새 비밀번호는 6자 이상이어야 해요.'; end if;
  update private.gift_accounts
     set pw_hash = extensions.crypt(p_new, extensions.gen_salt('bf')), must_change = false
   where id = a.id;
  -- 다른 곳에 로그인된 세션은 만료시키고 지금 세션만 유지
  update private.gift_sessions set expires_at = now()
   where account_id = a.id and token_hash <> private.gift_hash(p_token) and expires_at > now();
  return true;
end $$;

create or replace function public.gift_account_list(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a private.gift_accounts := private.gift_auth(p_token, true);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'role', x.role, 'enabled', x.enabled,
           'mustChange', x.must_change, 'lastLogin', private.gift_fmt(x.last_login_at)) order by x.enabled desc, x.role, x.id)
         from private.gift_accounts x), '[]'::jsonb);
end $$;

-- 계정 추가·수정(관리자). 계정은 지우지 않고 enabled=false 로 사용 중지
create or replace function public.gift_account_save(p_token text, p_id text, p_name text, p_password text, p_role text, p_enabled boolean)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare a private.gift_accounts := private.gift_auth(p_token, true); v_id text := btrim(coalesce(p_id, ''));
begin
  if v_id !~ '^[A-Za-z0-9._-]{2,40}$' then raise exception '아이디는 영문·숫자·._- 로 2~40자여야 해요.'; end if;
  if coalesce(p_role, 'user') not in ('admin', 'user') then raise exception '권한 값이 잘못됐어요.'; end if;
  if v_id = a.id and (coalesce(p_role, 'user') <> 'admin' or not coalesce(p_enabled, true)) then
    raise exception '내 계정의 관리자 권한은 내리거나 중지할 수 없어요.';
  end if;
  if exists (select 1 from private.gift_accounts where id = v_id) then
    update private.gift_accounts
       set name = coalesce(p_name, name), role = coalesce(p_role, role), enabled = coalesce(p_enabled, enabled),
           pw_hash = case when coalesce(p_password, '') <> '' then extensions.crypt(p_password, extensions.gen_salt('bf')) else pw_hash end,
           must_change = case when coalesce(p_password, '') <> '' then true else must_change end
     where id = v_id;
    if coalesce(p_password, '') <> '' or not coalesce(p_enabled, true) then
      update private.gift_sessions set expires_at = now() where account_id = v_id and expires_at > now();
    end if;
  else
    if length(coalesce(p_password, '')) < 6 then raise exception '새 계정의 비밀번호를 6자 이상으로 넣어주세요.'; end if;
    insert into private.gift_accounts(id, name, pw_hash, role, enabled, must_change)
    values (v_id, coalesce(p_name, ''), extensions.crypt(p_password, extensions.gen_salt('bf')), coalesce(p_role, 'user'), coalesce(p_enabled, true), true);
  end if;
  return true;
end $$;
