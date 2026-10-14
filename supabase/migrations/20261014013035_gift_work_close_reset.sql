-- 검수 끝 · 초기화: 회차 작업을 닫고, 올려둔 로우·정산서 내용(data)을 비움. 파일 이름·건수 기록만 남김
create or replace function public.gift_work_close(p_token text, p_work_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare a private.gift_accounts := private.gift_auth(p_token);
begin
  update public.gift_work set status = 'closed', closed_by = private.gift_who(a), closed_at = now()
   where id = p_work_id and status = 'open';
  if not found then return false; end if;
  update public.gift_work_files set data = '[]'::jsonb, cols = '[]'::jsonb, removed_at = coalesce(removed_at, now())
   where work_id = p_work_id;
  return true;
end $$;
revoke all on function public.gift_work_close(text, uuid) from public;
grant execute on function public.gift_work_close(text, uuid) to anon, authenticated;
