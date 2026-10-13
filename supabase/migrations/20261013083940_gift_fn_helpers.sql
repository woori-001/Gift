-- 내부 헬퍼 + 토큰 검증
create or replace function private.gift_hash(p text) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(coalesce(p, ''), 'sha256'), 'hex')
$$;

create or replace function private.gift_fmt(t timestamptz) returns text
language sql stable set search_path = '' as $$
  select coalesce(to_char(t at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI'), '')
$$;

create or replace function private.gift_who(a private.gift_accounts) returns text
language sql immutable set search_path = '' as $$
  select case when coalesce(a.name, '') = '' then a.id else a.name || '(' || a.id || ')' end
$$;

create or replace function private.gift_auth(p_token text, p_admin boolean default false)
returns private.gift_accounts
language plpgsql security definer set search_path = '' as $$
declare v_acc private.gift_accounts; v_th text := private.gift_hash(p_token);
begin
  select a.* into v_acc
    from private.gift_sessions s join private.gift_accounts a on a.id = s.account_id
   where s.token_hash = v_th and s.expires_at > now() and a.enabled;
  if v_acc.id is null then
    raise exception 'AUTH: 로그인이 필요해요. 다시 로그인해 주세요.';
  end if;
  update private.gift_sessions set expires_at = now() + interval '8 hours' where token_hash = v_th;
  if p_admin and v_acc.role <> 'admin' then
    raise exception '관리자만 할 수 있어요.';
  end if;
  return v_acc;
end $$;

create or replace function public.gift_me(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a private.gift_accounts := private.gift_auth(p_token);
begin
  return jsonb_build_object('id', a.id, 'name', coalesce(nullif(a.name, ''), a.id), 'role', a.role, 'mustChange', a.must_change);
end $$;
